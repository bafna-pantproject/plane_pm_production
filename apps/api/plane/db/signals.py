# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from datetime import timedelta

# Django imports
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

# Module imports
from .models.issue import Issue
from .models.order import OrderDetail, StageLeadTime
from .models.state import State, StateGroup

TERMINAL_STATE_GROUPS = (StateGroup.COMPLETED, StateGroup.CANCELLED)


def _compute_tentative_completion_date(project_id, state, entered_at):
    """Tentative completion date = entered_at + sum of lead times for the
    current stage and every stage after it (by sequence) in the project.
    Terminal stages (completed/cancelled) are simply the entry date."""
    if state is None:
        return entered_at.date()

    if state.group in TERMINAL_STATE_GROUPS:
        return entered_at.date()

    # State.objects already excludes soft-deleted and triage states.
    remaining_state_ids = State.objects.filter(project_id=project_id, sequence__gte=state.sequence).values_list(
        "id", flat=True
    )

    lead_time_by_state = dict(
        StageLeadTime.objects.filter(project_id=project_id, state_id__in=remaining_state_ids).values_list(
            "state_id", "lead_time_days"
        )
    )
    # States without a lead-time row yet (e.g. pre-existing data) default to 1 day.
    total_days = sum(lead_time_by_state.get(state_id, 1) for state_id in remaining_state_ids)

    return entered_at.date() + timedelta(days=total_days)


def _persist_order_detail_stage(order_detail_id, project_id, state, entered_at=None):
    entered_at = entered_at or timezone.now()
    tentative_completion_date = _compute_tentative_completion_date(project_id, state, entered_at)
    # .update() bypasses save()/signals, so this can't recurse back into these handlers.
    OrderDetail.objects.filter(pk=order_detail_id).update(
        current_stage_entered_at=entered_at,
        tentative_completion_date=tentative_completion_date,
    )


@receiver(post_save, sender=State)
def seed_stage_lead_time(sender, instance, created, **kwargs):
    """Every state gets a default lead-time row so the completion-date
    computation never has to special-case a missing config entry."""
    if created:
        StageLeadTime.objects.get_or_create(state=instance, defaults={"project_id": instance.project_id})


@receiver(pre_save, sender=Issue)
def stash_previous_issue_state(sender, instance, **kwargs):
    if instance._state.adding:
        instance._previous_state_id = None
        return
    instance._previous_state_id = Issue.objects.filter(pk=instance.pk).values_list("state_id", flat=True).first()


@receiver(post_save, sender=Issue)
def sync_order_detail_on_state_change(sender, instance, created, **kwargs):
    if created:
        # Every issue is an order line - give it an OrderDetail row up front.
        # This creation triggers init_order_detail_stage() below via its own post_save.
        OrderDetail.objects.get_or_create(issue=instance, defaults={"project_id": instance.project_id})
        return

    previous_state_id = getattr(instance, "_previous_state_id", None)
    if previous_state_id == instance.state_id:
        return
    try:
        order_detail_id = instance.order_detail.id
    except OrderDetail.DoesNotExist:
        return
    _persist_order_detail_stage(order_detail_id, instance.project_id, instance.state)


@receiver(post_save, sender=OrderDetail)
def init_order_detail_stage(sender, instance, created, **kwargs):
    if created and instance.current_stage_entered_at is None:
        _persist_order_detail_stage(
            instance.id, instance.project_id, instance.issue.state, entered_at=timezone.now()
        )


@receiver(post_save, sender=StageLeadTime)
def recompute_on_lead_time_change(sender, instance, **kwargs):
    order_details = OrderDetail.objects.filter(project_id=instance.project_id).exclude(
        issue__state__group__in=TERMINAL_STATE_GROUPS
    ).select_related("issue__state")
    for order_detail in order_details:
        _persist_order_detail_stage(
            order_detail.id,
            instance.project_id,
            order_detail.issue.state,
            entered_at=order_detail.current_stage_entered_at,
        )
