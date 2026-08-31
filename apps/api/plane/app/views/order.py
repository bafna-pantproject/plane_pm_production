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
    StageLeadTimeSerializer,
    StyleSerializer,
    VendorSerializer,
)
from plane.db.models import OrderDetail, PurchaseOrder, StageLeadTime, Style, Vendor, Workspace


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


class StageLeadTimeViewSet(BaseViewSet):
    serializer_class = StageLeadTimeSerializer
    model = StageLeadTime

    def get_queryset(self):
        return self.filter_queryset(
            super()
            .get_queryset()
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("state")
            .order_by("state__sequence")
            .distinct()
        )

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        stage_lead_time = StageLeadTime.objects.get(pk=pk, project_id=project_id, workspace__slug=slug)
        serializer = StageLeadTimeSerializer(stage_lead_time, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
