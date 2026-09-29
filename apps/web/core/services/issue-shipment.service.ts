/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssueShipment, TIssueShipmentList } from "@plane/types";
import { APIService } from "@/services/api.service";

export class IssueShipmentService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getIssueShipments(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueShipmentList> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/shipments/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createShipment(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: Pick<TIssueShipment, "shipped_date" | "quantity" | "note">
  ): Promise<TIssueShipment> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/shipments/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteShipment(workspaceSlug: string, projectId: string, issueId: string, shipmentId: string): Promise<void> {
    return this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/shipments/${shipmentId}/`
    )
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
