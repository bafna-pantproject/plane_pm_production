# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the garment-order-tracking endpoints: workspace-scoped
Vendor/Style/PurchaseOrder catalogs, and the per-issue OrderDetail endpoint."""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    Project,
    ProjectMember,
    State,
    User,
    Vendor,
    WorkspaceMember,
)

VENDORS_URL = "/api/workspaces/{slug}/vendors/"
VENDOR_URL = "/api/workspaces/{slug}/vendors/{pk}/"
ISSUE_ORDER_DETAIL_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/order-detail/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Garment Orders", identifier="GAR", workspace=workspace, created_by=create_user
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


@pytest.fixture
def guest(db, workspace, project):
    """An active workspace + project GUEST (role=5)."""
    unique_id = uuid4().hex[:8]
    user = User.objects.create(
        email=f"guest-{unique_id}@plane.so",
        username=f"guest_{unique_id}",
        first_name="Guest",
        last_name="User",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5, is_active=True)
    ProjectMember.objects.create(project=project, member=user, workspace=workspace, role=5, is_active=True)
    return user


@pytest.mark.contract
class TestVendorWorkspaceScoping:
    @pytest.mark.django_db
    def test_admin_can_create_vendor(self, session_client, workspace):
        response = session_client.post(
            VENDORS_URL.format(slug=workspace.slug), {"name": "Acme Garments"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Vendor.objects.filter(workspace=workspace, name="Acme Garments").exists()

    @pytest.mark.django_db
    def test_guest_cannot_create_vendor(self, workspace, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        response = client.post(VENDORS_URL.format(slug=workspace.slug), {"name": "Acme Garments"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_guest_can_list_vendors(self, workspace, guest, create_user):
        Vendor.objects.create(workspace=workspace, name="Acme Garments", created_by=create_user)
        client = APIClient()
        client.force_authenticate(user=guest)
        response = client.get(VENDORS_URL.format(slug=workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        names = [v["name"] for v in response.data]
        assert "Acme Garments" in names

    @pytest.mark.django_db
    def test_vendors_are_scoped_to_their_own_workspace(self, session_client, workspace, create_user):
        unique_id = uuid4().hex[:8]
        other_ws_owner = User.objects.create(email=f"owner-{unique_id}@plane.so", username=f"owner_{unique_id}")
        from plane.db.models import Workspace

        other_workspace = Workspace.objects.create(
            name="Other WS", owner=other_ws_owner, slug=f"other-ws-{unique_id}"
        )
        Vendor.objects.create(workspace=other_workspace, name="Foreign Vendor", created_by=other_ws_owner)
        Vendor.objects.create(workspace=workspace, name="Own Vendor", created_by=create_user)

        response = session_client.get(VENDORS_URL.format(slug=workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        names = [v["name"] for v in response.data]
        assert "Own Vendor" in names
        assert "Foreign Vendor" not in names

    @pytest.mark.django_db
    def test_vendor_name_unique_per_workspace(self, session_client, workspace):
        response = session_client.post(
            VENDORS_URL.format(slug=workspace.slug), {"name": "Acme Garments"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED

        response = session_client.post(
            VENDORS_URL.format(slug=workspace.slug), {"name": "Acme Garments"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.contract
class TestIssueOrderDetailEndpoint:
    @pytest.fixture
    def issue(self, project, create_user):
        state = State.objects.create(
            name="Cutting", project=project, workspace=project.workspace, group="backlog", default=True
        )
        return Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
        )

    @pytest.mark.django_db
    def test_get_returns_the_auto_created_order_detail(self, session_client, workspace, project, issue):
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["issue"]) == str(issue.id)

    @pytest.mark.django_db
    def test_member_can_set_requested_delivery_date_and_vendor(self, session_client, workspace, project, issue):
        vendor = Vendor.objects.create(workspace=workspace, name="Acme Garments")
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = session_client.patch(
            url,
            {"requested_delivery_date": "2026-09-01", "vendor": str(vendor.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["requested_delivery_date"] == "2026-09-01"
        assert str(response.data["vendor"]) == str(vendor.id)

    @pytest.mark.django_db
    def test_guest_cannot_edit_order_detail(self, workspace, project, issue, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = client.patch(url, {"requested_delivery_date": "2026-09-01"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN
