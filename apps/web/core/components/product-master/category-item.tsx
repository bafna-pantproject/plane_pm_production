/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import type { TProductCategory, TProductFit } from "@plane/types";
import { Input } from "@plane/ui";
import { cn, formatStyleLabel } from "@plane/utils";
// hooks
import { useProductMaster } from "@/hooks/store/use-product-master";
import { useStyle } from "@/hooks/store/use-style";

const iconButtonClassName =
  "grid place-items-center rounded-sm p-1.5 text-tertiary hover:bg-layer-1 hover:text-primary";

type TEditableNameProps = {
  name: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
};

/** inline rename: Enter or the tick saves, Escape or the cross cancels */
function EditableName(props: TEditableNameProps) {
  const { name, onSave, onCancel } = props;
  const [value, setValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) return onCancel();
    setIsSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") onCancel();
        }}
        className="h-7 w-56 text-body-xs-regular"
        disabled={isSaving}
      />
      <button type="button" className={iconButtonClassName} onClick={() => void save()} disabled={isSaving}>
        <Check className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={iconButtonClassName} onClick={onCancel} disabled={isSaving}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type TFitRowProps = {
  workspaceSlug: string;
  fit: TProductFit;
  isEditable: boolean;
  onError: (error: unknown) => void;
  onDelete: (fit: TProductFit) => void;
};

/** one fit inside a category, with the styles that sit under it */
const FitRow = observer(function FitRow(props: TFitRowProps) {
  const { workspaceSlug, fit, isEditable, onError, onDelete } = props;
  const { t } = useTranslation();
  const { updateFit } = useProductMaster();
  const { getFitStyles, getStyleByCode, createStyle, updateStyle } = useStyle();
  // states
  const [isRenaming, setIsRenaming] = useState(false);
  const [newStyleCode, setNewStyleCode] = useState("");
  const [isAddingStyle, setIsAddingStyle] = useState(false);
  // derived values
  const styles = getFitStyles(fit.id);

  const handleAddStyle = async () => {
    const code = newStyleCode.trim();
    if (!code || isAddingStyle) return;
    setIsAddingStyle(true);
    try {
      // a style id is unique across the workspace, so an existing one is moved under this fit instead
      const existing = getStyleByCode(code);
      if (existing) await updateStyle(workspaceSlug, existing.id, { fit: fit.id });
      else await createStyle(workspaceSlug, { code, name: code, fit: fit.id });
      setNewStyleCode("");
    } catch (error) {
      onError(error);
    } finally {
      setIsAddingStyle(false);
    }
  };

  const handleRemoveStyle = async (styleId: string) => {
    try {
      await updateStyle(workspaceSlug, styleId, { fit: null });
    } catch (error) {
      onError(error);
    }
  };

  return (
    <div className="space-y-2 rounded-sm border-[0.5px] border-subtle px-3 py-2">
      <div className="group/fit flex items-center justify-between gap-2">
        {isRenaming ? (
          <EditableName
            name={fit.name}
            onCancel={() => setIsRenaming(false)}
            onSave={async (name) => {
              try {
                await updateFit(workspaceSlug, fit.id, { name });
                setIsRenaming(false);
              } catch (error) {
                onError(error);
              }
            }}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body-xs-medium text-primary">{fit.name}</span>
            <span className="flex-shrink-0 rounded-sm bg-layer-1 px-1.5 py-0.5 text-11 text-tertiary">
              {t("workspace_settings.settings.product_master.styles_count", { count: styles.length })}
            </span>
          </div>
        )}
        {isEditable && !isRenaming && (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/fit:opacity-100">
            <Tooltip tooltipContent={t("common.edit")}>
              <button type="button" className={iconButtonClassName} onClick={() => setIsRenaming(true)}>
                <Pencil className="h-3 w-3" />
              </button>
            </Tooltip>
            <Tooltip tooltipContent={t("common.delete")}>
              <button
                type="button"
                className={cn(iconButtonClassName, "hover:text-danger-primary")}
                onClick={() => onDelete(fit)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {styles.length > 0 ? (
          styles.map((style) => (
            <span
              key={style.id}
              className="group/style inline-flex items-center gap-1 rounded-full border border-subtle bg-layer-1 py-0.5 pr-1 pl-2.5 text-12 text-secondary"
            >
              {formatStyleLabel(style)}
              {isEditable && (
                <Tooltip tooltipContent={t("workspace_settings.settings.product_master.remove_style")}>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 opacity-0 transition-opacity group-hover/style:opacity-100 hover:text-danger-primary"
                    onClick={() => void handleRemoveStyle(style.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Tooltip>
              )}
            </span>
          ))
        ) : (
          <span className="text-body-xs-regular text-placeholder">
            {t("workspace_settings.settings.product_master.no_styles")}
          </span>
        )}
      </div>

      {isEditable && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAddStyle();
          }}
        >
          <Input
            value={newStyleCode}
            onChange={(event) => setNewStyleCode(event.target.value)}
            placeholder={t("workspace_settings.settings.product_master.style_placeholder")}
            className="h-7 w-56 text-body-xs-regular"
            disabled={isAddingStyle}
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption-sm-medium text-accent-primary hover:bg-layer-1 disabled:cursor-not-allowed disabled:text-placeholder"
            disabled={!newStyleCode.trim() || isAddingStyle}
          >
            <Plus className="h-3 w-3" />
            {t("workspace_settings.settings.product_master.add_style")}
          </button>
        </form>
      )}
    </div>
  );
});

type Props = {
  workspaceSlug: string;
  category: TProductCategory;
  isEditable: boolean;
  onError: (error: unknown) => void;
  onDeleteCategory: (category: TProductCategory) => void;
  onDeleteFit: (fit: TProductFit) => void;
};

export const ProductCategoryItem = observer(function ProductCategoryItem(props: Props) {
  const { workspaceSlug, category, isEditable, onError, onDeleteCategory, onDeleteFit } = props;
  const { t } = useTranslation();
  const { getCategoryFits, updateCategory, createFit } = useProductMaster();
  // states
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFitName, setNewFitName] = useState("");
  const [isAddingFit, setIsAddingFit] = useState(false);
  // derived values
  const fits = getCategoryFits(category.id);

  const handleAddFit = async () => {
    const name = newFitName.trim();
    if (!name || isAddingFit) return;
    setIsAddingFit(true);
    try {
      await createFit(workspaceSlug, { category: category.id, name });
      setNewFitName("");
    } catch (error) {
      onError(error);
    } finally {
      setIsAddingFit(false);
    }
  };

  return (
    <div className="rounded-md border-[0.5px] border-subtle bg-surface-1">
      <div className="group flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", { "rotate-90": isExpanded })} />
          </button>
          {isRenaming ? (
            <EditableName
              name={category.name}
              onCancel={() => setIsRenaming(false)}
              onSave={async (name) => {
                try {
                  await updateCategory(workspaceSlug, category.id, { name });
                  setIsRenaming(false);
                } catch (error) {
                  onError(error);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="truncate text-left text-body-sm-medium text-primary"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {category.name}
            </button>
          )}
          <span className="flex-shrink-0 rounded-sm bg-layer-1 px-1.5 py-0.5 text-11 text-tertiary">
            {t("workspace_settings.settings.product_master.fits_count", { count: fits.length })}
          </span>
        </div>
        {isEditable && !isRenaming && (
          <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Tooltip tooltipContent={t("common.edit")}>
              <button type="button" className={iconButtonClassName} onClick={() => setIsRenaming(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip tooltipContent={t("common.delete")}>
              <button
                type="button"
                className={cn(iconButtonClassName, "hover:text-danger-primary")}
                onClick={() => onDeleteCategory(category)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3 border-t-[0.5px] border-subtle px-4 py-3 pl-11">
          <div className="flex flex-col gap-2">
            {fits.length > 0 ? (
              fits.map((fit) => (
                <FitRow
                  key={fit.id}
                  workspaceSlug={workspaceSlug}
                  fit={fit}
                  isEditable={isEditable}
                  onError={onError}
                  onDelete={onDeleteFit}
                />
              ))
            ) : (
              <span className="text-body-xs-regular text-placeholder">
                {t("workspace_settings.settings.product_master.no_fits")}
              </span>
            )}
          </div>
          {isEditable && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddFit();
              }}
            >
              <Input
                value={newFitName}
                onChange={(event) => setNewFitName(event.target.value)}
                placeholder={t("workspace_settings.settings.product_master.fit_placeholder")}
                className="h-7 w-56 text-body-xs-regular"
                disabled={isAddingFit}
              />
              <button
                type="submit"
                className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption-sm-medium text-accent-primary hover:bg-layer-1 disabled:cursor-not-allowed disabled:text-placeholder"
                disabled={!newFitName.trim() || isAddingFit}
              >
                <Plus className="h-3 w-3" />
                {t("workspace_settings.settings.product_master.add_fit")}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
});
