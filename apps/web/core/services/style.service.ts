/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TStyle } from "@plane/types";
import { APIService } from "@/services/api.service";

export class StyleService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStyles(workspaceSlug: string): Promise<TStyle[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/styles/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createStyle(workspaceSlug: string, data: Partial<TStyle>): Promise<TStyle> {
    return this.post(`/api/workspaces/${workspaceSlug}/styles/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchStyle(workspaceSlug: string, styleId: string, data: Partial<TStyle>): Promise<TStyle> {
    return this.patch(`/api/workspaces/${workspaceSlug}/styles/${styleId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteStyle(workspaceSlug: string, styleId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/styles/${styleId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
