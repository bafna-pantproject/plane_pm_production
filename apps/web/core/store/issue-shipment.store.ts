/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TIssueShipment, TIssueShipmentList } from "@plane/types";
// services
import { IssueShipmentService } from "@/services/issue-shipment.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IIssueShipmentStore {
  shipmentsByIssueId: Record<string, TIssueShipmentList>;
  getIssueShipments: (issueId: string) => TIssueShipmentList | undefined;
  fetchIssueShipments: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TIssueShipmentList>;
  createShipment: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Pick<TIssueShipment, "shipped_date" | "quantity" | "note">
  ) => Promise<void>;
  deleteShipment: (
    workspaceSlug: string,
    projectId: string,
    viewedIssueId: string,
    shipment: TIssueShipment
  ) => Promise<void>;
}

export class IssueShipmentStore implements IIssueShipmentStore {
  rootStore;
  shipmentsByIssueId: Record<string, TIssueShipmentList> = {};
  issueShipmentService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      shipmentsByIssueId: observable,
      fetchIssueShipments: action,
      createShipment: action,
      deleteShipment: action,
    });

    this.rootStore = _rootStore;
    this.issueShipmentService = new IssueShipmentService();
  }

  getIssueShipments = computedFn(
    (issueId: string): TIssueShipmentList | undefined => this.shipmentsByIssueId?.[issueId]
  );

  fetchIssueShipments = async (workspaceSlug: string, projectId: string, issueId: string) =>
    await this.issueShipmentService.getIssueShipments(workspaceSlug, projectId, issueId).then((response) => {
      runInAction(() => {
        set(this.shipmentsByIssueId, [issueId], response);
      });
      return response;
    });

  /** a parent's list rolls up its sub work items' shipments, so drop its cached copy to refetch on next view. */
  private invalidateParent = (issueId: string) => {
    const parentId = this.rootStore.issue.issues.getIssueById(issueId)?.parent_id;
    if (parentId) runInAction(() => delete this.shipmentsByIssueId[parentId]);
  };

  createShipment = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Pick<TIssueShipment, "shipped_date" | "quantity" | "note">
  ) => {
    await this.issueShipmentService.createShipment(workspaceSlug, projectId, issueId, data);
    this.invalidateParent(issueId);
    await this.fetchIssueShipments(workspaceSlug, projectId, issueId);
  };

  deleteShipment = async (
    workspaceSlug: string,
    projectId: string,
    viewedIssueId: string,
    shipment: TIssueShipment
  ) => {
    // the row may belong to a sub work item rolled up onto the viewed parent, so delete it via its own issue.
    await this.issueShipmentService.deleteShipment(workspaceSlug, projectId, shipment.issue, shipment.id);
    runInAction(() => {
      if (shipment.issue !== viewedIssueId) delete this.shipmentsByIssueId[shipment.issue];
    });
    this.invalidateParent(shipment.issue);
    await this.fetchIssueShipments(workspaceSlug, projectId, viewedIssueId);
  };
}
