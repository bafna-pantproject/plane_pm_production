# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, OrderDetail, Project, State, TaskStateTarget


@pytest.fixture
def project(db, workspace, create_user):
    return Project.objects.create(
        name="Garment Orders",
        identifier="GAR",
        workspace=workspace,
        created_by=create_user,
    )


@pytest.fixture
def stages(project):
    """Three production stages: Cutting -> Stitching -> Done (completed)."""
    cutting = State.objects.create(
        name="Cutting", project=project, workspace=project.workspace, group="backlog", sequence=15000
    )
    stitching = State.objects.create(
        name="Stitching", project=project, workspace=project.workspace, group="started", sequence=30000
    )
    done = State.objects.create(
        name="Done", project=project, workspace=project.workspace, group="completed", sequence=45000
    )
    return {"cutting": cutting, "stitching": stitching, "done": done}


@pytest.mark.unit
class TestOrderDetailLifecycle:
    @pytest.mark.django_db
    def test_order_detail_is_created_automatically_with_the_issue(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        assert OrderDetail.objects.filter(issue=issue).exists()


@pytest.mark.unit
class TestOrderDetailAndTNAPlanTrickleDown:
    """A new sub-issue created directly under a parent (parent set at creation
    time) seeds its vendor, order number, and TNA plan (per-state targets) from
    the parent's — a one-time copy at creation, not an ongoing link."""

    @pytest.mark.django_db
    def test_new_sub_issue_inherits_vendor_and_order_number_from_parent(self, project, stages, create_user, workspace):
        from plane.db.models import Vendor

        vendor = Vendor.objects.create(name="Denim Kreations", workspace=workspace)
        parent = Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        OrderDetail.objects.filter(issue=parent).update(vendor=vendor, order_number="PO-100")

        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=stages["cutting"],
            parent=parent,
            created_by=create_user,
        )

        child_order_detail = OrderDetail.objects.get(issue=child)
        assert child_order_detail.vendor_id == vendor.id
        assert child_order_detail.order_number == "PO-100"

    @pytest.mark.django_db
    def test_new_sub_issue_inherits_tna_plan_target_dates_from_parent(self, project, stages, create_user):
        parent = Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        TaskStateTarget.objects.create(
            issue=parent, state=stages["stitching"], project=project, target_date="2026-01-15"
        )

        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=stages["cutting"],
            parent=parent,
            created_by=create_user,
        )

        child_target = TaskStateTarget.objects.get(issue=child, state=stages["stitching"])
        assert str(child_target.target_date) == "2026-01-15"
        assert child_target.entered_at is None

    @pytest.mark.django_db
    def test_child_created_directly_into_a_targeted_state_gets_entered_at_backfilled(self, project, stages, create_user):
        parent = Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        TaskStateTarget.objects.create(issue=parent, state=stages["cutting"], project=project, target_date="2026-01-15")

        # child is created straight into "cutting" - the same state the parent has a target for
        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=stages["cutting"],
            parent=parent,
            created_by=create_user,
        )

        child_target = TaskStateTarget.objects.get(issue=child, state=stages["cutting"])
        assert child_target.entered_at is not None

    @pytest.mark.django_db
    def test_editing_child_after_creation_does_not_affect_parent(self, project, stages, create_user, workspace):
        from plane.db.models import Vendor

        vendor = Vendor.objects.create(name="Denim Kreations", workspace=workspace)
        other_vendor = Vendor.objects.create(name="Ultra Denim", workspace=workspace)
        parent = Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        OrderDetail.objects.filter(issue=parent).update(vendor=vendor)
        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=stages["cutting"],
            parent=parent,
            created_by=create_user,
        )

        OrderDetail.objects.filter(issue=child).update(vendor=other_vendor)

        parent_order_detail = OrderDetail.objects.get(issue=parent)
        assert parent_order_detail.vendor_id == vendor.id

    @pytest.mark.django_db
    def test_reparenting_an_existing_issue_does_not_trickle_down(self, project, stages, create_user, workspace):
        from plane.db.models import Vendor

        vendor = Vendor.objects.create(name="Denim Kreations", workspace=workspace)
        parent = Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        OrderDetail.objects.filter(issue=parent).update(vendor=vendor, order_number="PO-100")

        existing_issue = Issue.objects.create(
            name="Existing order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )

        # re-parenting is an update, not a creation - should not trickle down
        existing_issue.parent = parent
        existing_issue.save()

        existing_order_detail = OrderDetail.objects.get(issue=existing_issue)
        assert existing_order_detail.vendor_id is None
        assert existing_order_detail.order_number == ""

    @pytest.mark.django_db
    def test_top_level_issue_without_parent_gets_no_trickle_down(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Standalone order", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        order_detail = OrderDetail.objects.get(issue=issue)
        assert order_detail.vendor_id is None
        assert order_detail.order_number == ""
        assert not TaskStateTarget.objects.filter(issue=issue).exists()


@pytest.mark.unit
class TestTaskStateTargetLifecycle:
    @pytest.mark.django_db
    def test_setting_a_target_for_the_current_state_does_not_backfill_entered_at(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        target = TaskStateTarget.objects.create(issue=issue, state=stages["cutting"], project=project)
        assert target.entered_at is None

    @pytest.mark.django_db
    def test_transitioning_into_a_targeted_state_sets_entered_at(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        target = TaskStateTarget.objects.create(issue=issue, state=stages["stitching"], project=project)
        assert target.entered_at is None

        issue.state = stages["stitching"]
        issue.save()

        target.refresh_from_db()
        assert target.entered_at is not None

    @pytest.mark.django_db
    def test_transitioning_into_a_state_with_no_target_creates_no_row(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        issue.state = stages["stitching"]
        issue.save()

        assert not TaskStateTarget.objects.filter(issue=issue, state=stages["stitching"]).exists()

    @pytest.mark.django_db
    def test_reentering_a_targeted_state_overwrites_entered_at(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        target = TaskStateTarget.objects.create(issue=issue, state=stages["cutting"], project=project)

        issue.state = stages["stitching"]
        issue.save()
        issue.state = stages["cutting"]
        issue.save()

        target.refresh_from_db()
        first_entry = target.entered_at
        assert first_entry is not None

        issue.state = stages["stitching"]
        issue.save()
        issue.state = stages["cutting"]
        issue.save()

        target.refresh_from_db()
        assert target.entered_at is not None
        assert target.entered_at >= first_entry

    @pytest.mark.django_db
    def test_saving_issue_without_changing_state_does_not_touch_entered_at(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["stitching"], created_by=create_user
        )
        target = TaskStateTarget.objects.create(issue=issue, state=stages["stitching"], project=project)
        issue.state = stages["cutting"]
        issue.save()
        issue.state = stages["stitching"]
        issue.save()
        target.refresh_from_db()
        original_entered_at = target.entered_at
        assert original_entered_at is not None

        issue.name = "Order 1 (renamed)"
        issue.save()

        target.refresh_from_db()
        assert target.entered_at == original_entered_at
