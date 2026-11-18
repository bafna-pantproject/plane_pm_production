# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The planning half of migration 0137, which moves sub work items' style id out of their
category text and copies the parent's fit/category onto them. No database needed."""

from importlib import import_module

import pytest

plan = import_module("plane.db.migrations.0137_sub_item_styles_from_category").plan_sub_item_backfill

WS = "ws-1"
PARENT = "parent-1"


def sub_item(id_="sub-1", category="TS-1042", fit="", style_id=None, parent_id=PARENT, workspace_id=WS):
    return {
        "id": id_,
        "workspace_id": workspace_id,
        "parent_id": parent_id,
        "category": category,
        "fit": fit,
        "style_id": style_id,
    }


@pytest.mark.unit
class TestSubItemStyleBackfill:
    def test_creates_a_style_from_the_category_and_copies_the_parents_fit_and_category(self):
        updates, new_styles, style_fits = plan(
            [sub_item()], {PARENT: ("Slim Fit", "T-Shirts")}, {}, set(), {}
        )
        assert updates == {"sub-1": {"style_key": (WS, "ts-1042"), "fit": "Slim Fit", "category": "T-Shirts"}}
        assert new_styles == {(WS, "ts-1042"): "TS-1042"}
        assert style_fits == {}

    def test_reuses_an_existing_style_ignoring_case(self):
        updates, new_styles, _ = plan(
            [sub_item(category=" ts-1042 ")],
            {PARENT: ("", "T-Shirts")},
            {(WS, "ts-1042"): ("style-1", None)},
            set(),
            {},
        )
        assert updates["sub-1"]["style_key"] == (WS, "ts-1042")
        assert new_styles == {}

    def test_one_new_style_per_code_across_sub_items(self):
        _, new_styles, _ = plan(
            [sub_item("a", "TS-1"), sub_item("b", "ts-1"), sub_item("c", "TS-2")],
            {PARENT: ("", "T-Shirts")},
            {},
            set(),
            {},
        )
        assert new_styles == {(WS, "ts-1"): "TS-1", (WS, "ts-2"): "TS-2"}

    @pytest.mark.parametrize("category", ["", "  ", "TBD", "n/a", "T-Shirts", "Jeans", "x" * 101])
    def test_values_that_are_not_style_ids_get_no_style(self, category):
        updates, new_styles, _ = plan(
            [sub_item(category=category)], {PARENT: ("", "T-Shirts")}, {}, {(WS, "jeans")}, {}
        )
        # "T-Shirts" already matches the parent, so that sub-item needs no update at all
        change = updates.get("sub-1", {"style_key": None, "category": "T-Shirts"})
        assert change["style_key"] is None
        assert change["category"] == "T-Shirts"
        assert new_styles == {}

    def test_a_sub_item_that_already_has_a_style_keeps_it(self):
        updates, new_styles, _ = plan(
            [sub_item(style_id="style-9")], {PARENT: ("", "T-Shirts")}, {}, set(), {}
        )
        assert updates["sub-1"]["style_key"] is None
        assert new_styles == {}

    def test_without_parent_order_details_fit_and_category_stay_but_the_style_is_still_set(self):
        updates, new_styles, _ = plan([sub_item(fit="Regular")], {}, {}, set(), {})
        assert updates["sub-1"] == {"style_key": (WS, "ts-1042"), "fit": "Regular", "category": "TS-1042"}
        assert new_styles == {(WS, "ts-1042"): "TS-1042"}

    def test_an_already_correct_sub_item_is_not_updated(self):
        updates, _, _ = plan(
            [sub_item(category="T-Shirts", fit="Slim Fit", style_id="style-1")],
            {PARENT: ("Slim Fit", "T-Shirts")},
            {},
            set(),
            {},
        )
        assert updates == {}

    def test_style_goes_under_the_fit_its_parents_use_most(self):
        parents = {"p1": ("Slim Fit", "T-Shirts"), "p2": ("Slim Fit", "T-Shirts"), "p3": ("Boxy", "T-Shirts")}
        fit_ids = {(WS, "t-shirts", "slim fit"): "fit-slim", (WS, "t-shirts", "boxy"): "fit-boxy"}
        _, _, style_fits = plan(
            [sub_item("a", parent_id="p1"), sub_item("b", parent_id="p2"), sub_item("c", parent_id="p3")],
            parents,
            {},
            set(),
            fit_ids,
        )
        assert style_fits == {(WS, "ts-1042"): "fit-slim"}

    def test_a_style_already_under_a_fit_is_not_moved(self):
        _, _, style_fits = plan(
            [sub_item()],
            {PARENT: ("Slim Fit", "T-Shirts")},
            {(WS, "ts-1042"): ("style-1", "fit-other")},
            set(),
            {(WS, "t-shirts", "slim fit"): "fit-slim"},
        )
        assert style_fits == {}

    def test_fits_not_in_the_product_master_link_nothing(self):
        _, _, style_fits = plan([sub_item()], {PARENT: ("Slim Fit", "T-Shirts")}, {}, set(), {})
        assert style_fits == {}

    def test_styles_are_per_workspace(self):
        _, new_styles, _ = plan(
            [sub_item("a", workspace_id="ws-1"), sub_item("b", workspace_id="ws-2")],
            {PARENT: ("", "T-Shirts")},
            {("ws-1", "ts-1042"): ("style-1", None)},
            set(),
            {},
        )
        assert new_styles == {("ws-2", "ts-1042"): "TS-1042"}
