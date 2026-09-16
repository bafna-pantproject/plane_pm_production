/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TOrderDetail } from "@plane/types";
import { APIService } from "@/services/api.service";

export class OrderDetailService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getProjectOrderDetails(workspaceSlug: string, projectId: string): Promise<TOrderDetail[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/order-details/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getIssueOrderDetail(workspaceSlug: string, projectId: string, issueId: string): Promise<TOrderDetail> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/order-detail/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchIssueOrderDetail(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Partial<TOrderDetail>
  ): Promise<TOrderDetail> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/order-detail/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getProjectOrderDetailCategories(workspaceSlug: string, projectId: string): Promise<string[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/order-detail-categories/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
