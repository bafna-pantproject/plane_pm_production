/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TVendor } from "@plane/types";
// services
import { VendorService } from "@/services/vendor.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IVendorStore {
  fetchedMap: Record<string, boolean>;
  vendorMap: Record<string, TVendor>;
  workspaceVendors: TVendor[] | undefined;
  getVendorById: (vendorId: string) => TVendor | null;
  fetchWorkspaceVendors: (workspaceSlug: string) => Promise<TVendor[]>;
  createVendor: (workspaceSlug: string, data: Partial<TVendor>) => Promise<TVendor>;
  updateVendor: (workspaceSlug: string, vendorId: string, data: Partial<TVendor>) => Promise<TVendor>;
  deleteVendor: (workspaceSlug: string, vendorId: string) => Promise<void>;
}

export class VendorStore implements IVendorStore {
  rootStore;
  vendorMap: Record<string, TVendor> = {};
  fetchedMap: Record<string, boolean> = {};
  vendorService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      vendorMap: observable,
      fetchedMap: observable,
      workspaceVendors: computed,
      fetchWorkspaceVendors: action,
      createVendor: action,
      updateVendor: action,
      deleteVendor: action,
    });

    this.rootStore = _rootStore;
    this.vendorService = new VendorService();
  }

  get workspaceVendors() {
    const workspaceSlug = this.rootStore.router.workspaceSlug;
    if (!workspaceSlug || !this.fetchedMap[workspaceSlug]) return undefined;
    return Object.values(this.vendorMap);
  }

  getVendorById = computedFn((vendorId: string): TVendor | null => this.vendorMap?.[vendorId] ?? null);

  fetchWorkspaceVendors = async (workspaceSlug: string) =>
    await this.vendorService.getVendors(workspaceSlug).then((response) => {
      runInAction(() => {
        response.forEach((vendor) => set(this.vendorMap, [vendor.id], vendor));
        set(this.fetchedMap, workspaceSlug, true);
      });
      return response;
    });

  createVendor = async (workspaceSlug: string, data: Partial<TVendor>) =>
    await this.vendorService.createVendor(workspaceSlug, data).then((response) => {
      runInAction(() => set(this.vendorMap, [response.id], response));
      return response;
    });

  updateVendor = async (workspaceSlug: string, vendorId: string, data: Partial<TVendor>) => {
    const original = this.vendorMap[vendorId];
    try {
      runInAction(() => set(this.vendorMap, [vendorId], { ...original, ...data }));
      return await this.vendorService.patchVendor(workspaceSlug, vendorId, data);
    } catch (error) {
      runInAction(() => set(this.vendorMap, [vendorId], original));
      throw error;
    }
  };

  deleteVendor = async (workspaceSlug: string, vendorId: string) => {
    await this.vendorService.deleteVendor(workspaceSlug, vendorId);
    runInAction(() => delete this.vendorMap[vendorId]);
  };
}
