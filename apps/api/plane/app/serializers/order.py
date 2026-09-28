# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import OrderDetail, PurchaseOrder, Style, TaskStateTarget, Vendor, VendorCapacity


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
