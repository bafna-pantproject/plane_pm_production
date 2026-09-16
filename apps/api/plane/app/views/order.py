# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView, BaseViewSet
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import (
    OrderDetailSerializer,
    PurchaseOrderSerializer,
    StyleSerializer,
    TaskStateTargetSerializer,
    VendorSerializer,
)
from plane.db.models import OrderDetail, PurchaseOrder, State, Style, TaskStateTarget, Vendor, Workspace


class VendorViewSet(BaseViewSet):
    serializer_class = VendorSerializer
    model = Vendor

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                workspace__workspace_member__member=self.request.user,
                workspace__workspace_member__is_active=True,
            )
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        serializer = VendorSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace_id=Workspace.objects.only("id").get(slug=slug).id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        vendor = Vendor.objects.get(pk=pk, workspace__slug=slug)
        serializer = VendorSerializer(vendor, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        vendor = Vendor.objects.get(pk=pk, workspace__slug=slug)
        vendor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StyleViewSet(BaseViewSet):
    serializer_class = StyleSerializer
    model = Style

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                workspace__workspace_member__member=self.request.user,
                workspace__workspace_member__is_active=True,
            )
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        serializer = StyleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace_id=Workspace.objects.only("id").get(slug=slug).id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        style = Style.objects.get(pk=pk, workspace__slug=slug)
        serializer = StyleSerializer(style, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        style = Style.objects.get(pk=pk, workspace__slug=slug)
        style.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PurchaseOrderViewSet(BaseViewSet):
    serializer_class = PurchaseOrderSerializer
    model = PurchaseOrder

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(
                workspace__workspace_member__member=self.request.user,
                workspace__workspace_member__is_active=True,
            )
            .select_related("vendor")
            .distinct()
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def create(self, request, slug):
        serializer = PurchaseOrderSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace_id=Workspace.objects.only("id").get(slug=slug).id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def partial_update(self, request, slug, pk):
        purchase_order = PurchaseOrder.objects.get(pk=pk, workspace__slug=slug)
        serializer = PurchaseOrderSerializer(purchase_order, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def destroy(self, request, slug, pk):
        purchase_order = PurchaseOrder.objects.get(pk=pk, workspace__slug=slug)
        purchase_order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueStateTargetsEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id):
        targets = TaskStateTarget.objects.filter(
            workspace__slug=slug, project_id=project_id, issue_id=issue_id
        ).select_related("state")
        return Response(TaskStateTargetSerializer(targets, many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        state_id = request.data.get("state")
        if not State.objects.filter(pk=state_id, project_id=project_id).exists():
            return Response({"error": "State is not valid, please pass a valid state_id"}, status=status.HTTP_400_BAD_REQUEST)
        target, _ = TaskStateTarget.objects.get_or_create(
            issue_id=issue_id, state_id=state_id, defaults={"project_id": project_id}
        )
        serializer = TaskStateTargetSerializer(
            target, data={"target_date": request.data.get("target_date")}, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class IssueStateTargetDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, issue_id, pk):
        target = TaskStateTarget.objects.get(pk=pk, issue_id=issue_id, project_id=project_id, workspace__slug=slug)
        serializer = TaskStateTargetSerializer(target, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            target.refresh_from_db()
            # Sparse cleanup: an empty row (no target, no recorded entry) has nothing left to show.
            if target.target_date is None and target.entered_at is None:
                target.delete()
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, issue_id, pk):
        TaskStateTarget.objects.filter(pk=pk, issue_id=issue_id, project_id=project_id, workspace__slug=slug).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueOrderDetailEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id):
        order_detail, _ = OrderDetail.objects.get_or_create(
            issue_id=issue_id, defaults={"project_id": project_id}
        )
        return Response(OrderDetailSerializer(order_detail).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, issue_id):
        order_detail, _ = OrderDetail.objects.get_or_create(
            issue_id=issue_id, defaults={"project_id": project_id}
        )
        serializer = OrderDetailSerializer(order_detail, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProjectOrderDetailsEndpoint(BaseAPIView):
    """Bulk list of every order-detail row in a project, so boards can join
    vendor/style/PO/dates onto issues locally instead of one request per card."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        order_details = OrderDetail.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).select_related("vendor", "style", "purchase_order")
        return Response(OrderDetailSerializer(order_details, many=True).data, status=status.HTTP_200_OK)


class ProjectOrderDetailCategoriesEndpoint(BaseAPIView):
    """Distinct, non-empty OrderDetail.category values used in a project, for the
    work-items board's category filter (category has no fixed catalog of its own)."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        categories = (
            OrderDetail.objects.filter(workspace__slug=slug, project_id=project_id)
            .exclude(category="")
            .order_by("category")
            .values_list("category", flat=True)
            .distinct()
        )
        return Response(list(categories), status=status.HTTP_200_OK)
