# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone

from plane.db.models import Issue, Project, State, TaskStateTarget
from plane.utils.next_state_target import bucket_flag_severity, get_flagged_issue_ids, get_next_state_map


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
    """Three production stages, created out of sequence order to verify
    group-then-sequence resolution (not creation/DB-id order)."""
    done = State.objects.create(
        name="Done", project=project, workspace=project.workspace, group="completed", sequence=45000
    )
    cutting = State.objects.create(
        name="Cutting", project=project, workspace=project.workspace, group="backlog", sequence=15000
    )
    stitching = State.objects.create(
        name="Stitching", project=project, workspace=project.workspace, group="started", sequence=30000
    )
    return {"cutting": cutting, "stitching": stitching, "done": done}


@pytest.mark.unit
class TestGetNextStateMap:
    @pytest.mark.django_db
    def test_resolves_group_then_sequence_order(self, project, stages):
        next_state_map = get_next_state_map(project.id)
        assert next_state_map[stages["cutting"].id] == stages["stitching"].id
        assert next_state_map[stages["stitching"].id] == stages["done"].id

    @pytest.mark.django_db
    def test_terminal_state_has_no_key(self, project, stages):
        next_state_map = get_next_state_map(project.id)
        assert stages["done"].id not in next_state_map

    @pytest.mark.django_db
    def test_single_state_project_returns_empty_map(self, project):
        State.objects.create(name="Only", project=project, workspace=project.workspace, group="backlog")
        assert get_next_state_map(project.id) == {}


@pytest.mark.unit
class TestBucketFlagSeverity:
    @pytest.mark.parametrize(
        "days_diff,expected",
        [
            (10, "red"),
            (11, "red"),
            (9, "orange"),
            (1, "orange"),
            (0, "yellow"),
            (-10, "yellow"),
            (-11, None),
            (-30, None),
        ],
    )
    def test_boundaries(self, days_diff, expected):
        assert bucket_flag_severity(days_diff) == expected


@pytest.mark.unit
class TestGetFlaggedIssueIds:
    @pytest.mark.django_db
    def test_excludes_row_with_entered_at_already_set(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        TaskStateTarget.objects.create(
            issue=issue,
            state=stages["stitching"],
            project=project,
            workspace=project.workspace,
            target_date=timezone.localdate() - timedelta(days=20),
            entered_at=timezone.now(),
        )
        assert get_flagged_issue_ids(project.id, {"red", "orange", "yellow"}) == []

    @pytest.mark.django_db
    def test_excludes_row_with_no_target_date(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        assert get_flagged_issue_ids(project.id, {"red", "orange", "yellow"}) == []
        assert not TaskStateTarget.objects.filter(issue=issue, state=stages["stitching"]).exists()

    @pytest.mark.django_db
    def test_excludes_target_on_a_state_that_is_not_the_actual_next_state(self, project, stages, create_user):
        """A stale TaskStateTarget row on "done" (skipping "stitching") must
        not count, since the issue's real next state is "stitching"."""
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        TaskStateTarget.objects.create(
            issue=issue,
            state=stages["done"],
            project=project,
            workspace=project.workspace,
            target_date=timezone.localdate() - timedelta(days=20),
        )
        assert get_flagged_issue_ids(project.id, {"red", "orange", "yellow"}) == []

    @pytest.mark.django_db
    def test_includes_matching_overdue_row_for_requested_severity(self, project, stages, create_user):
        issue = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=stages["cutting"], created_by=create_user
        )
        TaskStateTarget.objects.create(
            issue=issue,
            state=stages["stitching"],
            project=project,
            workspace=project.workspace,
            target_date=timezone.localdate() - timedelta(days=15),
        )
        assert get_flagged_issue_ids(project.id, {"red"}) == [issue.id]
        assert get_flagged_issue_ids(project.id, {"orange", "yellow"}) == []
