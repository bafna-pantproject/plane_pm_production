/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export interface TVendor {
  readonly id: string;
  workspace_id: string;
  name: string;
  code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  is_active: boolean;
}

export interface TStyle {
  readonly id: string;
  workspace_id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface TPurchaseOrder {
  readonly id: string;
  workspace_id: string;
  po_number: string;
  vendor: string;
  issued_date: string | null;
  notes: string;
}

export interface TStageLeadTime {
  readonly id: string;
  workspace_id: string;
  project_id: string;
  state: string;
  lead_time_days: number;
}

export interface TOrderDetail {
  readonly id: string;
  workspace_id: string;
  project_id: string;
  readonly issue: string;
  vendor: string | null;
  style: string | null;
  purchase_order: string | null;
  requested_delivery_date: string | null;
  vendor_promised_date: string | null;
  readonly current_stage_entered_at: string | null;
  readonly tentative_completion_date: string | null;
}
