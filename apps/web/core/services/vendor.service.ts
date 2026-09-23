/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TVendor, TVendorCapacity, TVendorCapacityUsage } from "@plane/types";
import { APIService } from "@/services/api.service";

export class VendorService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getVendors(workspaceSlug: string): Promise<TVendor[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/vendors/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createVendor(workspaceSlug: string, data: Partial<TVendor>): Promise<TVendor> {
    return this.post(`/api/workspaces/${workspaceSlug}/vendors/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchVendor(workspaceSlug: string, vendorId: string, data: Partial<TVendor>): Promise<TVendor> {
    return this.patch(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteVendor(workspaceSlug: string, vendorId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getVendorCapacities(workspaceSlug: string, vendorId: string): Promise<TVendorCapacity[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/capacities/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async upsertVendorCapacity(
    workspaceSlug: string,
    vendorId: string,
    data: { year: number; month: number; capacity: number }
  ): Promise<TVendorCapacity> {
    return this.post(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/capacities/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchVendorCapacity(
    workspaceSlug: string,
    vendorId: string,
    capacityId: string,
    data: Partial<TVendorCapacity>
  ): Promise<TVendorCapacity> {
    return this.patch(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/capacities/${capacityId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteVendorCapacity(workspaceSlug: string, vendorId: string, capacityId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/capacities/${capacityId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getVendorCapacityUsage(workspaceSlug: string, vendorId: string): Promise<TVendorCapacityUsage[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/vendors/${vendorId}/capacity-usage/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
