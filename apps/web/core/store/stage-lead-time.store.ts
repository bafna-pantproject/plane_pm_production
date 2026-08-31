/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set, sortBy } from "lodash-es";
import { action, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TStageLeadTime } from "@plane/types";
// services
import { StageLeadTimeService } from "@/services/stage-lead-time.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IStageLeadTimeStore {
  fetchedMap: Record<string, boolean>;
  stageLeadTimeMap: Record<string, TStageLeadTime>;
  getProjectStageLeadTimes: (projectId: string) => TStageLeadTime[] | undefined;
  fetchProjectStageLeadTimes: (workspaceSlug: string, projectId: string) => Promise<TStageLeadTime[]>;
  updateStageLeadTime: (
    workspaceSlug: string,
    projectId: string,
    stageLeadTimeId: string,
    data: Partial<TStageLeadTime>
  ) => Promise<TStageLeadTime>;
}

export class StageLeadTimeStore implements IStageLeadTimeStore {
  rootStore;
  stageLeadTimeMap: Record<string, TStageLeadTime> = {};
  fetchedMap: Record<string, boolean> = {};
  stageLeadTimeService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      stageLeadTimeMap: observable,
      fetchedMap: observable,
      fetchProjectStageLeadTimes: action,
      updateStageLeadTime: action,
    });

    this.rootStore = _rootStore;
    this.stageLeadTimeService = new StageLeadTimeService();
  }

  getProjectStageLeadTimes = computedFn((projectId: string): TStageLeadTime[] | undefined => {
    if (!this.fetchedMap[projectId]) return undefined;
    return sortBy(
      Object.values(this.stageLeadTimeMap).filter((stageLeadTime) => stageLeadTime.project_id === projectId),
      (stageLeadTime) => this.rootStore.state.stateMap?.[stageLeadTime.state]?.sequence
    );
  });

  fetchProjectStageLeadTimes = async (workspaceSlug: string, projectId: string) =>
    await this.stageLeadTimeService.getStageLeadTimes(workspaceSlug, projectId).then((response) => {
      runInAction(() => {
        response.forEach((stageLeadTime) => set(this.stageLeadTimeMap, [stageLeadTime.id], stageLeadTime));
        set(this.fetchedMap, projectId, true);
      });
      return response;
    });

  updateStageLeadTime = async (
    workspaceSlug: string,
    projectId: string,
    stageLeadTimeId: string,
    data: Partial<TStageLeadTime>
  ) => {
    const original = this.stageLeadTimeMap[stageLeadTimeId];
    try {
      runInAction(() => set(this.stageLeadTimeMap, [stageLeadTimeId], { ...original, ...data }));
      return await this.stageLeadTimeService.patchStageLeadTime(workspaceSlug, projectId, stageLeadTimeId, data);
    } catch (error) {
      runInAction(() => set(this.stageLeadTimeMap, [stageLeadTimeId], original));
      throw error;
    }
  };
}
