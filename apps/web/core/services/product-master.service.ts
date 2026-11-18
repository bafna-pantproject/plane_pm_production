/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TProductCategory, TProductFit } from "@plane/types";
import { APIService } from "@/services/api.service";

export class ProductMasterService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getCategories(workspaceSlug: string): Promise<TProductCategory[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/product-categories/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createCategory(workspaceSlug: string, data: Partial<TProductCategory>): Promise<TProductCategory> {
    return this.post(`/api/workspaces/${workspaceSlug}/product-categories/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchCategory(
    workspaceSlug: string,
    categoryId: string,
    data: Partial<TProductCategory>
  ): Promise<TProductCategory> {
    return this.patch(`/api/workspaces/${workspaceSlug}/product-categories/${categoryId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteCategory(workspaceSlug: string, categoryId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/product-categories/${categoryId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getFits(workspaceSlug: string): Promise<TProductFit[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/product-fits/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createFit(workspaceSlug: string, data: Partial<TProductFit>): Promise<TProductFit> {
    return this.post(`/api/workspaces/${workspaceSlug}/product-fits/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchFit(workspaceSlug: string, fitId: string, data: Partial<TProductFit>): Promise<TProductFit> {
    return this.patch(`/api/workspaces/${workspaceSlug}/product-fits/${fitId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteFit(workspaceSlug: string, fitId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/product-fits/${fitId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
