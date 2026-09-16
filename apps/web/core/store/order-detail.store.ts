/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TOrderDetail } from "@plane/types";
// services
import { OrderDetailService } from "@/services/order-detail.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IOrderDetailStore {
  fetchedMap: Record<string, boolean>;
  orderDetailByIssueId: Record<string, TOrderDetail>;
  categoriesByProjectId: Record<string, string[]>;
  getOrderDetailByIssueId: (issueId: string) => TOrderDetail | null;
  getProjectOrderDetailCategories: (projectId: string) => string[] | undefined;
  fetchProjectOrderDetails: (workspaceSlug: string, projectId: string) => Promise<TOrderDetail[]>;
  fetchIssueOrderDetail: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TOrderDetail>;
  fetchProjectOrderDetailCategories: (workspaceSlug: string, projectId: string) => Promise<string[]>;
  updateIssueOrderDetail: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Partial<TOrderDetail>
  ) => Promise<TOrderDetail>;
}

export class OrderDetailStore implements IOrderDetailStore {
  rootStore;
  orderDetailByIssueId: Record<string, TOrderDetail> = {};
  categoriesByProjectId: Record<string, string[]> = {};
  fetchedMap: Record<string, boolean> = {};
  orderDetailService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      orderDetailByIssueId: observable,
      categoriesByProjectId: observable,
      fetchedMap: observable,
      fetchProjectOrderDetails: action,
      fetchIssueOrderDetail: action,
      fetchProjectOrderDetailCategories: action,
      updateIssueOrderDetail: action,
    });

    this.rootStore = _rootStore;
    this.orderDetailService = new OrderDetailService();
  }

  getOrderDetailByIssueId = computedFn(
    (issueId: string): TOrderDetail | null => this.orderDetailByIssueId?.[issueId] ?? null
  );

  getProjectOrderDetailCategories = computedFn(
    (projectId: string): string[] | undefined => this.categoriesByProjectId?.[projectId]
  );

  fetchProjectOrderDetails = async (workspaceSlug: string, projectId: string) =>
    await this.orderDetailService.getProjectOrderDetails(workspaceSlug, projectId).then((response) => {
      runInAction(() => {
        response.forEach((orderDetail) => set(this.orderDetailByIssueId, [orderDetail.issue], orderDetail));
        set(this.fetchedMap, projectId, true);
      });
      return response;
    });

  fetchIssueOrderDetail = async (workspaceSlug: string, projectId: string, issueId: string) =>
    await this.orderDetailService.getIssueOrderDetail(workspaceSlug, projectId, issueId).then((response) => {
      runInAction(() => set(this.orderDetailByIssueId, [issueId], response));
      return response;
    });

  fetchProjectOrderDetailCategories = async (workspaceSlug: string, projectId: string) =>
    await this.orderDetailService.getProjectOrderDetailCategories(workspaceSlug, projectId).then((response) => {
      runInAction(() => set(this.categoriesByProjectId, [projectId], response));
      return response;
    });

  updateIssueOrderDetail = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Partial<TOrderDetail>
  ) => {
    const original = this.orderDetailByIssueId[issueId];
    try {
      runInAction(() => set(this.orderDetailByIssueId, [issueId], { ...original, ...data }));
      const response = await this.orderDetailService.patchIssueOrderDetail(workspaceSlug, projectId, issueId, data);
      runInAction(() => set(this.orderDetailByIssueId, [issueId], response));
      return response;
    } catch (error) {
      runInAction(() => {
        if (original) set(this.orderDetailByIssueId, [issueId], original);
      });
      throw error;
    }
  };
}
