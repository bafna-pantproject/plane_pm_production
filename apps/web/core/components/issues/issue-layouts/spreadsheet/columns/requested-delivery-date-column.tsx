/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { CalendarClock } from "lucide-react";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import type { TIssue } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
// hooks
import { useOrderDetail } from "@/hooks/store/use-order-detail";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetRequestedDeliveryDateColumn = observer(function SpreadsheetRequestedDeliveryDateColumn(
  props: Props
) {
  const { issue, disabled, onClose } = props;
  // i18n
  const { t } = useTranslation();
  // params
  const { workspaceSlug } = useParams();
  // store hooks
  const { updateIssueOrderDetail } = useOrderDetail();

  const handleRequestedDeliveryDate = async (date: Date | null) => {
    if (!workspaceSlug || !issue.project_id) return;
    await updateIssueOrderDetail(workspaceSlug.toString(), issue.project_id, issue.id, {
      requested_delivery_date: date ? renderFormattedPayloadDate(date) : null,
    });
  };

  return (
    <div className="h-11 border-b-[0.5px] border-subtle">
      <DateDropdown
        value={issue.requested_delivery_date ?? null}
        onChange={handleRequestedDeliveryDate}
        placeholder={t("common.requested_delivery_date")}
        icon={<CalendarClock className="h-3 w-3 flex-shrink-0" />}
        disabled={disabled}
        buttonVariant="transparent-with-text"
        buttonContainerClassName="w-full"
        buttonClassName="rounded-none px-page-x text-left group-[.selected-issue-row]:bg-accent-primary/5 group-[.selected-issue-row]:hover:bg-accent-primary/10"
        optionsClassName="z-[9]"
        clearIconClassName="!text-primary"
        onClose={onClose}
      />
    </div>
  );
});
