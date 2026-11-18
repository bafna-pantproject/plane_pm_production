# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import (
    IssueShipment,
    OrderDetail,
    ProductCategory,
    ProductFit,
    PurchaseOrder,
    Style,
    TaskStateTarget,
    Vendor,
    VendorCapacity,
)


class VendorSerializer(BaseSerializer):
    class Meta:
        model = Vendor
        fields = [
            "id",
            "workspace_id",
            "name",
            "code",
            "contact_name",
            "contact_email",
            "contact_phone",
            "increff_supplier_id",
            "address",
            "is_active",
        ]
        read_only_fields = ["workspace"]

    def validate_increff_supplier_id(self, value):
        value = value.strip()
        if not value:
            return value
        workspace_id = self.instance.workspace_id if self.instance else self.context.get("workspace_id")
        duplicates = Vendor.objects.filter(workspace_id=workspace_id, increff_supplier_id=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("A vendor with this Increff supplier ID already exists.")
        return value


class VendorCapacitySerializer(BaseSerializer):
    class Meta:
        model = VendorCapacity
        fields = ["id", "workspace_id", "vendor", "year", "month", "capacity"]
        read_only_fields = ["workspace", "vendor"]


class StyleSerializer(BaseSerializer):
    class Meta:
        model = Style
        fields = ["id", "workspace_id", "code", "name", "description", "is_active"]
        read_only_fields = ["workspace"]


class ProductCategorySerializer(BaseSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "workspace_id", "name"]
        read_only_fields = ["workspace"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        workspace_id = self.instance.workspace_id if self.instance else self.context.get("workspace_id")
        duplicates = ProductCategory.objects.filter(workspace_id=workspace_id, name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("A category with this name already exists.")
        return value


class ProductFitSerializer(BaseSerializer):
    class Meta:
        model = ProductFit
        fields = ["id", "workspace_id", "category", "name"]
        read_only_fields = ["workspace"]

    def validate(self, attrs):
        category = attrs.get("category") or (self.instance.category if self.instance else None)
        if category is None:
            raise serializers.ValidationError({"category": "Category is required."})
        if self.instance and "category" in attrs and attrs["category"].pk != self.instance.category_id:
            raise serializers.ValidationError({"category": "A fit can't be moved to another category."})
        workspace_id = self.instance.workspace_id if self.instance else self.context.get("workspace_id")
        if category.workspace_id != workspace_id:
            raise serializers.ValidationError({"category": "Category not found."})
        if "name" in attrs:
            name = attrs["name"].strip()
            if not name:
                raise serializers.ValidationError({"name": "Name is required."})
            duplicates = ProductFit.objects.filter(category=category, name__iexact=name)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError({"name": "This category already has a fit with this name."})
            attrs["name"] = name
        return attrs


class PurchaseOrderSerializer(BaseSerializer):
    class Meta:
        model = PurchaseOrder
        fields = ["id", "workspace_id", "po_number", "vendor", "issued_date", "notes"]
        read_only_fields = ["workspace"]


class OrderDetailSerializer(BaseSerializer):
    class Meta:
        model = OrderDetail
        fields = [
            "id",
            "workspace_id",
            "project_id",
            "issue",
            "order_number",
            "fit",
            "category",
            "quantity",
            "vendor",
            "style",
            "purchase_order",
            "purchase_order_number",
            "fabric_price",
            "trims_price",
            "fob_price",
            "requested_delivery_date",
        ]
        read_only_fields = ["workspace", "project", "issue"]


class TaskStateTargetSerializer(BaseSerializer):
    class Meta:
        model = TaskStateTarget
        fields = ["id", "workspace_id", "project_id", "issue", "state", "target_date", "entered_at"]
        read_only_fields = ["workspace", "project", "issue", "state", "entered_at"]


class IssueShipmentSerializer(BaseSerializer):
    # lets a parent's roll-up label rows that were logged on one of its sub work items
    issue_sequence_id = serializers.IntegerField(source="issue.sequence_id", read_only=True)

    class Meta:
        model = IssueShipment
        fields = [
            "id",
            "workspace_id",
            "project_id",
            "issue",
            "issue_sequence_id",
            "shipped_date",
            "quantity",
            "note",
            "created_at",
            "created_by",
        ]
        read_only_fields = ["workspace", "project", "issue", "created_at", "created_by"]
