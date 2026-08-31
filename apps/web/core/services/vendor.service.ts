/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TVendor } from "@plane/types";
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
}
