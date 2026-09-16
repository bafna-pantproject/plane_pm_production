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
