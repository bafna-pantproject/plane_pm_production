/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { action, makeObservable, observable, runInAction } from "mobx";
// plane imports
import { getTnaRequiredFieldStateId } from "@plane/constants";
// types
import type { TIssue, TOrderDetail, TStateRequiredField } from "@plane/types";
// store
import type { CoreRootStore } from "./root.store";

/** outcome of asking whether a work item may enter a state */
export type TStateTransitionGateResult =
  | { proceed: false }
  // issueData is merged into the state-change PATCH (the due date and the derived name live on the issue itself)
  | { proceed: true; issueData: Partial<TIssue> };

export type TPendingStateTransition = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  stateId: string;
  missingFields: TStateRequiredField[];
  resolve: (result: TStateTransitionGateResult) => void;
};

export interface IStateTransitionGateStore {
  pending: TPendingStateTransition | null;
  ensureRequiredFields: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateId: string,
    pendingIssueData?: Partial<TIssue>
  ) => Promise<TStateTransitionGateResult>;
  settle: (result: TStateTransitionGateResult) => void;
}

const isBlank = (value: unknown) => value === null || value === undefined || String(value).trim() === "";

export class StateTransitionGateStore implements IStateTransitionGateStore {
  rootStore;
  pending: TPendingStateTransition | null = null;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      pending: observable.ref,
      ensureRequiredFields: action,
      settle: action,
    });
    this.rootStore = _rootStore;
  }

  /**
   * Resolves `proceed: true` straight away when the destination state requires nothing the work item
   * is missing; otherwise opens the "fill in required fields" popup and resolves once it is saved
   * (proceed: true) or cancelled (proceed: false).
   */
  ensureRequiredFields = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateId: string,
    pendingIssueData: Partial<TIssue> = {}
  ): Promise<TStateTransitionGateResult> => {
    const requiredFields = this.rootStore.state.getStateById(stateId)?.required_fields ?? [];
    if (requiredFields.length === 0) return { proceed: true, issueData: {} };

    // the cached copies may be missing or stale (boards only get a denormalized subset), so ask the server
    const needsTnaTargets = requiredFields.some((field) => getTnaRequiredFieldStateId(field) !== null);
    const [orderDetail, stateTargets] = await Promise.all([
      this.rootStore.orderDetail.fetchIssueOrderDetail(workspaceSlug, projectId, issueId),
      needsTnaTargets
        ? this.rootStore.taskStateTarget.fetchIssueStateTargets(workspaceSlug, projectId, issueId)
        : Promise.resolve([]),
    ]);
    const issue = { ...this.rootStore.issue.issues.getIssueById(issueId), ...pendingIssueData };

    const missingFields = requiredFields.filter((field) => {
      const tnaStateId = getTnaRequiredFieldStateId(field);
      if (tnaStateId) {
        // a TNA date required for a state that has since been deleted can't be filled in, so it isn't enforced
        if (!this.rootStore.state.getStateById(tnaStateId)) return false;
        return isBlank(stateTargets.find((target) => target.state === tnaStateId)?.target_date);
      }
      if (field === "target_date") return isBlank(issue.target_date);
      return isBlank(orderDetail[field as keyof TOrderDetail]);
    });
    if (missingFields.length === 0) return { proceed: true, issueData: {} };

    return new Promise<TStateTransitionGateResult>((resolve) => {
      runInAction(() => {
        // only one popup at a time; a newer move supersedes an unanswered one
        this.pending?.resolve({ proceed: false });
        this.pending = { workspaceSlug, projectId, issueId, stateId, missingFields, resolve };
      });
    });
  };

  settle = (result: TStateTransitionGateResult) => {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(result);
  };
}
