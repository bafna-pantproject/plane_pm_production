/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// plane imports
import { ETabIndices } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
// ui
import { Input } from "@plane/ui";
// helpers
import { getTabIndex } from "@plane/utils";
// components
import { CatalogSelect } from "@/components/issues/issue-detail/catalog-select";
// hooks
import { useVendor } from "@/hooks/store/use-vendor";
import { usePlatformOS } from "@/hooks/use-platform-os";

type TIssueCategoryQuantityInputProps = {
  category: string;
  quantity: number | null;
  onCategoryChange: (value: string) => void;
  onQuantityChange: (value: number | null) => void;
  handleFormChange: () => void;
  categoryInputRef: React.MutableRefObject<HTMLInputElement | null>;
  categoryError?: string;
  quantityError?: string;
  workspaceSlug: string;
  selectedVendorId?: string | null;
  onVendorChange?: (vendorId: string | null) => void;
};

export const IssueCategoryQuantityInput = observer(function IssueCategoryQuantityInput(
  props: TIssueCategoryQuantityInputProps
) {
  const {
    category,
    quantity,
    onCategoryChange,
    onQuantityChange,
    handleFormChange,
    categoryInputRef,
    categoryError,
    quantityError,
    workspaceSlug,
    selectedVendorId = null,
    onVendorChange,
  } = props;
  // store hooks
  const { isMobile } = usePlatformOS();
  const { t } = useTranslation();
  const { workspaceVendors, createVendor } = useVendor();

  const { getIndex } = getTabIndex(ETabIndices.ISSUE_FORM, isMobile);

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Input
          id="category"
          name="category"
          type="text"
          value={category}
          onChange={(e) => {
            onCategoryChange(e.target.value);
            handleFormChange();
          }}
          ref={categoryInputRef}
          hasError={Boolean(categoryError)}
          placeholder={t("common.category")}
          className="w-full text-body-sm-regular"
          autoFocus
          tabIndex={getIndex("category")}
        />
        <span className="text-caption-sm-medium text-danger-primary">{categoryError}</span>
      </div>
      {onVendorChange && (
        <div className="w-48 self-start pt-0.5">
          <CatalogSelect
            value={selectedVendorId}
            onChange={(vendorId) => {
              onVendorChange(vendorId);
              handleFormChange();
            }}
            options={(workspaceVendors ?? []).map((vendor) => ({ id: vendor.id, label: vendor.name }))}
            placeholder={t("common.vendor")}
            onCreate={(name) => createVendor(workspaceSlug, { name })}
            className="w-full border border-strong rounded-sm"
          />
        </div>
      )}
      <div className="w-32">
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          value={quantity ?? ""}
          onChange={(e) => {
            const rawValue = e.target.value;
            onQuantityChange(rawValue === "" ? null : Number.parseInt(rawValue, 10));
            handleFormChange();
          }}
          hasError={Boolean(quantityError)}
          placeholder={t("common.quantity")}
          className="w-full text-body-sm-regular"
          tabIndex={getIndex("quantity")}
        />
        <span className="text-caption-sm-medium text-danger-primary">{quantityError}</span>
      </div>
    </div>
  );
});
