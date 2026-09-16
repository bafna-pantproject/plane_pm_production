# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    IssueOrderDetailEndpoint,
    IssueStateTargetDetailEndpoint,
    IssueStateTargetsEndpoint,
    ProjectOrderDetailCategoriesEndpoint,
    ProjectOrderDetailsEndpoint,
    PurchaseOrderViewSet,
    StyleViewSet,
    VendorViewSet,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/vendors/",
        VendorViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-vendor",
    ),
    path(
        "workspaces/<str:slug>/vendors/<uuid:pk>/",
        VendorViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-vendor",
    ),
    path(
        "workspaces/<str:slug>/styles/",
        StyleViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-style",
    ),
    path(
        "workspaces/<str:slug>/styles/<uuid:pk>/",
        StyleViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-style",
    ),
    path(
        "workspaces/<str:slug>/purchase-orders/",
        PurchaseOrderViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-purchase-order",
    ),
    path(
        "workspaces/<str:slug>/purchase-orders/<uuid:pk>/",
        PurchaseOrderViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-purchase-order",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/state-targets/",
        IssueStateTargetsEndpoint.as_view(),
        name="issue-state-targets",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/state-targets/<uuid:pk>/",
        IssueStateTargetDetailEndpoint.as_view(),
        name="issue-state-target-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/order-details/",
        ProjectOrderDetailsEndpoint.as_view(),
        name="project-order-details",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/order-detail-categories/",
        ProjectOrderDetailCategoriesEndpoint.as_view(),
        name="project-order-detail-categories",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/order-detail/",
        IssueOrderDetailEndpoint.as_view(),
        name="issue-order-detail",
    ),
]
