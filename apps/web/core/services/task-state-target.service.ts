/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TTaskStateTarget } from "@plane/types";
import { APIService } from "@/services/api.service";

export class TaskStateTargetService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getIssueStateTargets(workspaceSlug: string, projectId: string, issueId: string): Promise<TTaskStateTarget[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/state-targets/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async setStateTarget(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: { state: string; target_date: string | null }
  ): Promise<TTaskStateTarget> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/state-targets/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchStateTarget(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateTargetId: string,
    data: Partial<TTaskStateTarget>
  ): Promise<TTaskStateTarget> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/state-targets/${stateTargetId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteStateTarget(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    stateTargetId: string
  ): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/state-targets/${stateTargetId}/`
    ).catch((error) => {
      throw error?.response?.data;
    });
  }
}
