# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

# Module imports
from .models.issue import Issue
from .models.order import OrderDetail, TaskStateTarget


@receiver(pre_save, sender=Issue)
def stash_previous_issue_state(sender, instance, **kwargs):
    if instance._state.adding:
        instance._previous_state_id = None
        return
    instance._previous_state_id = Issue.objects.filter(pk=instance.pk).values_list("state_id", flat=True).first()


@receiver(post_save, sender=Issue)
def create_order_detail_on_issue_creation(sender, instance, created, **kwargs):
    if created:
        # Every issue is an order line - give it an OrderDetail row up front.
        OrderDetail.objects.get_or_create(issue=instance, defaults={"project_id": instance.project_id})


@receiver(post_save, sender=Issue)
def trickle_down_order_details_to_new_sub_issue(sender, instance, created, **kwargs):
    """When a new work item is created directly under a parent (parent set at
    creation time), seed its vendor, order number, and TNA plan (per-state
    target dates) from the parent's. This is a one-time copy at creation only -
    each field is independently editable afterward and is never re-synced from
    the parent again.

    Must run before track_task_state_target_entry below: if the child is
    created straight into a state the parent already had a target for, the
    copied TaskStateTarget row needs to exist before that receiver runs so its
    entered_at gets backfilled correctly on this same save.
    """
    if not created or not instance.parent_id:
        return

    parent_order_detail = OrderDetail.objects.filter(issue_id=instance.parent_id).first()
    if parent_order_detail:
        OrderDetail.objects.update_or_create(
            issue=instance,
            defaults={
                "project_id": instance.project_id,
                "vendor_id": parent_order_detail.vendor_id,
                "order_number": parent_order_detail.order_number,
            },
        )

    parent_targets = TaskStateTarget.objects.filter(issue_id=instance.parent_id, target_date__isnull=False)
    for parent_target in parent_targets:
        TaskStateTarget.objects.get_or_create(
            issue=instance,
            state_id=parent_target.state_id,
            defaults={"project_id": instance.project_id, "target_date": parent_target.target_date},
        )


@receiver(post_save, sender=Issue)
def track_task_state_target_entry(sender, instance, created, **kwargs):
    """Backfill entered_at on a TaskStateTarget row when the issue transitions
    into a state a target was already set for. Sparse: never creates a row -
    only updates one that a user already set a target_date on."""
    previous_state_id = getattr(instance, "_previous_state_id", None)
    if previous_state_id == instance.state_id or not instance.state_id:
        return
    TaskStateTarget.objects.filter(issue=instance, state_id=instance.state_id).update(entered_at=timezone.now())
