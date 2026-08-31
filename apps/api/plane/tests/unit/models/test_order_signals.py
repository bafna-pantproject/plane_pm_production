# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Issue, OrderDetail, Project, StageLeadTime, State


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
    """Three production stages: Cutting (2d) -> Stitching (3d) -> Done (completed)."""
    cutting = State.objects.create(
        name="Cutting", project=project, workspace=project.workspace, group="backlog", sequence=15000
    )
    stitching = State.objects.create(
        name="Stitching", project=project, workspace=project.workspace, group="started", sequence=30000
    )
    done = State.objects.create(
        name="Done", project=project, workspace=project.workspace, group="completed", sequence=45000
    )

    StageLeadTime.objects.filter(state=cutting).update(lead_time_days=2)
    StageLeadTime.objects.filter(state=stitching).update(lead_time_days=3)
    # "done" keeps its auto-seeded default of 1 day; irrelevant since it's terminal.

    return {"cutting": cutting, "stitching": stitching, "done": done}


@pytest.mark.unit
class TestStageLeadTimeSeeding:
    @pytest.mark.django_db
    def test_every_new_state_gets_a_default_lead_time(self, project):
        state = State.objects.create(
            name="QC", project=project, workspace=project.workspace, group="started", sequence=20000
        )
        lead_time = StageLeadTime.objects.get(state=state)
        assert lead_time.lead_time_days == 1
        assert lead_time.project_id == project.id


@pytest.mark.unit
class TestOrderDetailLifecycle:
    @pytest.mark.django_db
    def test_order_detail_is_created_automatically_with_the_issue(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        assert OrderDetail.objects.filter(issue=issue).exists()

    @pytest.mark.django_db
    def test_tentative_completion_date_sums_current_and_downstream_lead_times(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        order_detail = OrderDetail.objects.get(issue=issue)

        # Cutting (2d) + Stitching (3d) + Done (1d) = 6 days from today.
        expected = timezone.now().date() + timedelta(days=6)
        assert order_detail.tentative_completion_date == expected
        assert order_detail.current_stage_entered_at is not None

    @pytest.mark.django_db
    def test_moving_stages_recomputes_tentative_completion_date(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )

        issue.state = stages["stitching"]
        issue.save()

        order_detail = OrderDetail.objects.get(issue=issue)
        # Stitching (3d) + Done (1d) = 4 days from today.
        expected = timezone.now().date() + timedelta(days=4)
        assert order_detail.tentative_completion_date == expected

    @pytest.mark.django_db
    def test_saving_issue_without_changing_state_does_not_reset_stage_entry(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        order_detail = OrderDetail.objects.get(issue=issue)
        original_entered_at = order_detail.current_stage_entered_at

        issue.name = "Order 1 (renamed)"
        issue.save()

        order_detail.refresh_from_db()
        assert order_detail.current_stage_entered_at == original_entered_at

    @pytest.mark.django_db
    def test_completed_stage_tentative_date_is_just_the_entry_date(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )

        issue.state = stages["done"]
        issue.save()

        order_detail = OrderDetail.objects.get(issue=issue)
        assert order_detail.tentative_completion_date == timezone.now().date()

    @pytest.mark.django_db
    def test_editing_a_lead_time_recomputes_in_flight_orders(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["stitching"], created_by=create_user
        )
        # Stitching (3d) + Done (1d) = 4 days.
        order_detail = OrderDetail.objects.get(issue=issue)
        assert order_detail.tentative_completion_date == timezone.now().date() + timedelta(days=4)

        done_lead_time = StageLeadTime.objects.get(state=stages["done"])
        done_lead_time.lead_time_days = 5
        done_lead_time.save()

        order_detail.refresh_from_db()
        # Stitching (3d) + Done (5d) = 8 days.
        assert order_detail.tentative_completion_date == timezone.now().date() + timedelta(days=8)

    @pytest.mark.django_db
    def test_editing_a_lead_time_does_not_touch_completed_orders(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["done"], created_by=create_user
        )
        order_detail = OrderDetail.objects.get(issue=issue)
        completed_date = order_detail.tentative_completion_date

        stitching_lead_time = StageLeadTime.objects.get(state=stages["stitching"])
        stitching_lead_time.lead_time_days = 30
        stitching_lead_time.save()

        order_detail.refresh_from_db()
        assert order_detail.tentative_completion_date == completed_date
