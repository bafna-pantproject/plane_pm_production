/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TProductCategory, TProductFit } from "@plane/types";
// services
import { ProductMasterService } from "@/services/product-master.service";
// store
import type { CoreRootStore } from "./root.store";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export interface IProductMasterStore {
  categoryMap: Record<string, TProductCategory>;
  fitMap: Record<string, TProductFit>;
  fetchedMap: Record<string, boolean>;
  workspaceCategories: TProductCategory[] | undefined;
  getCategoryById: (categoryId: string) => TProductCategory | null;
  getCategoryByName: (name: string | null | undefined) => TProductCategory | null;
  getCategoryFits: (categoryId: string | null | undefined) => TProductFit[];
  fetchProductMaster: (workspaceSlug: string) => Promise<void>;
  createCategory: (workspaceSlug: string, data: Partial<TProductCategory>) => Promise<TProductCategory>;
  updateCategory: (workspaceSlug: string, categoryId: string, data: Partial<TProductCategory>) => Promise<void>;
  deleteCategory: (workspaceSlug: string, categoryId: string) => Promise<void>;
  createFit: (workspaceSlug: string, data: Partial<TProductFit>) => Promise<TProductFit>;
  updateFit: (workspaceSlug: string, fitId: string, data: Partial<TProductFit>) => Promise<void>;
  deleteFit: (workspaceSlug: string, fitId: string) => Promise<void>;
}

export class ProductMasterStore implements IProductMasterStore {
  rootStore;
  categoryMap: Record<string, TProductCategory> = {};
  fitMap: Record<string, TProductFit> = {};
  fetchedMap: Record<string, boolean> = {};
  productMasterService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      categoryMap: observable,
      fitMap: observable,
      fetchedMap: observable,
      workspaceCategories: computed,
      fetchProductMaster: action,
      createCategory: action,
      updateCategory: action,
      deleteCategory: action,
      createFit: action,
      updateFit: action,
      deleteFit: action,
    });
    this.rootStore = _rootStore;
    this.productMasterService = new ProductMasterService();
  }

  get workspaceCategories() {
    const workspaceSlug = this.rootStore.router.workspaceSlug;
    if (!workspaceSlug || !this.fetchedMap[workspaceSlug]) return undefined;
    // oxlint-disable-next-line unicorn/no-array-sort
    return Object.values(this.categoryMap).sort(byName);
  }

  getCategoryById = computedFn((categoryId: string): TProductCategory | null => this.categoryMap?.[categoryId] ?? null);

  // work items store the category as text, so the form maps it back to its product master row by name
  getCategoryByName = computedFn((name: string | null | undefined): TProductCategory | null => {
    const target = name?.trim().toLowerCase();
    if (!target) return null;
    return Object.values(this.categoryMap).find((category) => category.name.toLowerCase() === target) ?? null;
  });

  getCategoryFits = computedFn((categoryId: string | null | undefined): TProductFit[] =>
    categoryId
      ? Object.values(this.fitMap)
          .filter((fit) => fit.category === categoryId)
          // oxlint-disable-next-line unicorn/no-array-sort
          .sort(byName)
      : []
  );

  fetchProductMaster = async (workspaceSlug: string) => {
    const [categories, fits] = await Promise.all([
      this.productMasterService.getCategories(workspaceSlug),
      this.productMasterService.getFits(workspaceSlug),
    ]);
    runInAction(() => {
      this.categoryMap = Object.fromEntries(categories.map((category) => [category.id, category]));
      this.fitMap = Object.fromEntries(fits.map((fit) => [fit.id, fit]));
      set(this.fetchedMap, workspaceSlug, true);
    });
  };

  createCategory = async (workspaceSlug: string, data: Partial<TProductCategory>) => {
    const response = await this.productMasterService.createCategory(workspaceSlug, data);
    runInAction(() => set(this.categoryMap, [response.id], response));
    return response;
  };

  updateCategory = async (workspaceSlug: string, categoryId: string, data: Partial<TProductCategory>) => {
    const response = await this.productMasterService.patchCategory(workspaceSlug, categoryId, data);
    runInAction(() => set(this.categoryMap, [categoryId], response));
  };

  deleteCategory = async (workspaceSlug: string, categoryId: string) => {
    await this.productMasterService.deleteCategory(workspaceSlug, categoryId);
    runInAction(() => {
      delete this.categoryMap[categoryId];
      Object.values(this.fitMap)
        .filter((fit) => fit.category === categoryId)
        .forEach((fit) => delete this.fitMap[fit.id]);
    });
  };

  createFit = async (workspaceSlug: string, data: Partial<TProductFit>) => {
    const response = await this.productMasterService.createFit(workspaceSlug, data);
    runInAction(() => set(this.fitMap, [response.id], response));
    return response;
  };

  updateFit = async (workspaceSlug: string, fitId: string, data: Partial<TProductFit>) => {
    const response = await this.productMasterService.patchFit(workspaceSlug, fitId, data);
    runInAction(() => set(this.fitMap, [fitId], response));
  };

  deleteFit = async (workspaceSlug: string, fitId: string) => {
    await this.productMasterService.deleteFit(workspaceSlug, fitId);
    runInAction(() => delete this.fitMap[fitId]);
  };
}
