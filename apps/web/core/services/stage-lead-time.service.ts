/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TStageLeadTime } from "@plane/types";
import { APIService } from "@/services/api.service";

export class StageLeadTimeService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getStageLeadTimes(workspaceSlug: string, projectId: string): Promise<TStageLeadTime[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/stage-lead-times/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async patchStageLeadTime(
    workspaceSlug: string,
    projectId: string,
    stageLeadTimeId: string,
    data: Partial<TStageLeadTime>
  ): Promise<TStageLeadTime> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/stage-lead-times/${stageLeadTimeId}/`,
      data
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
