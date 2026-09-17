# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from plane.db.models import OrderDetail, PurchaseOrder, Style, TaskStateTarget, Vendor


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
            "address",
            "is_active",
        ]
        read_only_fields = ["workspace"]


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
            "requested_delivery_date",
        ]
        read_only_fields = ["workspace", "project", "issue"]


class TaskStateTargetSerializer(BaseSerializer):
    class Meta:
        model = TaskStateTarget
        fields = ["id", "workspace_id", "project_id", "issue", "state", "target_date", "entered_at"]
        read_only_fields = ["workspace", "project", "issue", "state", "entered_at"]
