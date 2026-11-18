# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import csv
import re
from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal

# Django imports
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

# Module imports
from plane.db.models import (
    Issue,
    IssueShipment,
    IssueType,
    OrderDetail,
    ProductCategory,
    ProductFit,
    Project,
    State,
    Style,
    TaskStateTarget,
    User,
    Vendor,
)

# Loads the "Master Production Sheet" CSV export into a project as order work items.
# It started life as plane_setup's create_work_items_from_csv_elab.py, which did the
# same through the HTTP API; running inside the container writes straight to the
# database instead, which is much faster and can also set TaskStateTarget.entered_at
# (read-only in the API).
#
# Each order becomes a parent work item "<Category> - <Vendor> - <TOTAL QTTY> units"
# with one sub work item per SKU row "<SKU> - <qty> units". The SKU is the sub-item's
# style (a workspace Style, created if missing); its fit and category are the parent's.
# Rows with an Order Number
# are grouped by (Order Number, Requested Delivery month); rows without one are
# grouped by block - a row with TOTAL QTTY filled starts an order, and the rows below
# it with TOTAL QTTY blank are its other SKUs. Cancelled / On Hold rows are skipped.
# A sub-item's vendor promised delivery date (Issue.target_date) is its row's
# TENTATIVE SHIP DATE; the parent takes its first SKU's date and state.
#
# Idempotent: every work item carries external_source = EXTERNAL_SOURCE and a stable
# external_id, and existing ones are updated rather than re-created.

EXTERNAL_SOURCE = "master-production-sheet"

# SKU cells that aren't a style id; those sub-items get no style.
PLACEHOLDER_SKUS = {"tbd", "tba", "na", "n/a", "none", "-", "--"}
STYLE_CODE_MAX_LENGTH = 100

# CSV column names, with runs of whitespace collapsed to one space (the sheet has
# e.g. "Cutting start  date").
COL_ORDER_NUMBER = "Order Number"
COL_CATEGORY = "Category"
COL_VENDOR = "VENDOR NAME"
COL_PRODUCT_NAME = "Product Name"
COL_SKU = "SKU"
COL_PRODUCT_QTY = "Product wise Quantity"
COL_TOTAL_QTY = "TOTAL QTTY"
COL_DELIVERY_MONTH = "Requested Delivery month"
COL_ORDER_STATUS = "Order Status"
COL_PO_NUMBER = "PO Number"
COL_FOB_COST = "FOB Cost"
COL_TENTATIVE_SHIP_DATE = "TENTATIVE SHIP DATE"
COL_BALANCE_QTY = "Balance quantity TO BE SHIPPED"
COL_ORDER_PLACED_DATE = "Order placed date"
COL_EX_FACTORY_DATE = "Actual EX factory date"

# CSV Order Status -> the state each SKU sub-item is created in.
ORDER_STATUS_TO_STATE = {
    "active order": "Production",
    "partially fulfilled": "Production",
    "fulfilled": "Shipped to WH",
}

# Rows with these Order Statuses aren't loaded at all.
SKIPPED_ORDER_STATUSES = {"cancelled", "on hold"}

# TNA state -> the CSV date column(s) for it, per SKU row. A date up to today is the
# state's entered_at; a future date is its target_date. With several columns, the
# latest date wins. States not listed here (e.g. "Fabric Shipped") get nothing.
STATE_DATE_COLUMNS = {
    "Order Placed": [COL_ORDER_PLACED_DATE],
    "SO received": ["PO date"],
    "Fabric Started": ["Fabric order placed date"],
    "Fabric/Trims Inhouse": ["Fabric inhouse date", "Trims inhouse date"],
    "Pre-Production samples": ["PP Submission date"],
    "Size Set": ["Size Set submission date"],
    "Production": ["Cutting start date"],
    "Inline": ["In-line inspection date"],
    "Midline": ["Mid-line insepction date"],  # sic - the sheet's spelling
    "Final Inspection": ["Final Inspection date"],
    "Shipped to WH": [COL_EX_FACTORY_DATE],
}

# CSV TENTATIVE SHIP DATE is always this state's target date (past or future), taking
# precedence over a future date from STATE_DATE_COLUMNS.
TENTATIVE_SHIP_STATE = "Shipped to WH"

# Numbers in TOTAL QTTY that are never a quantity (the year, when written into the cell).
TOTAL_QTY_IGNORED_NUMBERS = {2026}

# Note on the shipment logged from the sheet, so a re-run recognizes it instead of
# logging it twice. A shipment dated by TENTATIVE SHIP DATE (no usable ex-factory
# date) also carries SHIPMENT_CHECK_DATE_NOTE.
SHIPMENT_NOTE = "From Master Production Sheet"
SHIPMENT_CHECK_DATE_NOTE = "check date"

MONTH_FORMATS = ["%B %Y", "%b %Y", "%b-%y", "%B-%y", "%b-%Y", "%B-%Y"]
MONTH_ABBREVIATIONS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def month_from_text(text):
    """1-12 for the first jan/feb/... substring in text (so misspellings like
    'Septemebr' still match), else None."""
    return next((i + 1 for i, m in enumerate(MONTH_ABBREVIATIONS) if m in text.lower()), None)


def parse_month_to_date(month_str):
    """'January 2027' / 'Dec-26' / 'Novemebr 2026' -> the 10th of that month, else None."""
    cleaned = month_str.strip()
    for fmt in MONTH_FORMATS:
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return date(parsed.year, parsed.month, 10)
        except ValueError:
            continue
    parts = [p for p in re.split(r"[\s\-]+", cleaned) if p]
    if len(parts) == 2 and parts[1].isdigit() and len(parts[1]) in (2, 4):
        month = month_from_text(parts[0])
        if month:
            return date(int(parts[1]) + (2000 if len(parts[1]) == 2 else 0), month, 10)
    return None


def parse_cell_date(value):
    """'21st June 2025' / '28 JULY 2026' / '11-Aug-26' -> date. Splits on hyphens and
    spaces into day, month and year. Returns None for anything else ('ON HOLD',
    notes, dates with no year)."""
    parts = [p for p in re.split(r"[\s\-]+", value.strip()) if p]
    if len(parts) != 3:
        return None
    day_part, month_part, year_part = parts
    day_match = re.fullmatch(r"(\d{1,2})(st|nd|rd|th)?", day_part.lower())
    month = month_from_text(month_part)
    if not day_match or month is None or not year_part.isdigit() or len(year_part) not in (2, 4):
        return None
    try:
        return date(int(year_part) + (2000 if len(year_part) == 2 else 0), month, int(day_match.group(1)))
    except ValueError:
        return None


def parse_smallest_quantity(value):
    """'24,000 1st half\\n\\n12,000' -> 12000, '5000 1st qtty (10,000)' -> 5000, '' -> 0.
    TOTAL QTTY is sometimes free text, so take its smallest number, ignoring single
    digits ('1st', '2nd') and years."""
    numbers = [int(m.replace(",", "")) for m in re.findall(r"\d[\d,]*", value)]
    return min((n for n in numbers if n >= 10 and n not in TOTAL_QTY_IGNORED_NUMBERS), default=0)


class SheetParser:
    """Turns the CSV into a list of orders, collecting a warning for every cell it
    can't use (the rest of that row still loads)."""

    def __init__(self, today):
        self.today = today
        self.warnings = []

    def warn(self, label, message):
        self.warnings.append(f"{label}: {message}")

    def parse_price(self, value, label):
        cleaned = value.strip().replace(",", "")
        if not cleaned or cleaned.upper() == "TBD":
            return None
        if not re.fullmatch(r"\d+(\.\d+)?", cleaned):
            self.warn(label, f"couldn't parse '{COL_FOB_COST}' value {value!r} as a price - skipped")
            return None
        return Decimal(cleaned)

    def parse_state_dates(self, row, idx, label):
        """({state: entered date}, {state: target date}, tentative ship date or None)
        for this SKU row."""
        entered, targets = {}, {}
        for state_name, columns in STATE_DATE_COLUMNS.items():
            past, future = [], []
            for column in columns:
                raw = row[idx[column]].strip()
                if not raw:
                    continue
                parsed = parse_cell_date(raw)
                if parsed is None:
                    self.warn(label, f"couldn't parse '{column}' value {raw!r} as a date - skipped")
                elif parsed > self.today:
                    future.append(parsed)
                else:
                    past.append(parsed)
            if past:
                entered[state_name] = max(past)
            if future:
                targets[state_name] = max(future)

        tentative = None
        tentative_raw = row[idx[COL_TENTATIVE_SHIP_DATE]].strip()
        if tentative_raw:
            tentative = parse_cell_date(tentative_raw)
            if tentative is None:
                self.warn(label, f"couldn't parse '{COL_TENTATIVE_SHIP_DATE}' value {tentative_raw!r} as a date - skipped")
            else:
                targets[TENTATIVE_SHIP_STATE] = tentative
        return entered, targets, tentative

    def parse_shipment(self, row, idx, qty, label):
        """(shipped_date, quantity, note) or None. Shipped = SKU quantity - balance (a
        negative balance is an overshoot, so it adds). Dated by the ex-factory date, or
        by the tentative ship date noted "check date". A blank balance means unknown."""
        balance_raw = row[idx[COL_BALANCE_QTY]].strip().replace(",", "")
        if not balance_raw:
            return None
        if not re.fullmatch(r"-?\d+", balance_raw):
            self.warn(label, f"couldn't parse '{COL_BALANCE_QTY}' value {balance_raw!r} - no shipment logged")
            return None
        shipped = qty - int(balance_raw)
        if shipped == 0:
            return None
        if shipped < 0:
            self.warn(label, f"balance {balance_raw} is more than the quantity {qty} - no shipment logged")
            return None

        ex_factory_raw = row[idx[COL_EX_FACTORY_DATE]].strip()
        shipped_date = parse_cell_date(ex_factory_raw)
        if shipped_date is not None:
            if shipped_date > self.today:
                self.warn(label, f"{shipped} shipped but '{COL_EX_FACTORY_DATE}' {shipped_date} is in the future "
                                 f"- no shipment logged")
                return None
            return shipped_date, shipped, SHIPMENT_NOTE
        if ex_factory_raw:
            self.warn(label, f"couldn't parse '{COL_EX_FACTORY_DATE}' value {ex_factory_raw!r} - "
                             f"dating the shipment by '{COL_TENTATIVE_SHIP_DATE}' instead")
        tentative_raw = row[idx[COL_TENTATIVE_SHIP_DATE]].strip()
        shipped_date = parse_cell_date(tentative_raw)
        if shipped_date is None:
            self.warn(label, f"{shipped} shipped but neither '{COL_EX_FACTORY_DATE}' nor '{COL_TENTATIVE_SHIP_DATE}' "
                             f"({tentative_raw!r}) is a usable date - no shipment logged")
            return None
        return shipped_date, shipped, f"{SHIPMENT_NOTE} - {SHIPMENT_CHECK_DATE_NOTE}"

    def parse(self, csv_path):
        try:
            with open(csv_path, newline="", encoding="utf-8-sig") as f:
                rows = list(csv.reader(f))
        except OSError as e:
            raise CommandError(f"Could not read {csv_path}: {e}")

        # The sheet starts with a few "Details to be filled by ..." rows before the header.
        header_row = next((i for i, row in enumerate(rows) if row and row[0].strip() == COL_ORDER_NUMBER), None)
        if header_row is None:
            raise CommandError(f"Could not find the header row (first cell '{COL_ORDER_NUMBER}') in {csv_path}")
        idx = {" ".join(name.split()): i for i, name in enumerate(rows[header_row])}
        required = [COL_ORDER_NUMBER, COL_CATEGORY, COL_VENDOR, COL_SKU, COL_PRODUCT_NAME, COL_PRODUCT_QTY,
                    COL_TOTAL_QTY, COL_DELIVERY_MONTH, COL_ORDER_STATUS, COL_PO_NUMBER, COL_FOB_COST,
                    COL_TENTATIVE_SHIP_DATE, COL_BALANCE_QTY]
        required += [c for columns in STATE_DATE_COLUMNS.values() for c in columns]
        missing = [c for c in required if c not in idx]
        if missing:
            raise CommandError(f"CSV header (row {header_row + 1}) is missing column(s): {missing}")

        # Orders keyed by the parent's external_id.
        orders = {}
        block_key = None
        block_key_counts = defaultdict(int)
        for sheet_row, row in enumerate(rows[header_row + 1:], start=header_row + 2):
            if not any(c.strip() for c in row):
                continue
            row = row + [""] * (len(rows[header_row]) - len(row))
            cell = lambda column: row[idx[column]].strip()  # noqa: E731

            order_number = cell(COL_ORDER_NUMBER)
            month = cell(COL_DELIVERY_MONTH)
            if order_number:
                block_key = None
                key = f"{order_number}|{month}"
                if key not in orders:
                    orders[key] = self._new_order(key, order_number, month, sheet_row, cell(COL_TOTAL_QTY))
            else:
                if cell(COL_TOTAL_QTY) or block_key is None:
                    base = "|".join(["no-order", cell(COL_VENDOR), cell(COL_PO_NUMBER), cell(COL_ORDER_PLACED_DATE),
                                     month, cell(COL_SKU)])
                    block_key_counts[base] += 1
                    block_key = base if block_key_counts[base] == 1 else f"{base}#{block_key_counts[base]}"
                    # Created even if this first row is skipped below, so the block's
                    # TOTAL QTTY still applies to its remaining rows.
                    orders[block_key] = self._new_order(block_key, "", month, sheet_row, cell(COL_TOTAL_QTY))
                key = block_key

            order_status = cell(COL_ORDER_STATUS)
            if order_status.lower() in SKIPPED_ORDER_STATUSES:
                continue
            sku = cell(COL_SKU)
            label = f"sheet row {sheet_row} / {sku}"
            state_name = ORDER_STATUS_TO_STATE.get(order_status.lower())
            if state_name is None:
                self.warn(label, f"unknown Order Status {order_status!r} - sub-item gets the project's default state")
            qty_raw = cell(COL_PRODUCT_QTY).replace(",", "")
            qty = int(qty_raw) if qty_raw.isdigit() else 0
            entered_dates, target_dates, tentative_ship_date = self.parse_state_dates(row, idx, label)
            orders[key]["rows"].append(
                {
                    "category": cell(COL_CATEGORY),
                    "vendor": cell(COL_VENDOR),
                    "sku": sku,
                    "product_name": cell(COL_PRODUCT_NAME),
                    "qty": qty,
                    "state_name": state_name,
                    "po_number": cell(COL_PO_NUMBER),
                    "fob_price": self.parse_price(cell(COL_FOB_COST), label),
                    "entered_dates": entered_dates,
                    "target_dates": target_dates,
                    "tentative_ship_date": tentative_ship_date,
                    "shipment": self.parse_shipment(row, idx, qty, label),
                }
            )

        return [self._finish_order(order) for order in orders.values() if order["rows"]]

    def _new_order(self, external_id, order_number, month, sheet_row, total_qty_raw):
        return {
            "external_id": external_id,
            "order_number": order_number,
            "month": month,
            "sheet_row": sheet_row,
            "total_qty": parse_smallest_quantity(total_qty_raw),
            "rows": [],
        }

    def _finish_order(self, order):
        order["requested_delivery_date"] = parse_month_to_date(order["month"]) if order["month"] else None
        if order["month"] and order["requested_delivery_date"] is None:
            self.warn(f"sheet row {order['sheet_row']}", f"couldn't parse '{COL_DELIVERY_MONTH}' value "
                                                         f"{order['month']!r} - requested delivery date left blank")
        first = order["rows"][0]
        order["category"] = first["category"]
        order["vendor"] = first["vendor"]
        order["title"] = f"{first['category']} - {first['vendor']} - {order['total_qty']} units"
        order_number_text = order["order_number"] or "(none in sheet)"
        sku_lines = "".join(f"<li>{r['sku']} ({r['product_name']}): {r['qty']}</li>" for r in order["rows"])
        order["description_html"] = (
            f"<p>Order Number: {order_number_text}</p><p>Vendor: {first['vendor']}</p>"
            f"<p>Requested Delivery Month: {order['month']}</p><p>SKU-wise quantities:</p><ul>{sku_lines}</ul>"
        )
        # A SKU can repeat within an order (e.g. several "TBD" rows); number the
        # repeats ("TBD#2") so each sub-item still gets its own external_id.
        sku_counts = defaultdict(int)
        for r in order["rows"]:
            sku_counts[r["sku"]] += 1
            sku_key = r["sku"] if sku_counts[r["sku"]] == 1 else f"{r['sku']}#{sku_counts[r['sku']]}"
            r["external_id"] = f"{order['external_id']}|{sku_key}"
            r["title"] = f"{r['sku']} - {r['qty']} units"
            r["description_html"] = f"<p>Order Number: {order_number_text}</p><p>Product: {r['product_name']}</p>"
        return order


class Command(BaseCommand):
    help = (
        "Load the Master Production Sheet CSV into a project as order work items (a parent per order, a "
        "sub work item per SKU) with their Order Details, state, TNA entered/target dates and shipments. "
        "Safe to re-run: items are matched by external_id and updated, not duplicated. Runs as a dry run "
        "by default; pass --apply to write."
    )

    def add_arguments(self, parser):
        parser.add_argument("csv_path", help="The sheet exported as CSV.")
        parser.add_argument("--project", dest="project_id", required=True, help="Id of the project to load into.")
        parser.add_argument(
            "--created-by",
            dest="created_by_email",
            default=None,
            help="Email of the user to record as creator of new work items (default: none).",
        )
        parser.add_argument("--apply", action="store_true", help="Write the changes. Without this flag, nothing is written.")
        parser.add_argument("--verbose-plan", action="store_true", help="Print every planned work item and its dates.")

    def handle(self, *args, **options):
        try:
            project = Project.objects.get(pk=options["project_id"])
        except (Project.DoesNotExist, ValueError):
            raise CommandError(f"Project {options['project_id']} not found.")

        created_by = None
        if options["created_by_email"]:
            created_by = User.objects.filter(email=options["created_by_email"]).first()
            if created_by is None:
                raise CommandError(f"No user with email {options['created_by_email']}.")

        parser = SheetParser(today=timezone.localdate())
        orders = parser.parse(options["csv_path"])

        states = {s.name.strip().lower(): s for s in State.objects.filter(project=project)}
        needed = set(ORDER_STATUS_TO_STATE.values()) | set(STATE_DATE_COLUMNS) | {TENTATIVE_SHIP_STATE}
        missing_states = sorted(s for s in needed if s.lower() not in states)
        if missing_states:
            raise CommandError(f"These states don't exist in project {project.name!r}: {missing_states}")
        default_state = next((s for s in states.values() if s.default), None)

        vendors = {v.name.strip().lower(): v for v in Vendor.objects.filter(workspace_id=project.workspace_id)}
        unmatched_vendors = sorted({o["vendor"] for o in orders if o["vendor"] and o["vendor"].lower() not in vendors})

        existing = {
            issue.external_id: issue
            for issue in Issue.objects.filter(project=project, external_source=EXTERNAL_SOURCE)
        }
        sub_items = [r for o in orders for r in o["rows"]]

        # Product master: a sub-item's SKU is its style; an order's category is added to
        # the master if it's new.
        styles = {
            s.code.strip().lower(): s
            for s in Style.objects.filter(workspace_id=project.workspace_id).order_by("created_at")
        }
        categories = {
            c.name.strip().lower(): c for c in ProductCategory.objects.filter(workspace_id=project.workspace_id)
        }
        fits = {
            (f.category.name.strip().lower(), f.name.strip().lower()): f
            for f in ProductFit.objects.filter(workspace_id=project.workspace_id).select_related("category")
        }
        new_style_codes = sorted({
            r["sku"] for r in sub_items if self._style_code(r["sku"]) and r["sku"].strip().lower() not in styles
        }, key=str.lower)
        new_categories = sorted({
            o["category"] for o in orders if o["category"] and o["category"].strip().lower() not in categories
        }, key=str.lower)
        skipped_skus = sorted({r["sku"] for r in sub_items if not self._style_code(r["sku"])})

        self.stdout.write(f"Project: {project.name} ({project.id})")
        self.stdout.write(
            f"Orders: {len(orders)} ({sum(1 for o in orders if not o['order_number'])} without an order number), "
            f"SKU sub-items: {len(sub_items)}"
        )
        self.stdout.write(
            f"  Already in the project (will be updated, not re-created): "
            f"{sum(1 for o in orders if o['external_id'] in existing)} order(s), "
            f"{sum(1 for r in sub_items if r['external_id'] in existing)} sub-item(s)"
        )
        existing_parents = [existing[o["external_id"]] for o in orders if o["external_id"] in existing]
        missing_dates = [
            item for item in orders + sub_items
            if item["external_id"] in existing and existing[item["external_id"]].target_date is None
            and (item["rows"][0] if "rows" in item else item)["tentative_ship_date"]
        ]
        self.stdout.write(
            f"    of those, parents still in the default state (will take their first SKU's state): "
            f"{sum(1 for p in existing_parents if default_state and p.state_id == default_state.id)}; "
            f"work items getting a vendor promised delivery date: {len(missing_dates)}"
        )
        state_counts = defaultdict(int)
        for r in sub_items:
            state_counts[r["state_name"]] += 1
        self.stdout.write("  Sub-item states: " + ", ".join(f"{k}: {v}" for k, v in sorted(state_counts.items(), key=str)))
        self.stdout.write(
            f"  TNA entered dates: {sum(len(r['entered_dates']) for r in sub_items)}, "
            f"target dates: {sum(len(r['target_dates']) for r in sub_items)}, "
            f"shipments: {sum(1 for r in sub_items if r['shipment'])}"
        )
        self.stdout.write(
            f"  Styles to create: {len(new_style_codes)}; categories to add to the product master: "
            f"{new_categories or 'none'}"
        )
        if skipped_skus:
            self.stdout.write(f"  SKUs that aren't a style id (no style set): {skipped_skus}")
        if options["verbose_plan"]:
            self._print_plan(orders)
        if unmatched_vendors:
            self.stdout.write(self.style.WARNING(
                f"Vendors not found in the workspace (vendor left blank on their items - create them first): "
                f"{unmatched_vendors}"
            ))
        if parser.warnings:
            self.stdout.write(self.style.WARNING(f"{len(parser.warnings)} cell(s) couldn't be used:"))
            for warning in parser.warnings:
                self.stdout.write(f"    {warning}")

        if not options["apply"]:
            self.stdout.write(self.style.NOTICE("Dry run only - nothing was written. Re-run with --apply to commit."))
            return

        default_type = IssueType.objects.filter(project_issue_types__project_id=project.id, is_default=True).first()
        counts = defaultdict(int)
        with transaction.atomic():
            for name in new_categories:
                categories[name.strip().lower()] = ProductCategory.objects.create(
                    workspace_id=project.workspace_id, name=name.strip()
                )
                counts["product master categories added"] += 1
            for order in orders:
                vendor = vendors.get(order["vendor"].lower())
                # The parent takes its first SKU's state and vendor promised delivery date.
                first_row = order["rows"][0]
                first_state = states.get(first_row["state_name"].lower()) if first_row["state_name"] else None
                parent = self._get_or_create_issue(
                    project, existing, order, parent=None, state=first_state,
                    target_date=first_row["tentative_ship_date"], issue_type=default_type,
                    created_by=created_by, counts=counts,
                )
                parent_detail = self._set_order_detail(
                    parent,
                    order_number=order["order_number"],
                    category=order["category"],
                    vendor=vendor,
                    quantity=order["total_qty"],
                    requested_delivery_date=order["requested_delivery_date"],
                )
                first_sub = None
                for r in order["rows"]:
                    state = states.get(r["state_name"].lower()) if r["state_name"] else None
                    sub = self._get_or_create_issue(
                        project, existing, r, parent=parent, state=state,
                        target_date=r["tentative_ship_date"], issue_type=default_type,
                        created_by=created_by, counts=counts,
                    )
                    first_sub = first_sub or sub
                    sub_detail = self._set_order_detail(
                        sub,
                        order_number=order["order_number"],
                        # a sub-item's fit and category are always its parent's (the parent's
                        # fit is only ever set in the app)
                        fit=parent_detail.fit,
                        category=parent_detail.category,
                        vendor=vendor,
                        quantity=r["qty"],
                        requested_delivery_date=order["requested_delivery_date"],
                        purchase_order_number=r["po_number"],
                        fob_price=r["fob_price"],
                    )
                    self._set_style(sub_detail, r["sku"], styles, fits, project, counts)
                    for state_name, target_date in r["target_dates"].items():
                        self._set_state_target(sub, states[state_name.lower()], target_date=target_date)
                        counts["target dates"] += 1
                    for state_name, entered_date in r["entered_dates"].items():
                        entered_at = timezone.make_aware(datetime.combine(entered_date, time.min))
                        self._set_state_target(sub, states[state_name.lower()], entered_at=entered_at)
                        counts["entered dates"] += 1
                    if r["shipment"]:
                        counts[self._log_shipment(sub, *r["shipment"])] += 1

                # A parent still in the project's default state (e.g. one created by an
                # earlier run, before parents got a state) moves to its first SKU's
                # current state. A parent someone has already moved is left alone.
                if (
                    default_state is not None
                    and parent.state_id == default_state.id
                    and first_sub.state_id != parent.state_id
                ):
                    parent.state_id = first_sub.state_id
                    parent.save(update_fields=["state", "updated_at"])
                    counts["parent states set"] += 1

        self.stdout.write(self.style.SUCCESS("Done: " + ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))))

    def _print_plan(self, orders):
        for order in orders:
            self.stdout.write(
                f"\n  [{order['order_number'] or 'no order number'}, sheet row {order['sheet_row']}] {order['title']}"
                f"  (requested delivery {order['requested_delivery_date']})"
            )
            for r in order["rows"]:
                self.stdout.write(
                    f"      + {r['title']}  state={r['state_name']}  po={r['po_number']!r}  fob={r['fob_price']}"
                )
                for state_name, d in r["entered_dates"].items():
                    self.stdout.write(f"          TNA {state_name}: entered {d}")
                for state_name, d in r["target_dates"].items():
                    self.stdout.write(f"          TNA {state_name}: target {d}")
                if r["shipment"]:
                    self.stdout.write(f"          shipment: {r['shipment'][1]} on {r['shipment'][0]} ({r['shipment'][2]})")

    def _get_or_create_issue(self, project, existing, item, parent, state, target_date, issue_type, created_by, counts):
        """An existing work item is renamed/re-parented to match the sheet, and gets the
        sheet's vendor promised delivery date (Issue.target_date) only if it has none -
        its state and any date set in the app are left alone, so a re-run never undoes
        someone's work."""
        issue = existing.get(item["external_id"])
        kind = "sub-items" if parent else "orders"
        if issue is not None:
            changed = []
            if issue.name != item["title"]:
                issue.name = item["title"]
                changed.append("name")
            if parent is not None and issue.parent_id != parent.id:
                issue.parent = parent
                changed.append("parent")
            if target_date and issue.target_date is None:
                issue.target_date = target_date
                changed.append("target_date")
                counts["vendor promised dates filled in"] += 1
            if changed:
                issue.save(update_fields=changed + ["updated_at"])
            counts[f"{kind} updated"] += 1
            return issue

        issue = Issue(
            project=project,
            name=item["title"],
            description_html=item["description_html"],
            parent=parent,
            state=state,
            target_date=target_date,
            type=issue_type,
            external_source=EXTERNAL_SOURCE,
            external_id=item["external_id"],
        )
        # Issue.save() assigns the sequence id and sort order; the post_save signals
        # create the OrderDetail row and stamp entered_at = now on the initial state
        # (overwritten below when the sheet has a date for that state).
        issue.save(created_by_id=created_by.id if created_by else None)
        existing[item["external_id"]] = issue
        counts[f"{kind} created"] += 1
        return issue

    @staticmethod
    def _style_code(sku):
        """The SKU as a style id, or None for blanks and placeholders like "TBD"."""
        code = (sku or "").strip()
        if not code or code.lower() in PLACEHOLDER_SKUS or len(code) > STYLE_CODE_MAX_LENGTH:
            return None
        return code

    def _set_style(self, order_detail, sku, styles, fits, project, counts):
        """Sets the sub-item's style from its SKU, creating the style if the workspace
        doesn't have it (under the parent's fit, when that fit is in the product master).
        A style already set - by an earlier run or in the app - is left alone."""
        code = self._style_code(sku)
        if code is None or order_detail.style_id:
            return
        style = styles.get(code.lower())
        if style is None:
            fit = fits.get((order_detail.category.strip().lower(), order_detail.fit.strip().lower()))
            style = Style.objects.create(workspace_id=project.workspace_id, code=code, name=code, fit=fit)
            styles[code.lower()] = style
            counts["styles created"] += 1
        order_detail.style = style
        order_detail.save(update_fields=["style", "updated_at"], disable_auto_set_user=True)
        counts["sub-item styles set"] += 1

    def _set_order_detail(self, issue, **fields):
        order_detail, _ = OrderDetail.objects.get_or_create(issue=issue, defaults={"project_id": issue.project_id})
        for name, value in fields.items():
            if name == "quantity" and not value:
                continue  # a blank sheet quantity; OrderDetail.quantity must be at least 1
            if value in (None, "") and name not in ("order_number",):
                continue
            setattr(order_detail, name, value)
        # There's no request user here, and BaseModel.save() would otherwise blank out
        # created_by on an OrderDetail someone created through the app.
        order_detail.save(disable_auto_set_user=True)
        return order_detail

    def _set_state_target(self, issue, state, **fields):
        target, created = TaskStateTarget.objects.get_or_create(
            issue=issue, state=state, defaults={"project_id": issue.project_id, **fields}
        )
        if not created:
            for name, value in fields.items():
                setattr(target, name, value)
            target.save(update_fields=list(fields) + ["updated_at"])

    def _log_shipment(self, issue, shipped_date, quantity, note):
        """Returns the counts key for what happened. There is no update for shipments,
        so a sheet shipment that has changed since the last run is left for a person."""
        sheet_shipments = list(IssueShipment.objects.filter(issue=issue, note__startswith=SHIPMENT_NOTE))
        if any(s.shipped_date == shipped_date and s.quantity == quantity for s in sheet_shipments):
            return "shipments already logged"
        if sheet_shipments:
            self.stdout.write(self.style.WARNING(
                f"    {issue.external_id}: already has a sheet shipment that differs from {quantity} on "
                f"{shipped_date} - not logging another; fix it by hand"
            ))
            return "shipments differing (left alone)"
        IssueShipment.objects.create(
            issue=issue, project_id=issue.project_id, shipped_date=shipped_date, quantity=quantity, note=note
        )
        return "shipments logged"
