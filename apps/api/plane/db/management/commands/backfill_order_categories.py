# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Django imports
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

# Module imports
from plane.db.models import Issue, OrderDetail, Vendor

# Every existing work item title was written by hand in this exact shape, e.g.
# "Cotton T-Shirts - Acme Garments - 500 units". This command is a one-time
# backfill that parses that shape into OrderDetail.category/vendor/quantity
# ahead of the create/edit modal switching from a free-form title to separate
# category + quantity fields. It never modifies Issue.name itself.
QUANTITY_PATTERN = re.compile(r"^(\d+)\s*units?$", re.IGNORECASE)


class Command(BaseCommand):
    help = (
        "One-time backfill of OrderDetail.category/vendor/quantity from existing work item "
        "titles of the form '{category} - {vendor} - {quantity} units'. Runs as a dry run by "
        "default (reports what it would change, writes nothing); pass --apply to commit."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the parsed values. Without this flag, nothing is written.",
        )
        parser.add_argument(
            "--workspace",
            dest="workspace_slug",
            default=None,
            help="Restrict the backfill to a single workspace slug (default: every workspace).",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        workspace_slug = options.get("workspace_slug")

        issues = Issue.objects.filter(deleted_at__isnull=True).select_related("order_detail")
        if workspace_slug:
            issues = issues.filter(workspace__slug=workspace_slug)

        # Skip issues that already have a category, whether from an earlier run of this
        # command or because someone has already re-saved them through the new form.
        # order_detail is a reverse one-to-one, so issues with no OrderDetail row at all
        # produce a NULL on the joined category column. `.exclude(category__gt="")` would
        # silently drop those rows too (NULL > '' is unknown, and NOT unknown is still
        # unknown, so Postgres's WHERE excludes them) - which is most legacy issues, since
        # they never had an OrderDetail row created. Filter explicitly for "no row yet" or
        # "row exists but category is blank" instead.
        issues = issues.filter(Q(order_detail__isnull=True) | Q(order_detail__category=""))

        # One vendor lookup per workspace instead of one query per issue.
        vendors_by_workspace: dict[str, dict[str, Vendor]] = {}

        def find_vendor(workspace_id, vendor_name):
            if workspace_id not in vendors_by_workspace:
                vendors_by_workspace[workspace_id] = {
                    vendor.name.strip().lower(): vendor for vendor in Vendor.objects.filter(workspace_id=workspace_id)
                }
            return vendors_by_workspace[workspace_id].get(vendor_name.strip().lower())

        scanned = 0
        fully_parsed = 0
        to_update: list[OrderDetail] = []
        to_create: list[tuple[Issue, str, Vendor | None, int | None]] = []
        unmatched_vendors: set[tuple[str, str]] = set()
        unparsed_quantities: list[tuple[str, str]] = []

        for issue in issues.iterator():
            scanned += 1
            title = (issue.name or "").strip()
            # rsplit from the right, maxsplit=2, so we always peel off exactly the last
            # two segments as vendor and quantity. Category names can themselves contain
            # " - " (e.g. "Steel Rods - Cold Rolled"), and a left-anchored split() would
            # mistake that embedded hyphen for the category/vendor boundary, shifting
            # everything after it out of place. Vendor names and the quantity segment are
            # never themselves hyphenated, so anchoring from the back is unambiguous.
            parts = [part.strip() for part in title.rsplit(" - ", 2)]

            category = parts[0] if parts and parts[0] else title
            vendor_name = parts[1] if len(parts) > 1 and parts[1] else None
            quantity_part = parts[2] if len(parts) > 2 and parts[2] else None

            vendor = None
            if vendor_name:
                vendor = find_vendor(issue.workspace_id, vendor_name)
                if vendor is None:
                    unmatched_vendors.add((str(issue.workspace_id), vendor_name))

            quantity = None
            if quantity_part:
                match = QUANTITY_PATTERN.match(quantity_part)
                if match:
                    quantity = int(match.group(1))
                else:
                    unparsed_quantities.append((str(issue.id), title))

            if len(parts) == 3 and vendor is not None and quantity is not None:
                fully_parsed += 1

            order_detail = getattr(issue, "order_detail", None)
            if order_detail is None:
                # Legacy issues created before the vendor/order feature shipped may never
                # have had an OrderDetail row lazily created for them.
                to_create.append((issue, category, vendor, quantity))
            else:
                order_detail.category = category
                order_detail.vendor = vendor
                order_detail.quantity = quantity
                to_update.append(order_detail)

        self.stdout.write(f"Scanned {scanned} work item(s) without a category set yet.")
        self.stdout.write(f"  Fully parsed (category + known vendor + quantity): {fully_parsed}")
        self.stdout.write(f"  Partially parsed (category only, missing/unmatched vendor or quantity): "
                           f"{scanned - fully_parsed}")
        self.stdout.write(f"  Missing an OrderDetail row entirely (will be created): {len(to_create)}")

        if unmatched_vendors:
            self.stdout.write(
                self.style.WARNING(
                    f"{len(unmatched_vendors)} distinct vendor name(s) parsed out of a title didn't match any "
                    "existing Vendor row (category/quantity are still backfilled; vendor is left blank):"
                )
            )
            for workspace_id, name in sorted(unmatched_vendors, key=lambda pair: pair[1])[:50]:
                self.stdout.write(f'    workspace={workspace_id}  vendor="{name}"')
            if len(unmatched_vendors) > 50:
                self.stdout.write(f"    ...and {len(unmatched_vendors) - 50} more")

        if unparsed_quantities:
            self.stdout.write(
                self.style.WARNING(
                    f"{len(unparsed_quantities)} title(s) had a third segment that wasn't '<number> units' "
                    "(category/vendor are still backfilled; quantity is left blank):"
                )
            )
            for issue_id, title in unparsed_quantities[:50]:
                self.stdout.write(f'    issue={issue_id}  title="{title}"')
            if len(unparsed_quantities) > 50:
                self.stdout.write(f"    ...and {len(unparsed_quantities) - 50} more")

        if not apply_changes:
            self.stdout.write(self.style.NOTICE("Dry run only - nothing was written. Re-run with --apply to commit."))
            return

        with transaction.atomic():
            OrderDetail.objects.bulk_update(to_update, ["category", "vendor", "quantity"], batch_size=500)
            for issue, category, vendor, quantity in to_create:
                OrderDetail.objects.create(
                    issue=issue,
                    project_id=issue.project_id,
                    category=category,
                    vendor=vendor,
                    quantity=quantity,
                )

        self.stdout.write(self.style.SUCCESS(f"Backfilled {len(to_update) + len(to_create)} OrderDetail row(s)."))
