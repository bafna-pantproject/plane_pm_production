/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// i18n
import { useTranslation } from "@plane/i18n";
// types
import type { TIssue } from "@plane/types";
// components
import { CatalogSelect } from "@/components/issues/issue-detail/catalog-select";
// hooks
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useVendor } from "@/hooks/store/use-vendor";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetVendorColumn = observer(function SpreadsheetVendorColumn(props: Props) {
  const { issue, disabled } = props;
  // i18n
  const { t } = useTranslation();
  // params
  const { workspaceSlug } = useParams();
  // store hooks
  const { workspaceVendors } = useVendor();
  const { updateIssueOrderDetail } = useOrderDetail();

  const handleVendor = async (vendorId: string | null) => {
    if (!workspaceSlug || !issue.project_id) return;
    await updateIssueOrderDetail(workspaceSlug.toString(), issue.project_id, issue.id, { vendor: vendorId });
  };

  return (
    <div className="h-11 border-b-[0.5px] border-subtle px-page-x py-2.5">
      <CatalogSelect
        value={issue.vendor_id}
        onChange={handleVendor}
        options={(workspaceVendors ?? []).map((vendor) => ({ id: vendor.id, label: vendor.name }))}
        placeholder={t("common.vendor")}
        disabled={disabled}
      />
    </div>
  );
});
