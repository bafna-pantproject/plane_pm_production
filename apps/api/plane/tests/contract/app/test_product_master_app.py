# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the product master (categories and their fits), which work items pick
their fit/category from. Work items store both as text, so renames carry over to them."""

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    OrderDetail,
    ProductCategory,
    ProductFit,
    Project,
    Style,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)

CATEGORIES_URL = "/api/workspaces/{slug}/product-categories/"
CATEGORY_URL = "/api/workspaces/{slug}/product-categories/{pk}/"
FITS_URL = "/api/workspaces/{slug}/product-fits/"
FIT_URL = "/api/workspaces/{slug}/product-fits/{pk}/"
STYLES_URL = "/api/workspaces/{slug}/styles/"
ISSUE_ORDER_DETAIL_URL = "/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/order-detail/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Garment Orders", identifier="GAR", workspace=workspace, created_by=create_user
    )
    ProjectMember.objects.create(project=project, member=create_user, workspace=workspace, role=20)
    return project


@pytest.fixture
def guest(db, workspace):
    unique_id = uuid4().hex[:8]
    user = User.objects.create(
        email=f"guest-{unique_id}@plane.so",
        username=f"guest_{unique_id}",
        first_name="Guest",
        last_name="User",
    )
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=5, is_active=True)
    return user


@pytest.fixture
def category(db, workspace):
    return ProductCategory.objects.create(workspace=workspace, name="T-Shirts")


@pytest.fixture
def issue_with_order_detail(project, create_user):
    state = State.objects.create(
        name="Cutting", project=project, workspace=project.workspace, group="backlog", default=True
    )
    issue = Issue.objects.create(
        name="Order 1", project=project, workspace=project.workspace, state=state, created_by=create_user
    )
    order_detail, _ = OrderDetail.objects.get_or_create(issue=issue, defaults={"project": project})
    return issue, order_detail


@pytest.mark.contract
class TestProductCategoryEndpoints:
    @pytest.mark.django_db
    def test_admin_can_create_and_list_categories(self, session_client, workspace):
        response = session_client.post(CATEGORIES_URL.format(slug=workspace.slug), {"name": " Shirts "}, format="json")
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data["name"] == "Shirts"

        response = session_client.get(CATEGORIES_URL.format(slug=workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        assert [row["name"] for row in response.data] == ["Shirts"]

    @pytest.mark.django_db
    def test_category_name_is_unique_per_workspace_ignoring_case(self, session_client, workspace, category):
        response = session_client.post(
            CATEGORIES_URL.format(slug=workspace.slug), {"name": "t-shirts"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_guest_cannot_create_category(self, workspace, guest):
        client = APIClient()
        client.force_authenticate(user=guest)
        response = client.post(CATEGORIES_URL.format(slug=workspace.slug), {"name": "Shirts"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_renaming_a_category_renames_it_on_orders(
        self, session_client, workspace, category, issue_with_order_detail
    ):
        _, order_detail = issue_with_order_detail
        order_detail.category = "T-Shirts"
        order_detail.save()

        response = session_client.patch(
            CATEGORY_URL.format(slug=workspace.slug, pk=category.id), {"name": "Tees"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        order_detail.refresh_from_db()
        assert order_detail.category == "Tees"

    @pytest.mark.django_db
    def test_deleting_a_category_removes_its_fits(self, session_client, workspace, category):
        ProductFit.objects.create(workspace=workspace, category=category, name="Slim Fit")
        response = session_client.delete(CATEGORY_URL.format(slug=workspace.slug, pk=category.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProductFit.objects.filter(category=category).exists()


@pytest.mark.contract
class TestProductFitEndpoints:
    @pytest.mark.django_db
    def test_admin_can_create_a_fit_under_a_category(self, session_client, workspace, category):
        response = session_client.post(
            FITS_URL.format(slug=workspace.slug), {"category": str(category.id), "name": "Slim Fit"}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert ProductFit.objects.filter(category=category, name="Slim Fit").exists()

    @pytest.mark.django_db
    def test_fit_name_is_unique_within_its_category(self, session_client, workspace, category):
        ProductFit.objects.create(workspace=workspace, category=category, name="Slim Fit")
        response = session_client.post(
            FITS_URL.format(slug=workspace.slug), {"category": str(category.id), "name": "slim fit"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_cannot_add_a_fit_to_another_workspaces_category(self, session_client, workspace, create_user):
        other = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        foreign_category = ProductCategory.objects.create(workspace=other, name="Jeans")
        response = session_client.post(
            FITS_URL.format(slug=workspace.slug),
            {"category": str(foreign_category.id), "name": "Slim Fit"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_renaming_a_fit_renames_it_on_orders_in_that_category_only(
        self, session_client, workspace, category, issue_with_order_detail, project, create_user
    ):
        fit = ProductFit.objects.create(workspace=workspace, category=category, name="Slim Fit")
        _, order_detail = issue_with_order_detail
        order_detail.category = "T-Shirts"
        order_detail.fit = "Slim Fit"
        order_detail.save()
        other_issue = Issue.objects.create(
            name="Order 2", project=project, workspace=workspace, state=order_detail.issue.state, created_by=create_user
        )
        other_detail, _ = OrderDetail.objects.get_or_create(issue=other_issue, defaults={"project": project})
        other_detail.category = "Jeans"
        other_detail.fit = "Slim Fit"
        other_detail.save()

        response = session_client.patch(FIT_URL.format(slug=workspace.slug, pk=fit.id), {"name": "Skinny"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        order_detail.refresh_from_db()
        other_detail.refresh_from_db()
        assert order_detail.fit == "Skinny"
        assert other_detail.fit == "Slim Fit"


@pytest.mark.contract
class TestOrderDetailFit:
    @pytest.mark.django_db
    def test_order_detail_accepts_and_returns_fit(self, session_client, workspace, project, issue_with_order_detail):
        issue, _ = issue_with_order_detail
        url = ISSUE_ORDER_DETAIL_URL.format(slug=workspace.slug, project_id=project.id, issue_id=issue.id)
        response = session_client.patch(url, {"fit": "Slim Fit", "category": "T-Shirts"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data
        assert response.data["fit"] == "Slim Fit"
        assert response.data["category"] == "T-Shirts"


@pytest.mark.contract
class TestStylesUnderFits:
    @pytest.fixture
    def fit(self, workspace, category):
        return ProductFit.objects.create(workspace=workspace, category=category, name="Slim Fit")

    @pytest.mark.django_db
    def test_admin_can_create_a_style_under_a_fit(self, session_client, workspace, fit):
        response = session_client.post(
            STYLES_URL.format(slug=workspace.slug), {"code": "TS-1042", "name": "TS-1042", "fit": str(fit.id)}, format="json"
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert str(response.data["fit"]) == str(fit.id)

    @pytest.mark.django_db
    def test_style_code_is_unique_per_workspace(self, session_client, workspace, fit):
        Style.objects.create(workspace=workspace, code="TS-1042")
        response = session_client.post(STYLES_URL.format(slug=workspace.slug), {"code": "ts-1042"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_cannot_put_a_style_under_another_workspaces_fit(self, session_client, workspace, create_user):
        other = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
        other_category = ProductCategory.objects.create(workspace=other, name="Jeans")
        foreign_fit = ProductFit.objects.create(workspace=other, category=other_category, name="Slim Fit")
        response = session_client.post(
            STYLES_URL.format(slug=workspace.slug), {"code": "TS-1042", "fit": str(foreign_fit.id)}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_deleting_a_fit_keeps_its_styles_but_unlinks_them(self, session_client, workspace, fit):
        style = Style.objects.create(workspace=workspace, code="TS-1042", fit=fit)
        response = session_client.delete(FIT_URL.format(slug=workspace.slug, pk=fit.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        style.refresh_from_db()
        assert style.deleted_at is None
        assert style.fit_id is None

    @pytest.mark.django_db
    def test_deleting_a_category_unlinks_the_styles_under_its_fits(self, session_client, workspace, category, fit):
        style = Style.objects.create(workspace=workspace, code="TS-1042", fit=fit)
        response = session_client.delete(CATEGORY_URL.format(slug=workspace.slug, pk=category.id))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        style.refresh_from_db()
        assert style.deleted_at is None
        assert style.fit_id is None
