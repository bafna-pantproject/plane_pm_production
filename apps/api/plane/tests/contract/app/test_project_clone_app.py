# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import uuid

import pytest
from rest_framework import status

from plane.db.models import Label, Project, ProjectMember, State, User, WorkspaceMember


@pytest.mark.contract
class TestProjectClone:
    def get_clone_url(self, workspace_slug: str, project_id: uuid.UUID) -> str:
        return f"/api/workspaces/{workspace_slug}/projects/{project_id}/clone/"

    @pytest.mark.django_db
    def test_clone_project_carries_over_states(self, session_client, workspace, create_user):
        """States on the source project (including any custom ones) end up on the clone verbatim."""
        source = Project.objects.create(name="Source Project", identifier="SRC", workspace=workspace)
        ProjectMember.objects.create(project=source, member=create_user, role=20, is_active=True)

        # wipe the states create() would have seeded and replace with a custom set
        State.all_state_objects.filter(project=source).delete()
        State.objects.create(name="Custom Backlog", color="#111111", project=source, group="backlog", default=True)
        State.objects.create(name="In Review", color="#222222", project=source, group="started")

        response = session_client.post(
            self.get_clone_url(workspace.slug, source.id),
            {"name": "Cloned Project", "identifier": "CLN"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        new_project = Project.objects.get(identifier="CLN")

        cloned_states = State.all_state_objects.filter(project=new_project)
        assert cloned_states.count() == 2
        assert set(cloned_states.values_list("name", "color", "group", "default")) == {
            ("Custom Backlog", "#111111", "backlog", True),
            ("In Review", "#222222", "started", False),
        }

    @pytest.mark.django_db
    def test_clone_project_carries_over_labels_and_members(self, session_client, workspace, create_user):
        source = Project.objects.create(name="Source Project", identifier="SRC", workspace=workspace)
        ProjectMember.objects.create(project=source, member=create_user, role=20, is_active=True)

        other_member = User.objects.create_user(email="member@example.com", username="member")
        WorkspaceMember.objects.create(workspace=workspace, member=other_member, role=15, is_active=True)
        ProjectMember.objects.create(project=source, member=other_member, role=15, is_active=True)

        parent_label = Label.objects.create(project=source, name="Parent", color="#ff0000")
        Label.objects.create(project=source, name="Child", color="#00ff00", parent=parent_label)

        response = session_client.post(
            self.get_clone_url(workspace.slug, source.id),
            {"name": "Cloned Project", "identifier": "CLN"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        new_project = Project.objects.get(identifier="CLN")

        assert ProjectMember.objects.filter(project=new_project, member=create_user, role=20).exists()
        assert ProjectMember.objects.filter(project=new_project, member=other_member, role=15).exists()

        cloned_child = Label.objects.get(project=new_project, name="Child")
        assert cloned_child.parent is not None
        assert cloned_child.parent.name == "Parent"
        assert cloned_child.parent.project_id == new_project.id

    @pytest.mark.django_db
    def test_clone_project_requires_name_and_identifier(self, session_client, workspace, create_user):
        source = Project.objects.create(name="Source Project", identifier="SRC", workspace=workspace)
        ProjectMember.objects.create(project=source, member=create_user, role=20, is_active=True)

        response = session_client.post(self.get_clone_url(workspace.slug, source.id), {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert Project.objects.count() == 1

    @pytest.mark.django_db
    def test_clone_project_forbidden_for_non_member(self, session_client, workspace, create_user):
        """A workspace member who isn't a member of the (secret) source project can't clone it."""
        source = Project.objects.create(
            name="Secret Project", identifier="SEC", workspace=workspace, network=0
        )

        outsider = User.objects.create_user(email="outsider@example.com", username="outsider")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15, is_active=True)
        session_client.force_authenticate(user=outsider)

        response = session_client.post(
            self.get_clone_url(workspace.slug, source.id),
            {"name": "Cloned Project", "identifier": "CLN"},
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert Project.objects.count() == 1

    @pytest.mark.django_db
    def test_clone_project_not_found(self, session_client, workspace, create_user):
        response = session_client.post(
            self.get_clone_url(workspace.slug, uuid.uuid4()),
            {"name": "Cloned Project", "identifier": "CLN"},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
