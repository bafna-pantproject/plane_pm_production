/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// types
import type { TIssue } from "@plane/types";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

// free text, read-only here; edited from the issue sidebar, matching the kanban card treatment.
export const SpreadsheetCategoryColumn = observer(function SpreadsheetCategoryColumn(props: Props) {
  const { issue } = props;

  return (
    <div className="flex h-11 items-center border-b-[0.5px] border-subtle px-page-x">
      <span className="truncate text-13">{issue.category}</span>
    </div>
  );
});
