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
        instance._previous_target_date = None
        return
    previous = Issue.objects.filter(pk=instance.pk).values_list("state_id", "target_date").first()
    instance._previous_state_id, instance._previous_target_date = previous or (None, None)


@receiver(post_save, sender=Issue)
def create_order_detail_on_issue_creation(sender, instance, created, **kwargs):
    if created:
        # Every issue is an order line - give it an OrderDetail row up front.
        OrderDetail.objects.get_or_create(issue=instance, defaults={"project_id": instance.project_id})


@receiver(post_save, sender=Issue)
def trickle_down_order_details_to_new_sub_issue(sender, instance, created, **kwargs):
    """When a new work item is created directly under a parent (parent set at
    creation time), seed its vendor, order number, fit, category, vendor promised
    delivery date (target_date), requested delivery date, and TNA plan (per-state
    target dates) from the parent's. Sub work items are identified by their style
    instead, so the category is always the parent's. This is a one-time copy at creation only -
    each field is independently editable afterward. The two delivery dates are the exception:
    a later change to the parent's is pushed down again (see sync_*_to_sub_issues below).

    target_date is only trickled down if the child doesn't already have one -
    the create form sets target_date directly on the same creation call, so an
    explicit choice made while creating the sub-issue must win over the
    parent's value. vendor/order_number/requested_delivery_date live on the
    separate OrderDetail row instead, which is always blank at this point (an
    explicit choice for those only reaches OrderDetail via a later PATCH after
    creation), so overwriting them here unconditionally is safe.

    Must run before track_task_state_target_entry below: if the child is
    created straight into a state the parent already had a target for, the
    copied TaskStateTarget row needs to exist before that receiver runs so its
    entered_at gets backfilled correctly on this same save.
    """
    if not created or not instance.parent_id:
        return

    parent_issue = Issue.objects.filter(pk=instance.parent_id).only("target_date").first()
    if parent_issue and parent_issue.target_date and not instance.target_date:
        Issue.objects.filter(pk=instance.pk).update(target_date=parent_issue.target_date)

    parent_order_detail = OrderDetail.objects.filter(issue_id=instance.parent_id).first()
    if parent_order_detail:
        OrderDetail.objects.update_or_create(
            issue=instance,
            defaults={
                "project_id": instance.project_id,
                "vendor_id": parent_order_detail.vendor_id,
                "order_number": parent_order_detail.order_number,
                "fit": parent_order_detail.fit,
                "category": parent_order_detail.category,
                "requested_delivery_date": parent_order_detail.requested_delivery_date,
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
    """Stamp entered_at on the TaskStateTarget row for the state an issue just
    transitioned into (including its initial state on creation), creating the
    row if one doesn't already exist so every state entry is recorded as the
    "actual start date" - not only states a target_date was already set on."""
    previous_state_id = getattr(instance, "_previous_state_id", None)
    if previous_state_id == instance.state_id or not instance.state_id:
        return
    TaskStateTarget.objects.update_or_create(
        issue=instance,
        state_id=instance.state_id,
        defaults={"project_id": instance.project_id, "entered_at": timezone.now()},
    )


# A parent order's dates are its sub work items' dates: changing the parent's vendor promised
# delivery date (Issue.target_date) or requested delivery date (OrderDetail) sets it on all of
# its direct sub work items too. Clearing a parent's date leaves the sub-items' dates alone, so
# an accidental clear can't wipe them. Queryset updates, so the sub-items' own save signals and
# activity don't run.


@receiver(post_save, sender=Issue)
def sync_target_date_to_sub_issues(sender, instance, created, **kwargs):
    if created or not instance.target_date:
        return
    if instance.target_date == getattr(instance, "_previous_target_date", instance.target_date):
        return
    Issue.objects.filter(parent_id=instance.pk).exclude(target_date=instance.target_date).update(
        target_date=instance.target_date, updated_at=timezone.now()
    )


@receiver(pre_save, sender=OrderDetail)
def stash_previous_requested_delivery_date(sender, instance, **kwargs):
    instance._previous_requested_delivery_date = (
        None
        if instance._state.adding
        else OrderDetail.objects.filter(pk=instance.pk).values_list("requested_delivery_date", flat=True).first()
    )


@receiver(post_save, sender=OrderDetail)
def sync_requested_delivery_date_to_sub_issues(sender, instance, created, **kwargs):
    new_date = instance.requested_delivery_date
    if created or not new_date or new_date == getattr(instance, "_previous_requested_delivery_date", new_date):
        return
    OrderDetail.objects.filter(issue__parent_id=instance.issue_id, issue__deleted_at__isnull=True).exclude(
        requested_delivery_date=new_date
    ).update(requested_delivery_date=new_date, updated_at=timezone.now())
