/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// types
import type { TIssue } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// components
import { TnaFlagIndicator } from "@/components/issues/issue-layouts/properties/tna-flag-indicator";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

// read-only computed indicator; see getTnaFlagSeverity for the flagging rule.
export const SpreadsheetTnaFlagColumn = observer(function SpreadsheetTnaFlagColumn(props: Props) {
  const { issue } = props;

  return (
    <div className="flex h-11 items-center gap-2 border-b-[0.5px] border-subtle px-page-x">
      <TnaFlagIndicator issue={issue} />
      {issue.next_state_target_date && (
        <span className="truncate text-13">{renderFormattedDate(issue.next_state_target_date)}</span>
      )}
    </div>
  );
});
