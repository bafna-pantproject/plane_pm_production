/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TStateGroups = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

/** work item fields an admin can require to be filled in before a work item enters a state. */
export type TStateRequiredField =
  | "order_number"
  | "fit"
  | "category"
  | "vendor"
  | "quantity"
  | "purchase_order_number"
  | "fabric_price"
  | "trims_price"
  | "fob_price"
  | "requested_delivery_date"
  | "target_date"
  // the TNA plan's target date for one workflow state: `tna_target:<state id>`
  | `tna_target:${string}`;

export interface IState {
  readonly id: string;
  color: string;
  default: boolean;
  description: string;
  group: TStateGroups;
  name: string;
  project_id: string;
  sequence: number;
  workspace_id: string;
  order: number;
  required_fields: TStateRequiredField[];
}

export interface IStateLite {
  color: string;
  group: TStateGroups;
  id: string;
  name: string;
}

export interface IStateResponse {
  [key: string]: IState[];
}

export type TStateOperationsCallbacks = {
  createState: (data: Partial<IState>) => Promise<IState>;
  updateState: (stateId: string, data: Partial<IState>) => Promise<IState | undefined>;
  deleteState: (stateId: string) => Promise<void>;
  moveStatePosition: (stateId: string, data: Partial<IState>) => Promise<void>;
  markStateAsDefault: (stateId: string) => Promise<void>;
};
