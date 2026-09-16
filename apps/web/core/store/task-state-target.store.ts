/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TTaskStateTarget } from "@plane/types";
// services
import { TaskStateTargetService } from "@/services/task-state-target.service";
// store
import type { CoreRootStore } from "./root.store";

export interface ITaskStateTargetStore {
  fetchedMap: Record<string, boolean>;
  stateTargetsByIssueId: Record<string, TTaskStateTarget[]>;
  getIssueStateTargets: (issueId: string) => TTaskStateTarget[] | undefined;
  getIssueStateTarget: (issueId: string, stateId: string) => TTaskStateTarget | undefined;
  fetchIssueStateTargets: (workspaceSlug: string, projectId: string, issueId: string) => Promise<TTaskStateTarget[]>;
  setIssueStateTarget: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateId: string,
    targetDate: string | null
  ) => Promise<void>;
}

export class TaskStateTargetStore implements ITaskStateTargetStore {
  rootStore;
  stateTargetsByIssueId: Record<string, TTaskStateTarget[]> = {};
  fetchedMap: Record<string, boolean> = {};
  taskStateTargetService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      stateTargetsByIssueId: observable,
      fetchedMap: observable,
      fetchIssueStateTargets: action,
      setIssueStateTarget: action,
    });

    this.rootStore = _rootStore;
    this.taskStateTargetService = new TaskStateTargetService();
  }

  getIssueStateTargets = computedFn(
    (issueId: string): TTaskStateTarget[] | undefined => this.stateTargetsByIssueId?.[issueId]
  );

  getIssueStateTarget = computedFn((issueId: string, stateId: string): TTaskStateTarget | undefined =>
    this.stateTargetsByIssueId?.[issueId]?.find((target) => target.state === stateId)
  );

  fetchIssueStateTargets = async (workspaceSlug: string, projectId: string, issueId: string) =>
    await this.taskStateTargetService.getIssueStateTargets(workspaceSlug, projectId, issueId).then((response) => {
      runInAction(() => {
        set(this.stateTargetsByIssueId, [issueId], response);
        set(this.fetchedMap, issueId, true);
      });
      return response;
    });

  setIssueStateTarget = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateId: string,
    targetDate: string | null
  ) => {
    const existing = this.getIssueStateTarget(issueId, stateId);

    if (existing) {
      const response = await this.taskStateTargetService.patchStateTarget(workspaceSlug, projectId, issueId, existing.id, {
        target_date: targetDate,
      });
      runInAction(() => {
        const current = this.stateTargetsByIssueId[issueId] ?? [];
        if (!response) {
          // sparse cleanup: the backend deleted the now-empty row.
          set(this.stateTargetsByIssueId, [issueId], current.filter((target) => target.id !== existing.id));
        } else {
          set(
            this.stateTargetsByIssueId,
            [issueId],
            current.map((target) => (target.id === existing.id ? response : target))
          );
        }
      });
      return;
    }

    if (targetDate === null) return;

    const response = await this.taskStateTargetService.setStateTarget(workspaceSlug, projectId, issueId, {
      state: stateId,
      target_date: targetDate,
    });
    runInAction(() => {
      const current = this.stateTargetsByIssueId[issueId] ?? [];
      set(this.stateTargetsByIssueId, [issueId], [...current, response]);
    });
  };
}
