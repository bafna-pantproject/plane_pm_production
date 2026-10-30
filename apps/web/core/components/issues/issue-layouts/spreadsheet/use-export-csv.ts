/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import { download, generateCsv, mkConfig } from "export-to-csv";
// plane imports
import { ISSUE_PRIORITIES, SPREADSHEET_PROPERTY_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { IIssueDisplayProperties, TIssue, TIssueMap } from "@plane/types";
import { EEstimateSystem } from "@plane/types";
import { convertMinutesToHoursMinutesString, getTnaFlagSeverity, renderFormattedDate } from "@plane/utils";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useCycle } from "@/hooks/store/use-cycle";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useVendor } from "@/hooks/store/use-vendor";

const PRIORITY_TITLES: Record<string, string> = Object.fromEntries(
  ISSUE_PRIORITIES.map((priority) => [priority.key, priority.title])
);

// date-valued columns, formatted the same way regardless of which issue field backs them.
const DATE_PROPERTIES = new Set<keyof IIssueDisplayProperties>([
  "start_date",
  "due_date",
  "created_on",
  "updated_on",
  "requested_delivery_date",
]);

export const useExportSpreadsheetCsv = () => {
  const { t } = useTranslation();
  const { getProjectIdentifierById } = useProject();
  const { getStateById } = useProjectState();
  const { labelMap } = useLabel();
  const { getModuleById } = useModule();
  const { getCycleById } = useCycle();
  const { getVendorById } = useVendor();
  const { getUserDetails } = useMember();
  const { currentActiveEstimateIdByProjectId, estimates } = useProjectEstimates();

  const getEstimateText = useCallback(
    (issue: TIssue) => {
      if (!issue.project_id || !issue.estimate_point) return "";
      const estimateId = currentActiveEstimateIdByProjectId(issue.project_id);
      const estimate = estimateId ? estimates[estimateId] : undefined;
      const point = estimate?.estimatePointById(issue.estimate_point);
      if (!point) return "";
      return estimate?.type === EEstimateSystem.TIME
        ? convertMinutesToHoursMinutesString(Number(point.value))
        : (point.value ?? "");
    },
    [currentActiveEstimateIdByProjectId, estimates]
  );

  const getColumnText = useCallback(
    (property: keyof IIssueDisplayProperties, issue: TIssue): string => {
      if (DATE_PROPERTIES.has(property)) {
        const dateField = property === "due_date" ? issue.target_date : (issue as Record<string, unknown>)[property];
        return dateField ? (renderFormattedDate(dateField as string) ?? "") : "";
      }

      switch (property) {
        case "assignee":
          return (issue.assignee_ids ?? [])
            .map((id) => getUserDetails(id)?.display_name)
            .filter(Boolean)
            .join(", ");
        case "labels":
          return (issue.label_ids ?? [])
            .map((id) => labelMap[id]?.name)
            .filter(Boolean)
            .join(", ");
        case "priority":
          return issue.priority ? (PRIORITY_TITLES[issue.priority] ?? issue.priority) : "";
        case "state":
          return getStateById(issue.state_id)?.name ?? "";
        case "modules":
          return (issue.module_ids ?? [])
            .map((id) => getModuleById(id)?.name)
            .filter(Boolean)
            .join(", ");
        case "cycle":
          return getCycleById(issue.cycle_id ?? "")?.name ?? "";
        case "estimate":
          return getEstimateText(issue);
        case "link":
          return issue.link_count != null ? String(issue.link_count) : "";
        case "attachment_count":
          return issue.attachment_count != null ? String(issue.attachment_count) : "";
        case "sub_issue_count":
          return issue.sub_issues_count != null ? String(issue.sub_issues_count) : "";
        case "vendor":
          return getVendorById(issue.vendor_id ?? "")?.name ?? "";
        case "category":
          return issue.category ?? "";
        case "order_number":
          return issue.order_number ?? "";
        case "quantity":
          return issue.quantity != null ? String(issue.quantity) : "";
        case "tna_flag": {
          const severity = getTnaFlagSeverity(issue.next_state_target_date, issue.next_state_target_entered_at);
          if (!severity) return "";
          const date = issue.next_state_target_date ? renderFormattedDate(issue.next_state_target_date) : "";
          return [severity, date].filter(Boolean).join(" - ");
        }
        default:
          return "";
      }
    },
    [getCycleById, getEstimateText, getModuleById, getStateById, getUserDetails, getVendorById, labelMap]
  );

  const exportToCsv = useCallback(
    (
      issueIds: string[],
      issueMap: TIssueMap,
      spreadsheetColumnsList: (keyof IIssueDisplayProperties)[],
      displayProperties: IIssueDisplayProperties,
      filenamePrefix: string
    ) => {
      const visibleColumns = spreadsheetColumnsList.filter((property) => displayProperties[property] ?? true);

      const rows = issueIds.flatMap((issueId) => {
        const issue = issueMap[issueId];
        if (!issue) return [];
        const row: Record<string, string> = {
          ID: `${getProjectIdentifierById(issue.project_id)}-${issue.sequence_id}`,
          [t("common.title")]: issue.name ?? "",
        };
        for (const property of visibleColumns) {
          const title = t(SPREADSHEET_PROPERTY_DETAILS[property]?.i18n_title ?? property);
          row[title] = getColumnText(property, issue);
        }
        return [row];
      });

      const csvConfig = mkConfig({
        fieldSeparator: ",",
        filename: `${filenamePrefix}-export`,
        decimalSeparator: ".",
        useKeysAsHeaders: true,
      });
      const csv = generateCsv(csvConfig)(rows);
      download(csvConfig)(csv);
    },
    [getColumnText, getProjectIdentifierById, t]
  );

  return { exportToCsv };
};
