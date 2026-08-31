/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TPurchaseOrder } from "@plane/types";
// services
import { PurchaseOrderService } from "@/services/purchase-order.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IPurchaseOrderStore {
  fetchedMap: Record<string, boolean>;
  purchaseOrderMap: Record<string, TPurchaseOrder>;
  workspacePurchaseOrders: TPurchaseOrder[] | undefined;
  getPurchaseOrderById: (purchaseOrderId: string) => TPurchaseOrder | null;
  fetchWorkspacePurchaseOrders: (workspaceSlug: string) => Promise<TPurchaseOrder[]>;
  createPurchaseOrder: (workspaceSlug: string, data: Partial<TPurchaseOrder>) => Promise<TPurchaseOrder>;
  updatePurchaseOrder: (
    workspaceSlug: string,
    purchaseOrderId: string,
    data: Partial<TPurchaseOrder>
  ) => Promise<TPurchaseOrder>;
  deletePurchaseOrder: (workspaceSlug: string, purchaseOrderId: string) => Promise<void>;
}

export class PurchaseOrderStore implements IPurchaseOrderStore {
  rootStore;
  purchaseOrderMap: Record<string, TPurchaseOrder> = {};
  fetchedMap: Record<string, boolean> = {};
  purchaseOrderService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      purchaseOrderMap: observable,
      fetchedMap: observable,
      workspacePurchaseOrders: computed,
      fetchWorkspacePurchaseOrders: action,
      createPurchaseOrder: action,
      updatePurchaseOrder: action,
      deletePurchaseOrder: action,
    });

    this.rootStore = _rootStore;
    this.purchaseOrderService = new PurchaseOrderService();
  }

  get workspacePurchaseOrders() {
    const workspaceSlug = this.rootStore.router.workspaceSlug;
    if (!workspaceSlug || !this.fetchedMap[workspaceSlug]) return undefined;
    return Object.values(this.purchaseOrderMap);
  }

  getPurchaseOrderById = computedFn(
    (purchaseOrderId: string): TPurchaseOrder | null => this.purchaseOrderMap?.[purchaseOrderId] ?? null
  );

  fetchWorkspacePurchaseOrders = async (workspaceSlug: string) =>
    await this.purchaseOrderService.getPurchaseOrders(workspaceSlug).then((response) => {
      runInAction(() => {
        response.forEach((purchaseOrder) => set(this.purchaseOrderMap, [purchaseOrder.id], purchaseOrder));
        set(this.fetchedMap, workspaceSlug, true);
      });
      return response;
    });

  createPurchaseOrder = async (workspaceSlug: string, data: Partial<TPurchaseOrder>) =>
    await this.purchaseOrderService.createPurchaseOrder(workspaceSlug, data).then((response) => {
      runInAction(() => set(this.purchaseOrderMap, [response.id], response));
      return response;
    });

  updatePurchaseOrder = async (workspaceSlug: string, purchaseOrderId: string, data: Partial<TPurchaseOrder>) => {
    const original = this.purchaseOrderMap[purchaseOrderId];
    try {
      runInAction(() => set(this.purchaseOrderMap, [purchaseOrderId], { ...original, ...data }));
      return await this.purchaseOrderService.patchPurchaseOrder(workspaceSlug, purchaseOrderId, data);
    } catch (error) {
      runInAction(() => set(this.purchaseOrderMap, [purchaseOrderId], original));
      throw error;
    }
  };

  deletePurchaseOrder = async (workspaceSlug: string, purchaseOrderId: string) => {
    await this.purchaseOrderService.deletePurchaseOrder(workspaceSlug, purchaseOrderId);
    runInAction(() => delete this.purchaseOrderMap[purchaseOrderId]);
  };
}
