# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel
from .workspace import WorkspaceBaseModel


class Vendor(WorkspaceBaseModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=100, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_email = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name"],
                condition=Q(deleted_at__isnull=True),
                name="vendor_unique_workspace_name_when_not_deleted",
            )
        ]
        verbose_name = "Vendor"
        verbose_name_plural = "Vendors"
        db_table = "vendors"
        ordering = ("name",)

    def __str__(self):
        return str(self.name)


class Style(WorkspaceBaseModel):
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "code"],
                condition=Q(deleted_at__isnull=True),
                name="style_unique_workspace_code_when_not_deleted",
            )
        ]
        verbose_name = "Style"
        verbose_name_plural = "Styles"
        db_table = "styles"
        ordering = ("code",)

    def __str__(self):
        return str(self.code)


class PurchaseOrder(WorkspaceBaseModel):
    po_number = models.CharField(max_length=100)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name="purchase_orders")
    issued_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "po_number"],
                condition=Q(deleted_at__isnull=True),
                name="purchase_order_unique_workspace_po_number_when_not_deleted",
            )
        ]
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Orders"
        db_table = "purchase_orders"
        ordering = ("-created_at",)

    def __str__(self):
        return str(self.po_number)


class OrderDetail(ProjectBaseModel):
    issue = models.OneToOneField("db.Issue", on_delete=models.CASCADE, related_name="order_detail")
    category = models.CharField(max_length=255, blank=True)
    quantity = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    vendor = models.ForeignKey(
        Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_details"
    )
    style = models.ForeignKey(Style, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_details")
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_details",
    )
    requested_delivery_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Order Detail"
        verbose_name_plural = "Order Details"
        db_table = "order_details"
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if self._state.adding and not self.project_id:
            self.project = self.issue.project
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Order detail <{self.issue_id}>"


class TaskStateTarget(ProjectBaseModel):
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="state_targets")
    state = models.ForeignKey("db.State", on_delete=models.CASCADE, related_name="issue_targets")
    target_date = models.DateField(null=True, blank=True)
    entered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["issue", "state"],
                condition=Q(deleted_at__isnull=True),
                name="task_state_target_unique_issue_state_when_not_deleted",
            )
        ]
        verbose_name = "Task State Target"
        verbose_name_plural = "Task State Targets"
        db_table = "task_state_targets"
        ordering = ("state__sequence",)

    def save(self, *args, **kwargs):
        if self._state.adding and not self.project_id:
            self.project = self.issue.project
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Task state target <{self.issue_id}:{self.state_id}>"
