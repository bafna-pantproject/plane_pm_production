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
def track_task_state_target_entry(sender, instance, created, **kwargs):
    """Backfill entered_at on a TaskStateTarget row when the issue transitions
    into a state a target was already set for. Sparse: never creates a row -
    only updates one that a user already set a target_date on."""
    previous_state_id = getattr(instance, "_previous_state_id", None)
    if previous_state_id == instance.state_id or not instance.state_id:
        return
    TaskStateTarget.objects.filter(issue=instance, state_id=instance.state_id).update(entered_at=timezone.now())
