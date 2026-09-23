/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import { computedFn } from "mobx-utils";
// types
import type { TVendor, TVendorCapacity, TVendorCapacityUsage } from "@plane/types";
// services
import { VendorService } from "@/services/vendor.service";
// store
import type { CoreRootStore } from "./root.store";

export interface IVendorStore {
  fetchedMap: Record<string, boolean>;
  vendorMap: Record<string, TVendor>;
  vendorCapacitiesMap: Record<string, Record<string, TVendorCapacity>>;
  capacitiesFetchedMap: Record<string, boolean>;
  vendorCapacityUsageMap: Record<string, TVendorCapacityUsage[]>;
  usageFetchedMap: Record<string, boolean>;
  workspaceVendors: TVendor[] | undefined;
  getVendorById: (vendorId: string) => TVendor | null;
  getVendorCapacities: (vendorId: string) => TVendorCapacity[];
  getVendorCapacityUsage: (vendorId: string) => TVendorCapacityUsage[];
  fetchWorkspaceVendors: (workspaceSlug: string) => Promise<TVendor[]>;
  fetchVendorCapacities: (workspaceSlug: string, vendorId: string) => Promise<TVendorCapacity[]>;
  fetchVendorCapacityUsage: (workspaceSlug: string, vendorId: string) => Promise<TVendorCapacityUsage[]>;
  createVendor: (workspaceSlug: string, data: Partial<TVendor>) => Promise<TVendor>;
  updateVendor: (workspaceSlug: string, vendorId: string, data: Partial<TVendor>) => Promise<TVendor>;
  deleteVendor: (workspaceSlug: string, vendorId: string) => Promise<void>;
  upsertVendorCapacity: (
    workspaceSlug: string,
    vendorId: string,
    data: { year: number; month: number; capacity: number }
  ) => Promise<TVendorCapacity>;
  updateVendorCapacity: (
    workspaceSlug: string,
    vendorId: string,
    capacityId: string,
    data: Partial<TVendorCapacity>
  ) => Promise<TVendorCapacity>;
  deleteVendorCapacity: (workspaceSlug: string, vendorId: string, capacityId: string) => Promise<void>;
}

export class VendorStore implements IVendorStore {
  rootStore;
  vendorMap: Record<string, TVendor> = {};
  fetchedMap: Record<string, boolean> = {};
  vendorCapacitiesMap: Record<string, Record<string, TVendorCapacity>> = {};
  capacitiesFetchedMap: Record<string, boolean> = {};
  vendorCapacityUsageMap: Record<string, TVendorCapacityUsage[]> = {};
  usageFetchedMap: Record<string, boolean> = {};
  vendorService;

  constructor(_rootStore: CoreRootStore) {
    makeObservable(this, {
      vendorMap: observable,
      fetchedMap: observable,
      vendorCapacitiesMap: observable,
      capacitiesFetchedMap: observable,
      vendorCapacityUsageMap: observable,
      usageFetchedMap: observable,
      workspaceVendors: computed,
      fetchWorkspaceVendors: action,
      fetchVendorCapacities: action,
      fetchVendorCapacityUsage: action,
      createVendor: action,
      updateVendor: action,
      deleteVendor: action,
      upsertVendorCapacity: action,
      updateVendorCapacity: action,
      deleteVendorCapacity: action,
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

  getVendorCapacities = computedFn((vendorId: string): TVendorCapacity[] =>
    Object.values(this.vendorCapacitiesMap[vendorId] ?? {}).sort((a, b) => a.year - b.year || a.month - b.month)
  );

  fetchVendorCapacities = async (workspaceSlug: string, vendorId: string) =>
    await this.vendorService.getVendorCapacities(workspaceSlug, vendorId).then((response) => {
      runInAction(() => {
        response.forEach((capacity) => set(this.vendorCapacitiesMap, [vendorId, capacity.id], capacity));
        set(this.capacitiesFetchedMap, vendorId, true);
      });
      return response;
    });

  upsertVendorCapacity = async (
    workspaceSlug: string,
    vendorId: string,
    data: { year: number; month: number; capacity: number }
  ) =>
    await this.vendorService.upsertVendorCapacity(workspaceSlug, vendorId, data).then((response) => {
      runInAction(() => set(this.vendorCapacitiesMap, [vendorId, response.id], response));
      return response;
    });

  updateVendorCapacity = async (
    workspaceSlug: string,
    vendorId: string,
    capacityId: string,
    data: Partial<TVendorCapacity>
  ) => {
    const original = this.vendorCapacitiesMap[vendorId]?.[capacityId];
    try {
      runInAction(() => set(this.vendorCapacitiesMap, [vendorId, capacityId], { ...original, ...data }));
      return await this.vendorService.patchVendorCapacity(workspaceSlug, vendorId, capacityId, data);
    } catch (error) {
      runInAction(() => set(this.vendorCapacitiesMap, [vendorId, capacityId], original));
      throw error;
    }
  };

  deleteVendorCapacity = async (workspaceSlug: string, vendorId: string, capacityId: string) => {
    await this.vendorService.deleteVendorCapacity(workspaceSlug, vendorId, capacityId);
    runInAction(() => delete this.vendorCapacitiesMap[vendorId]?.[capacityId]);
  };

  getVendorCapacityUsage = computedFn(
    (vendorId: string): TVendorCapacityUsage[] => this.vendorCapacityUsageMap[vendorId] ?? []
  );

  fetchVendorCapacityUsage = async (workspaceSlug: string, vendorId: string) =>
    await this.vendorService.getVendorCapacityUsage(workspaceSlug, vendorId).then((response) => {
      runInAction(() => {
        set(this.vendorCapacityUsageMap, [vendorId], response);
        set(this.usageFetchedMap, vendorId, true);
      });
      return response;
    });
}
