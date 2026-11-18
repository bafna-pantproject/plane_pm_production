/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// components
import { CatalogSelect } from "@/components/issues/issue-detail/catalog-select";
// hooks
import { useProductMaster } from "@/hooks/store/use-product-master";

// stands in for a value already on the work item that isn't (or is no longer) in the product master
const CURRENT_VALUE_ID = "__current__";

export type TFitCategoryValue = { fit: string; category: string };

type Props = {
  workspaceSlug: string;
  fit: string;
  category: string;
  onChange: (value: TFitCategoryValue) => void;
  disabled?: boolean;
  // the category is fixed once a work item exists; the fit stays editable within it
  isCategoryDisabled?: boolean;
  className?: string;
  selectClassName?: string;
  /** wraps each select, e.g. in its own labelled sidebar row; when given, no outer row is rendered */
  renderField?: (field: "fit" | "category", select: ReactNode) => ReactNode;
};

/**
 * Fit then Category, both picked from the product master. Fits belong to a category: with a category
 * chosen only its fits are offered, and with none chosen every fit is offered and picking one fills
 * in its category too.
 */
export const FitCategorySelect = observer(function FitCategorySelect(props: Props) {
  const {
    workspaceSlug,
    fit,
    category,
    onChange,
    disabled = false,
    isCategoryDisabled = false,
    className,
    selectClassName,
    renderField,
  } = props;
  const { t } = useTranslation();
  const {
    workspaceCategories,
    getCategoryByName,
    getCategoryById,
    getCategoryFits,
    fitMap,
    createCategory,
    createFit,
  } = useProductMaster();

  const selectedCategory = getCategoryByName(category);
  const fitsInScope = selectedCategory
    ? getCategoryFits(selectedCategory.id)
    : category
      ? []
      : // oxlint-disable-next-line unicorn/no-array-sort
        Object.values(fitMap).sort((a, b) => a.name.localeCompare(b.name));
  const selectedFit = fitsInScope.find((option) => option.name.toLowerCase() === fit.trim().toLowerCase());

  const categoryOptions = (workspaceCategories ?? []).map((option) => ({ id: option.name, label: option.name }));
  if (category && !selectedCategory) categoryOptions.unshift({ id: category, label: category });

  const fitOptions = fitsInScope.map((option) => ({
    id: option.id,
    label: selectedCategory ? option.name : `${option.name} (${getCategoryById(option.category)?.name ?? ""})`,
  }));
  if (fit && !selectedFit) fitOptions.unshift({ id: CURRENT_VALUE_ID, label: fit });

  const handleFitChange = (fitId: string | null) => {
    if (fitId === CURRENT_VALUE_ID) return;
    const picked = fitId ? fitMap[fitId] : undefined;
    if (!picked) return onChange({ fit: "", category });
    onChange({ fit: picked.name, category: category || (getCategoryById(picked.category)?.name ?? "") });
  };

  const handleCategoryChange = (categoryName: string | null) => {
    const nextCategory = categoryName ?? "";
    const nextCategoryRow = getCategoryByName(nextCategory);
    // a fit only makes sense inside its own category
    const keepsFit =
      !!fit &&
      !!nextCategoryRow &&
      getCategoryFits(nextCategoryRow.id).some((option) => option.name.toLowerCase() === fit.trim().toLowerCase());
    onChange({ fit: keepsFit ? fit : "", category: nextCategory });
  };

  const fitSelect = (
    <CatalogSelect
      className={selectClassName}
      value={selectedFit?.id ?? (fit ? CURRENT_VALUE_ID : null)}
      onChange={handleFitChange}
      options={fitOptions}
      placeholder={t("common.fit")}
      disabled={disabled}
      onCreate={
        selectedCategory && !disabled
          ? async (name) => {
              const created = await createFit(workspaceSlug, { category: selectedCategory.id, name });
              return { id: created.id };
            }
          : undefined
      }
    />
  );
  const categorySelect = (
    <CatalogSelect
      className={selectClassName}
      value={category || null}
      onChange={handleCategoryChange}
      options={categoryOptions}
      placeholder={t("common.category")}
      disabled={disabled || isCategoryDisabled}
      onCreate={
        !disabled && !isCategoryDisabled
          ? async (name) => {
              const created = await createCategory(workspaceSlug, { name });
              return { id: created.name };
            }
          : undefined
      }
    />
  );

  if (renderField)
    return (
      <>
        {renderField("fit", fitSelect)}
        {renderField("category", categorySelect)}
      </>
    );

  return (
    <div className={cn("flex gap-2", className)}>
      {fitSelect}
      {categorySelect}
    </div>
  );
});
