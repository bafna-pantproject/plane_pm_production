/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TStyle } from "@plane/types";
// services
import { StyleService } from "@/services/style.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IStyleStore {
  fetchedMap: Record<string, boolean>;
  styleMap: Record<string, TStyle>;
  workspaceStyles: TStyle[] | undefined;
  getStyleById: (styleId: string) => TStyle | null;
  fetchWorkspaceStyles: (workspaceSlug: string) => Promise<TStyle[]>;
  createStyle: (workspaceSlug: string, data: Partial<TStyle>) => Promise<TStyle>;
  updateStyle: (workspaceSlug: string, styleId: string, data: Partial<TStyle>) => Promise<TStyle>;
  deleteStyle: (workspaceSlug: string, styleId: string) => Promise<void>;
}

export class StyleStore implements IStyleStore {
  rootStore;
  styleMap: Record<string, TStyle> = {};
  fetchedMap: Record<string, boolean> = {};
  styleService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      styleMap: observable,
      fetchedMap: observable,
      workspaceStyles: computed,
      fetchWorkspaceStyles: action,
      createStyle: action,
      updateStyle: action,
      deleteStyle: action,
    });

    this.rootStore = _rootStore;
    this.styleService = new StyleService();
  }

  get workspaceStyles() {
    const workspaceSlug = this.rootStore.router.workspaceSlug;
    if (!workspaceSlug || !this.fetchedMap[workspaceSlug]) return undefined;
    return Object.values(this.styleMap);
  }

  getStyleById = computedFn((styleId: string): TStyle | null => this.styleMap?.[styleId] ?? null);

  fetchWorkspaceStyles = async (workspaceSlug: string) =>
    await this.styleService.getStyles(workspaceSlug).then((response) => {
      runInAction(() => {
        response.forEach((style) => set(this.styleMap, [style.id], style));
        set(this.fetchedMap, workspaceSlug, true);
      });
      return response;
    });

  createStyle = async (workspaceSlug: string, data: Partial<TStyle>) =>
    await this.styleService.createStyle(workspaceSlug, data).then((response) => {
      runInAction(() => set(this.styleMap, [response.id], response));
      return response;
    });

  updateStyle = async (workspaceSlug: string, styleId: string, data: Partial<TStyle>) => {
    const original = this.styleMap[styleId];
    try {
      runInAction(() => set(this.styleMap, [styleId], { ...original, ...data }));
      return await this.styleService.patchStyle(workspaceSlug, styleId, data);
    } catch (error) {
      runInAction(() => set(this.styleMap, [styleId], original));
      throw error;
    }
  };

  deleteStyle = async (workspaceSlug: string, styleId: string) => {
    await this.styleService.deleteStyle(workspaceSlug, styleId);
    runInAction(() => delete this.styleMap[styleId]);
  };
}
