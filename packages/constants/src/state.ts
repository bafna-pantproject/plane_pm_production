/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TStateGroups, TStateRequiredField } from "@plane/types";

export type TDraggableData = {
  groupKey: TStateGroups;
  id: string;
};

export const STATE_GROUPS: {
  [key in TStateGroups]: {
    key: TStateGroups;
    label: string;
    defaultStateName: string;
    color: string;
  };
} = {
  backlog: {
    key: "backlog",
    label: "Backlog",
    defaultStateName: "Backlog",
    color: "#d9d9d9",
  },
  unstarted: {
    key: "unstarted",
    label: "Unstarted",
    defaultStateName: "Todo",
    color: "#3f76ff",
  },
  started: {
    key: "started",
    label: "Started",
    defaultStateName: "In Progress",
    color: "#f59e0b",
  },
  completed: {
    key: "completed",
    label: "Completed",
    defaultStateName: "Done",
    color: "#16a34a",
  },
  cancelled: {
    key: "cancelled",
    label: "Canceled",
    defaultStateName: "Cancelled",
    color: "#dc2626",
  },
};

// fields an admin can require for a state; i18n_label is resolved by the caller
export const STATE_REQUIRED_FIELDS: { key: TStateRequiredField; i18n_label: string }[] = [
  { key: "order_number", i18n_label: "common.order_number" },
  { key: "fit", i18n_label: "common.fit" },
  { key: "category", i18n_label: "common.category" },
  { key: "vendor", i18n_label: "common.vendor" },
  { key: "quantity", i18n_label: "common.quantity" },
  { key: "purchase_order_number", i18n_label: "common.purchase_order" },
  { key: "fabric_price", i18n_label: "common.fabric_price" },
  { key: "trims_price", i18n_label: "common.trims_price" },
  { key: "fob_price", i18n_label: "common.fob_price" },
  { key: "requested_delivery_date", i18n_label: "common.requested_delivery_date" },
  { key: "target_date", i18n_label: "common.order_by.due_date" },
];

export const STATE_REQUIRED_TNA_PREFIX = "tna_target:";

export const getTnaRequiredField = (stateId: string): TStateRequiredField => `${STATE_REQUIRED_TNA_PREFIX}${stateId}`;

/** the workflow state whose TNA target date a required-field key asks for, or null for any other key. */
export const getTnaRequiredFieldStateId = (field: TStateRequiredField): string | null =>
  field.startsWith(STATE_REQUIRED_TNA_PREFIX) ? field.slice(STATE_REQUIRED_TNA_PREFIX.length) : null;

export const ARCHIVABLE_STATE_GROUPS = [STATE_GROUPS.completed.key, STATE_GROUPS.cancelled.key];
export const COMPLETED_STATE_GROUPS = [STATE_GROUPS.completed.key];
export const PENDING_STATE_GROUPS = [
  STATE_GROUPS.backlog.key,
  STATE_GROUPS.unstarted.key,
  STATE_GROUPS.started.key,
  STATE_GROUPS.cancelled.key,
];

export const STATE_DISTRIBUTION = {
  [STATE_GROUPS.backlog.key]: {
    key: STATE_GROUPS.backlog.key,
    issues: "backlog_issues",
    points: "backlog_estimate_points",
  },
  [STATE_GROUPS.unstarted.key]: {
    key: STATE_GROUPS.unstarted.key,
    issues: "unstarted_issues",
    points: "unstarted_estimate_points",
  },
  [STATE_GROUPS.started.key]: {
    key: STATE_GROUPS.started.key,
    issues: "started_issues",
    points: "started_estimate_points",
  },
  [STATE_GROUPS.completed.key]: {
    key: STATE_GROUPS.completed.key,
    issues: "completed_issues",
    points: "completed_estimate_points",
  },
  [STATE_GROUPS.cancelled.key]: {
    key: STATE_GROUPS.cancelled.key,
    issues: "cancelled_issues",
    points: "cancelled_estimate_points",
  },
};

export const PROGRESS_STATE_GROUPS_DETAILS = [
  {
    key: "completed_issues",
    title: "Completed",
    color: "#16A34A",
  },
  {
    key: "started_issues",
    title: "Started",
    color: "#F59E0B",
  },
  {
    key: "unstarted_issues",
    title: "Unstarted",
    color: "#3A3A3A",
  },
  {
    key: "backlog_issues",
    title: "Backlog",
    color: "#A3A3A3",
  },
];

export const DISPLAY_WORKFLOW_PRO_CTA = false;
