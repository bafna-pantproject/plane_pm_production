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
  increff_supplier_id: string;
  address: string;
  is_active: boolean;
}

export interface TVendorCapacity {
  readonly id: string;
  workspace_id: string;
  readonly vendor: string;
  year: number;
  month: number;
  capacity: number;
}

export interface TVendorCapacityUsage {
  year: number;
  month: number;
  used: number;
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

export interface TOrderDetail {
  readonly id: string;
  workspace_id: string;
  project_id: string;
  readonly issue: string;
  order_number: string;
  category: string;
  quantity: number | null;
  vendor: string | null;
  style: string | null;
  purchase_order: string | null;
  purchase_order_number: string;
  // decimals arrive from the API as strings, e.g. "12.50"
  fabric_price: string | null;
  trims_price: string | null;
  fob_price: string | null;
  requested_delivery_date: string | null;
}

export interface TTaskStateTarget {
  readonly id: string;
  workspace_id: string;
  project_id: string;
  readonly issue: string;
  readonly state: string;
  target_date: string | null;
  readonly entered_at: string | null;
}
