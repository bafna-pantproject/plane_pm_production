/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
// plane imports
import { DEFAULT_WORK_ITEM_FORM_VALUES } from "@plane/constants";
import type { IPartialProject, ISearchIssueResponse, IState, TIssue } from "@plane/types";

/** fit and category shown as one value, e.g. "Slim Fit T-Shirts" (either may be blank). */
export const formatFitCategory = (fit: string | null | undefined, category: string | null | undefined): string =>
  [fit?.trim(), category?.trim()].filter(Boolean).join(" ");

/** a style as picked in dropdowns: its code (the style id), plus its name when that adds anything */
export const formatStyleLabel = (style: { code: string; name: string } | null | undefined): string => {
  if (!style) return "";
  return style.name && style.name !== style.code ? `${style.code} · ${style.name}` : style.code;
};

// Work items are identified by category/vendor/quantity instead of a free-form title.
// Sub work items use their style code in place of the category.
// Every place that can change one of those 3 values (the create/edit modal, the issue
// detail sidebar's vendor dropdown) recomputes the work item's name with this so the
// board/list/kanban views - which only ever display the plain name field - stay in sync.
export const composeOrderDetailName = (
  category: string | null | undefined,
  vendorName: string | null | undefined,
  quantity: number | null | undefined
): string | null => {
  const parts = [category || undefined, vendorName || undefined, quantity ? `${quantity} units` : undefined].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" - ") : null;
};

export const getUpdateFormDataForReset = (projectId: string | null | undefined, formData: Partial<TIssue>) => ({
  ...DEFAULT_WORK_ITEM_FORM_VALUES,
  project_id: projectId,
  name: formData.name,
  description_html: formData.description_html,
  priority: formData.priority,
  start_date: formData.start_date,
  target_date: formData.target_date,
});

export const convertWorkItemDataToSearchResponse = (
  workspaceSlug: string,
  workItem: TIssue,
  project: IPartialProject | undefined,
  state: IState | undefined
): ISearchIssueResponse => ({
  id: workItem.id,
  name: workItem.name,
  project_id: workItem.project_id ?? "",
  project__identifier: project?.identifier ?? "",
  project__name: project?.name ?? "",
  sequence_id: workItem.sequence_id,
  type_id: workItem.type_id ?? "",
  state__color: state?.color ?? "",
  start_date: workItem.start_date,
  state__group: state?.group ?? "backlog",
  state__name: state?.name ?? "",
  workspace__slug: workspaceSlug,
});

export function getChangedIssuefields(formData: Partial<TIssue>, dirtyFields: { [key: string]: boolean | undefined }) {
  const changedFields = {};

  const dirtyFieldKeys = Object.keys(dirtyFields) as (keyof TIssue)[];
  for (const dirtyField of dirtyFieldKeys) {
    if (dirtyFields[dirtyField]) {
      set(changedFields, [dirtyField], formData[dirtyField]);
    }
  }

  return changedFields as Partial<TIssue>;
}
