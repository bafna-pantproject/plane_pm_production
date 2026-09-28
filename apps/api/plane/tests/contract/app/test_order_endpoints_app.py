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
    OrderDetail,
    Project,
    ProjectMember,
    State,
    TaskStateTarget,
    User,
    Vendor,
    VendorCapacity,
    WorkspaceMember,
)

VENDORS_URL = "/api/workspaces/{slug}/vendors/"
VENDOR_URL = "/api/workspaces/{slug}/vendors/{pk}/"
VENDOR_CAPACITIES_URL = "/api/workspaces/{slug}/vendors/{vendor_id}/capacities/"
VENDOR_CAPACITY_URL = "/api/workspaces/{slug}/vendors/{vendor_id}/capacities/{pk}/"
VENDOR_CAPACITY_USAGE_URL = "/api/workspaces/{slug}/vendors/{vendor_id}/capacity-usage/"
ISSUE_ORDER_DETAIL_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/order-detail/"
ISSUE_STATE_TARGET_CASCADE_URL = (
    "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/state-targets/cascade/"
)


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
class TestVendorCapacityEndpoint:
    @pytest.fixture
    def vendor(self, workspace, create_user):
        return Vendor.objects.create(workspace=workspace, name="Acme Garments", created_by=create_user)

    @pytest.mark.django_db
    def test_admin_can_create_a_monthly_capacity(self, session_client, workspace, vendor):
        url = VENDOR_CAPACITIES_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.post(url, {"year": 2026, "month": 1, "capacity": 500}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert VendorCapacity.objects.filter(vendor=vendor, year=2026, month=1, capacity=500).exists()

    @pytest.mark.django_db
    def test_posting_the_same_year_month_again_updates_it_instead_of_erroring(
        self, session_client, workspace, vendor
    ):
        url = VENDOR_CAPACITIES_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        session_client.post(url, {"year": 2026, "month": 1, "capacity": 500}, format="json")
        response = session_client.post(url, {"year": 2026, "month": 1, "capacity": 750}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert VendorCapacity.objects.filter(vendor=vendor, year=2026, month=1).count() == 1
        assert VendorCapacity.objects.get(vendor=vendor, year=2026, month=1).capacity == 750

    @pytest.mark.django_db
    def test_list_returns_only_this_vendors_capacities(self, session_client, workspace, vendor, create_user):
        other_vendor = Vendor.objects.create(workspace=workspace, name="Other Vendor", created_by=create_user)
        VendorCapacity.objects.create(workspace=workspace, vendor=vendor, year=2026, month=1, capacity=500)
        VendorCapacity.objects.create(workspace=workspace, vendor=other_vendor, year=2026, month=1, capacity=999)

        url = VENDOR_CAPACITIES_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["capacity"] == 500

    @pytest.mark.django_db
    def test_admin_can_update_a_capacity(self, session_client, workspace, vendor):
        capacity = VendorCapacity.objects.create(workspace=workspace, vendor=vendor, year=2026, month=1, capacity=500)
        url = VENDOR_CAPACITY_URL.format(slug=workspace.slug, vendor_id=vendor.id, pk=capacity.id)
        response = session_client.patch(url, {"capacity": 650}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        capacity.refresh_from_db()
        assert capacity.capacity == 650

    @pytest.mark.django_db
    def test_admin_can_delete_a_capacity(self, session_client, workspace, vendor):
        capacity = VendorCapacity.objects.create(workspace=workspace, vendor=vendor, year=2026, month=1, capacity=500)
        url = VENDOR_CAPACITY_URL.format(slug=workspace.slug, vendor_id=vendor.id, pk=capacity.id)
        response = session_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not VendorCapacity.objects.filter(pk=capacity.id).exists()

    @pytest.mark.django_db
    def test_guest_cannot_create_a_capacity(self, workspace, vendor, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        url = VENDOR_CAPACITIES_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = client.post(url, {"year": 2026, "month": 1, "capacity": 500}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_guest_can_list_capacities(self, workspace, vendor, guest):
        VendorCapacity.objects.create(workspace=workspace, vendor=vendor, year=2026, month=1, capacity=500)
        client = APIClient()
        client.force_authenticate(user=guest)
        url = VENDOR_CAPACITIES_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.contract
class TestVendorCapacityUsageEndpoint:
    """Usage is computed from sub-work-items only (issues with a parent) -
    top-level orders are excluded so a split order's quantity, which lives on
    its sub-work-items, isn't also counted on the parent."""

    @pytest.fixture
    def vendor(self, workspace, create_user):
        return Vendor.objects.create(workspace=workspace, name="Acme Garments", created_by=create_user)

    @pytest.fixture
    def state(self, project):
        return State.objects.create(name="Cutting", project=project, workspace=project.workspace, default=True)

    def _make_sub_issue(self, project, state, create_user, parent, target_date, vendor, quantity):
        child = Issue.objects.create(
            name="Sub item",
            project=project,
            workspace=project.workspace,
            state=state,
            parent=parent,
            target_date=target_date,
            created_by=create_user,
        )
        OrderDetail.objects.filter(issue=child).update(vendor=vendor, quantity=quantity)
        return child

    @pytest.mark.django_db
    def test_sums_sub_work_item_quantities_by_delivery_month(
        self, session_client, workspace, project, state, vendor, create_user
    ):
        parent = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
        )
        self._make_sub_issue(project, state, create_user, parent, "2026-01-15", vendor, 100)
        self._make_sub_issue(project, state, create_user, parent, "2026-01-20", vendor, 150)
        self._make_sub_issue(project, state, create_user, parent, "2026-02-01", vendor, 50)

        url = VENDOR_CAPACITY_USAGE_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK, response.data
        usage_by_month = {(row["year"], row["month"]): row["used"] for row in response.data}
        assert usage_by_month[(2026, 1)] == 250
        assert usage_by_month[(2026, 2)] == 50

    @pytest.mark.django_db
    def test_excludes_top_level_orders_even_when_they_have_their_own_quantity(
        self, session_client, workspace, project, state, vendor
    ):
        parent = Issue.objects.create(
            name="Standalone order",
            project=project,
            workspace=project.workspace,
            state=state,
            target_date="2026-01-15",
        )
        OrderDetail.objects.filter(issue=parent).update(vendor=vendor, quantity=500)

        url = VENDOR_CAPACITY_USAGE_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.django_db
    def test_excludes_sub_items_with_no_delivery_date_or_no_quantity(
        self, session_client, workspace, project, state, vendor, create_user
    ):
        parent = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
        )
        # no target_date at all
        Issue.objects.create(
            name="Sub item without a due date",
            project=project,
            workspace=project.workspace,
            state=state,
            parent=parent,
            created_by=create_user,
        )
        # target_date set, but quantity never filled in
        Issue.objects.create(
            name="Sub item without a quantity",
            project=project,
            workspace=project.workspace,
            state=state,
            parent=parent,
            target_date="2026-01-15",
            created_by=create_user,
        )

        url = VENDOR_CAPACITY_USAGE_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.django_db
    def test_scoped_to_the_requested_vendor_only(
        self, session_client, workspace, project, state, create_user, vendor
    ):
        other_vendor = Vendor.objects.create(workspace=workspace, name="Other Vendor", created_by=create_user)
        parent = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
        )
        self._make_sub_issue(project, state, create_user, parent, "2026-01-15", vendor, 100)
        self._make_sub_issue(project, state, create_user, parent, "2026-01-15", other_vendor, 999)

        url = VENDOR_CAPACITY_USAGE_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["used"] == 100

    @pytest.mark.django_db
    def test_guest_can_view_capacity_usage(self, workspace, project, state, vendor, guest, create_user):
        parent = Issue.objects.create(
            name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
        )
        self._make_sub_issue(project, state, create_user, parent, "2026-01-15", vendor, 100)

        client = APIClient()
        client.force_authenticate(user=guest)
        url = VENDOR_CAPACITY_USAGE_URL.format(slug=workspace.slug, vendor_id=vendor.id)
        response = client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["used"] == 100


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
    def test_member_can_set_and_clear_prices(self, session_client, workspace, project, issue):
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = session_client.patch(
            url,
            {"fabric_price": "12.50", "trims_price": "3.25", "fob_price": "20.00"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["fabric_price"] == "12.50"
        assert response.data["trims_price"] == "3.25"
        assert response.data["fob_price"] == "20.00"

        response = session_client.patch(url, {"fabric_price": None}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["fabric_price"] is None
        assert response.data["fob_price"] == "20.00"

    @pytest.mark.django_db
    def test_negative_price_is_rejected(self, session_client, workspace, project, issue):
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = session_client.patch(url, {"fob_price": "-1.00"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_guest_cannot_edit_order_detail(self, workspace, project, issue, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = client.patch(url, {"requested_delivery_date": "2026-09-01"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestIssueStateTargetCascadeEndpoint:
    @pytest.fixture
    def states(self, project):
        cutting = State.objects.create(
            name="Cutting", project=project, workspace=project.workspace, group="backlog", sequence=15000
        )
        stitching = State.objects.create(
            name="Stitching", project=project, workspace=project.workspace, group="started", sequence=30000
        )
        return {"cutting": cutting, "stitching": stitching}

    @pytest.fixture
    def parent_issue(self, project, states, create_user):
        return Issue.objects.create(
            name="Parent order", project=project, workspace=project.workspace, state=states["cutting"], created_by=create_user
        )

    @pytest.mark.django_db
    def test_cascades_parent_target_dates_to_direct_sub_issues_overwriting_existing_ones(
        self, session_client, workspace, project, states, parent_issue, create_user
    ):
        TaskStateTarget.objects.create(
            issue=parent_issue, state=states["stitching"], project=project, target_date="2026-02-01"
        )

        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=states["cutting"],
            parent=parent_issue,
            created_by=create_user,
        )
        # give the child a different value than what the parent currently has,
        # to confirm the cascade overwrites it rather than leaving it alone
        TaskStateTarget.objects.filter(issue=child, state=states["stitching"]).update(target_date="2020-01-01")

        url = ISSUE_STATE_TARGET_CASCADE_URL.format(slug=workspace.slug, project_id=project.id, issue_id=parent_issue.id)
        response = session_client.post(url)
        assert response.status_code == status.HTTP_200_OK, response.data
        assert str(child.id) in response.data["updated_issue_ids"]

        target = TaskStateTarget.objects.get(issue=child, state=states["stitching"])
        assert str(target.target_date) == "2026-02-01"

    @pytest.mark.django_db
    def test_does_not_cascade_to_grandchildren(
        self, session_client, workspace, project, states, parent_issue, create_user
    ):
        TaskStateTarget.objects.create(
            issue=parent_issue, state=states["stitching"], project=project, target_date="2026-02-01"
        )
        child = Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=states["cutting"],
            parent=parent_issue,
            created_by=create_user,
        )
        grandchild = Issue.objects.create(
            name="Grandchild order",
            project=project,
            workspace=project.workspace,
            state=states["cutting"],
            parent=child,
            created_by=create_user,
        )

        url = ISSUE_STATE_TARGET_CASCADE_URL.format(slug=workspace.slug, project_id=project.id, issue_id=parent_issue.id)
        response = session_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert str(grandchild.id) not in response.data["updated_issue_ids"]
        assert not TaskStateTarget.objects.filter(issue=grandchild, state=states["stitching"]).exists()

    @pytest.mark.django_db
    def test_returns_empty_list_when_parent_has_no_target_dates(
        self, session_client, workspace, project, states, parent_issue, create_user
    ):
        Issue.objects.create(
            name="Child order",
            project=project,
            workspace=project.workspace,
            state=states["cutting"],
            parent=parent_issue,
            created_by=create_user,
        )
        url = ISSUE_STATE_TARGET_CASCADE_URL.format(slug=workspace.slug, project_id=project.id, issue_id=parent_issue.id)
        response = session_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["updated_issue_ids"] == []

    @pytest.mark.django_db
    def test_guest_cannot_cascade(self, workspace, project, states, parent_issue, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        url = ISSUE_STATE_TARGET_CASCADE_URL.format(slug=workspace.slug, project_id=project.id, issue_id=parent_issue.id)
        response = client.post(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
