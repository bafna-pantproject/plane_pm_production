# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import json
from datetime import date, datetime, time

# Django imports
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

# Module imports
from plane.db.models import Issue, State, TaskStateTarget


class Command(BaseCommand):
    help = (
        "One-time backfill of TaskStateTarget.entered_at (the TNA 'actual' date per state) from a "
        "JSON file written by plane_setup's create_work_items_from_csv_elab.py --apply. entered_at "
        "is deliberately read-only in the API, so historical dates from the Master Production Sheet "
        "are loaded here instead. Creates the TaskStateTarget row when missing and overwrites any "
        "existing entered_at. Runs as a dry run by default; pass --apply to commit."
    )

    def add_arguments(self, parser):
        parser.add_argument("json_path", help='File of {"project_id": ..., "entries": [{issue_id, state_id, entered_at}, ...]}.')
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the entered_at values. Without this flag, nothing is written.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        try:
            with open(options["json_path"], encoding="utf-8") as f:
                payload = json.load(f)
        except (OSError, ValueError) as e:
            raise CommandError(f"Could not read {options['json_path']}: {e}")

        project_id = payload["project_id"]
        entries = payload["entries"]

        # Only accept work items and states that really belong to the file's project, so a
        # file pointed at the wrong project can't touch anything.
        issue_ids = {entry["issue_id"] for entry in entries}
        state_ids = {entry["state_id"] for entry in entries}
        valid_issue_ids = {
            str(pk) for pk in Issue.issue_objects.filter(pk__in=issue_ids, project_id=project_id).values_list("pk", flat=True)
        }
        valid_state_ids = {
            str(pk) for pk in State.objects.filter(pk__in=state_ids, project_id=project_id).values_list("pk", flat=True)
        }
        existing = {
            (str(target.issue_id), str(target.state_id)): target
            for target in TaskStateTarget.objects.filter(issue_id__in=valid_issue_ids, state_id__in=valid_state_ids)
        }

        to_update: list[TaskStateTarget] = []
        to_create: list[TaskStateTarget] = []
        skipped: list[tuple[dict, str]] = []

        for entry in entries:
            issue_id, state_id = entry["issue_id"], entry["state_id"]
            if issue_id not in valid_issue_ids:
                skipped.append((entry, "work item not found in project"))
                continue
            if state_id not in valid_state_ids:
                skipped.append((entry, "state not found in project"))
                continue
            try:
                entered_date = date.fromisoformat(entry["entered_at"])
            except (TypeError, ValueError):
                skipped.append((entry, "entered_at is not a YYYY-MM-DD date"))
                continue
            # The sheet only has a day, so store midnight of that day in the server's timezone.
            entered_at = timezone.make_aware(datetime.combine(entered_date, time.min))

            target = existing.get((issue_id, state_id))
            if target is None:
                to_create.append(
                    TaskStateTarget(issue_id=issue_id, state_id=state_id, project_id=project_id, entered_at=entered_at)
                )
            else:
                target.entered_at = entered_at
                to_update.append(target)

        self.stdout.write(f"Read {len(entries)} entr(y/ies) for project {project_id}.")
        self.stdout.write(f"  Existing TaskStateTarget rows to update: {len(to_update)}")
        self.stdout.write(f"  New TaskStateTarget rows to create: {len(to_create)}")

        if skipped:
            self.stdout.write(self.style.WARNING(f"{len(skipped)} entr(y/ies) skipped:"))
            for entry, reason in skipped[:50]:
                self.stdout.write(
                    f'    {reason}: issue={entry.get("issue_id")}  state={entry.get("state_name")}  '
                    f'external_id="{entry.get("external_id")}"'
                )
            if len(skipped) > 50:
                self.stdout.write(f"    ...and {len(skipped) - 50} more")

        if not apply_changes:
            self.stdout.write(self.style.NOTICE("Dry run only - nothing was written. Re-run with --apply to commit."))
            return

        with transaction.atomic():
            TaskStateTarget.objects.bulk_update(to_update, ["entered_at"], batch_size=500)
            # save() rather than bulk_create so ProjectBaseModel.save() fills in workspace.
            for target in to_create:
                target.save()

        self.stdout.write(self.style.SUCCESS(f"Backfilled entered_at on {len(to_update) + len(to_create)} TaskStateTarget row(s)."))
