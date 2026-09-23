# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Case, DateField, DateTimeField, OuterRef, Subquery, UUIDField, Value, When
from django.utils import timezone

from plane.db.models import State, TaskStateTarget
from plane.utils.order_queryset import STATE_ORDER


def get_next_state_map(project_id) -> dict:
    """{current_state_id: next_state_id} for a project's state sequence
    (grouped by workflow group, then by sequence within the group). A
    terminal state simply has no key in the returned map."""
    states = list(State.objects.filter(project_id=project_id, deleted_at__isnull=True))
    states.sort(key=lambda s: (STATE_ORDER.index(s.group) if s.group in STATE_ORDER else len(STATE_ORDER), s.sequence))
    ordered_ids = [s.id for s in states]
    return {ordered_ids[i]: ordered_ids[i + 1] for i in range(len(ordered_ids) - 1)}


def annotate_next_state_target_fields(queryset, project_id):
    """Adds next_state_target_date / next_state_target_entered_at, read-only
    display fields for the next-stage TNA flag. NULL when the project has
    fewer than 2 states or the issue's current state is terminal."""
    next_state_map = get_next_state_map(project_id)
    if not next_state_map:
        return queryset.annotate(
            next_state_target_date=Value(None, output_field=DateField()),
            next_state_target_entered_at=Value(None, output_field=DateTimeField()),
        )
    queryset = queryset.annotate(
        next_state_id=Case(
            *[When(state_id=current_id, then=Value(next_id)) for current_id, next_id in next_state_map.items()],
            default=Value(None),
            output_field=UUIDField(),
        )
    )
    target_subquery = TaskStateTarget.objects.filter(issue=OuterRef("id"), state_id=OuterRef("next_state_id"))
    return queryset.annotate(
        next_state_target_date=Subquery(target_subquery.values("target_date")[:1]),
        next_state_target_entered_at=Subquery(target_subquery.values("entered_at")[:1]),
    )


def bucket_flag_severity(days_diff: int):
    """days_diff = today - target_date (positive = overdue)."""
    if days_diff >= 10:
        return "red"
    if days_diff > 0:
        return "orange"
    if days_diff >= -10:
        return "yellow"
    return None


def get_flagged_issue_ids(project_id, severities: set) -> list:
    """Server-side resolution for the flag-severity quick filter. Done in
    Python (not the ORM) to keep the day-diff bucketing logic in one place,
    shared with bucket_flag_severity."""
    next_state_map = get_next_state_map(project_id)
    if not next_state_map:
        return []
    today = timezone.localdate()
    rows = TaskStateTarget.objects.filter(
        project_id=project_id,
        entered_at__isnull=True,
        target_date__isnull=False,
        state_id__in=set(next_state_map.values()),
    ).values("issue_id", "state_id", "target_date", "issue__state_id")
    matching_issue_ids = []
    for row in rows:
        if next_state_map.get(row["issue__state_id"]) != row["state_id"]:
            continue
        severity = bucket_flag_severity((today - row["target_date"]).days)
        if severity and severity in severities:
            matching_issue_ids.append(row["issue_id"])
    return matching_issue_ids
