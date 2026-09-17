/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { DueDatePropertyIcon } from "@plane/propel/icons";
// types
import type { TIssue } from "@plane/types";
import { cn, getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { ReasonConfirmationModal } from "@/components/issues/issue-detail/reason-confirmation-modal";
// helpers
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useDateChangeReason } from "@/hooks/use-date-change-reason";
// i18n
import { useTranslation } from "@plane/i18n";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetDueDateColumn = observer(function SpreadsheetDueDateColumn(props: Props) {
  const { issue, onChange, disabled, onClose } = props;
  const { t } = useTranslation();
  // params
  const { workspaceSlug } = useParams();
  // store hooks
  const { getStateById } = useProjectState();
  // reason-required confirmation for changing an already-set due date
  const { requestChange, reasonModalProps } = useDateChangeReason({
    workspaceSlug: workspaceSlug?.toString(),
    projectId: issue.project_id,
    issueId: issue.id,
    commentLabel: "Vendor Promised Delivery Date Changed",
  });
  // derived values
  const stateDetails = getStateById(issue.state_id);

  const applyTargetDate = (data: Date | null) => {
    const targetDate = data ? renderFormattedPayloadDate(data) : null;
    onChange(
      issue,
      { target_date: targetDate },
      {
        changed_property: "target_date",
        change_details: targetDate,
      }
    );
  };

  return (
    <>
      <div className="h-11 border-b-[0.5px] border-subtle">
        <DateDropdown
          value={issue.target_date}
          minDate={getDate(issue.start_date)}
          onChange={(data) => requestChange(!!issue.target_date, () => applyTargetDate(data))}
          disabled={disabled}
          placeholder="Vendor promised delivery date"
          icon={<DueDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
          buttonVariant="transparent-with-text"
          buttonContainerClassName="w-full"
          buttonClassName={cn(
            "rounded-none px-page-x text-left group-[.selected-issue-row]:bg-accent-primary/5 group-[.selected-issue-row]:hover:bg-accent-primary/10",
            {
              "text-danger-primary": shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group),
            }
          )}
          optionsClassName="z-[9]"
          clearIconClassName="!text-primary"
          onClose={onClose}
        />
      </div>
      <ReasonConfirmationModal
        {...reasonModalProps}
        title={t("common.due_date_change_reason_title")}
        description={t("common.due_date_change_reason_description")}
      />
    </>
  );
});
