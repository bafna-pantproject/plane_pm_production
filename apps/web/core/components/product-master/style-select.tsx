/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { formatStyleLabel } from "@plane/utils";
// components
import { CatalogSelect } from "@/components/issues/issue-detail/catalog-select";
// hooks
import { useProductMaster } from "@/hooks/store/use-product-master";
import { useStyle } from "@/hooks/store/use-style";

type Props = {
  workspaceSlug: string;
  /** the work item's fit and category (text); scope the styles offered to that fit */
  fit: string;
  category: string;
  value: string | null | undefined;
  onChange: (styleId: string | null) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Style picker for sub work items. Offers the styles under the work item's fit in the product master;
 * if that fit isn't in the product master, every style is offered. New styles are created under the fit.
 */
export const StyleSelect = observer(function StyleSelect(props: Props) {
  const { workspaceSlug, fit, category, value, onChange, disabled = false, className } = props;
  const { t } = useTranslation();
  const { getFitByName } = useProductMaster();
  const { workspaceStyles, getFitStyles, getStyleById, createStyle } = useStyle();

  const fitRow = getFitByName(category, fit);
  const styles = fitRow ? getFitStyles(fitRow.id) : (workspaceStyles ?? []);
  const options = styles.map((style) => ({ id: style.id, label: formatStyleLabel(style) }));
  // keep a style chosen before it moved to another fit visible
  const current = value ? getStyleById(value) : null;
  if (current && !options.some((option) => option.id === current.id))
    options.unshift({ id: current.id, label: formatStyleLabel(current) });

  return (
    <CatalogSelect
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t("common.style")}
      disabled={disabled}
      onCreate={
        disabled ? undefined : (code) => createStyle(workspaceSlug, { code, name: code, fit: fitRow?.id ?? null })
      }
    />
  );
});
