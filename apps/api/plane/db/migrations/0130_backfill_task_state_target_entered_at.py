from collections import defaultdict

from django.db import migrations

BATCH_SIZE = 500


def backfill_entered_at(apps, schema_editor):
    """Reconstruct entered_at for work items that existed before every state
    entry was tracked: the initial state is entered at issue creation, and each
    logged state change (IssueActivity field="state") enters its new state.
    The latest entry per state wins, matching the live signal's re-entry
    behaviour. Rows that already have an entered_at are left untouched."""
    Issue = apps.get_model("db", "Issue")
    IssueActivity = apps.get_model("db", "IssueActivity")
    State = apps.get_model("db", "State")
    TaskStateTarget = apps.get_model("db", "TaskStateTarget")

    state_project = dict(State._default_manager.filter(deleted_at__isnull=True).values_list("id", "project_id"))

    entries = defaultdict(dict)
    initial_state = {}
    activities = (
        IssueActivity._default_manager.filter(field="state", deleted_at__isnull=True, issue_id__isnull=False)
        .order_by("created_at")
        .values_list("issue_id", "old_identifier", "new_identifier", "created_at")
    )
    for issue_id, old_state_id, new_state_id, created_at in activities.iterator(chunk_size=BATCH_SIZE):
        initial_state.setdefault(issue_id, old_state_id)
        if new_state_id:
            entries[issue_id][new_state_id] = created_at

    existing = {
        (issue_id, state_id): (pk, entered_at)
        for pk, issue_id, state_id, entered_at in TaskStateTarget._default_manager.filter(deleted_at__isnull=True).values_list(
            "id", "issue_id", "state_id", "entered_at"
        )
    }

    to_create = []
    to_update = []
    issues = Issue._default_manager.filter(deleted_at__isnull=True).values_list(
        "id", "project_id", "workspace_id", "state_id", "created_at"
    )
    for issue_id, project_id, workspace_id, current_state_id, created_at in issues.iterator(chunk_size=BATCH_SIZE):
        issue_entries = entries.get(issue_id, {})
        first_state_id = initial_state[issue_id] if issue_id in initial_state else current_state_id
        if first_state_id and first_state_id not in issue_entries:
            issue_entries[first_state_id] = created_at

        for state_id, entered_at in issue_entries.items():
            if state_project.get(state_id) != project_id:
                continue
            row = existing.get((issue_id, state_id))
            if row is None:
                to_create.append(
                    TaskStateTarget(
                        issue_id=issue_id,
                        state_id=state_id,
                        project_id=project_id,
                        workspace_id=workspace_id,
                        entered_at=entered_at,
                    )
                )
            elif row[1] is None:
                to_update.append(TaskStateTarget(id=row[0], entered_at=entered_at))

    TaskStateTarget._default_manager.bulk_create(to_create, batch_size=BATCH_SIZE)
    TaskStateTarget._default_manager.bulk_update(to_update, ["entered_at"], batch_size=BATCH_SIZE)


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0129_vendor_increff_supplier_id"),
    ]

    operations = [
        migrations.RunPython(backfill_entered_at, migrations.RunPython.noop),
    ]
