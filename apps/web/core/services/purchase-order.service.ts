/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TPurchaseOrder } from "@plane/types";
import { APIService } from "@/services/api.service";

export class PurchaseOrderService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getPurchaseOrders(workspaceSlug: string): Promise<TPurchaseOrder[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/purchase-orders/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createPurchaseOrder(workspaceSlug: string, data: Partial<TPurchaseOrder>): Promise<TPurchaseOrder> {
    return this.post(`/api/workspaces/${workspaceSlug}/purchase-orders/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchPurchaseOrder(
    workspaceSlug: string,
    purchaseOrderId: string,
    data: Partial<TPurchaseOrder>
  ): Promise<TPurchaseOrder> {
    return this.patch(`/api/workspaces/${workspaceSlug}/purchase-orders/${purchaseOrderId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deletePurchaseOrder(workspaceSlug: string, purchaseOrderId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/purchase-orders/${purchaseOrderId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
