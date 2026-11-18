/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TProductCategory, TProductFit } from "@plane/types";
import { AlertModalCore, Input, Loader } from "@plane/ui";
// hooks
import { useProductMaster } from "@/hooks/store/use-product-master";
// local imports
import { ProductCategoryItem } from "./category-item";

type Props = {
  workspaceSlug: string;
  isEditable: boolean;
};

type TPendingDelete = { kind: "category"; item: TProductCategory } | { kind: "fit"; item: TProductFit };

export const getProductMasterErrorMessage = (error: unknown, fallback: string): string => {
  const data = error as Record<string, string[] | string | undefined> | undefined;
  const first = data?.name ?? data?.category ?? data?.error ?? data?.detail;
  return (Array.isArray(first) ? first[0] : first) ?? fallback;
};

export const ProductMasterRoot = observer(function ProductMasterRoot(props: Props) {
  const { workspaceSlug, isEditable } = props;
  const { t } = useTranslation();
  const { workspaceCategories, fetchProductMaster, createCategory, deleteCategory, deleteFit } = useProductMaster();
  // states
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TPendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { isLoading } = useSWR(
    workspaceSlug ? `WORKSPACE_PRODUCT_MASTER_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchProductMaster(workspaceSlug) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  const showError = (error: unknown) =>
    setToast({
      type: TOAST_TYPE.ERROR,
      title: t("toast.error"),
      message: getProductMasterErrorMessage(error, t("workspace_settings.settings.product_master.toasts.error")),
    });

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      await createCategory(workspaceSlug, { name });
      setNewCategoryName("");
    } catch (error) {
      showError(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.kind === "category") await deleteCategory(workspaceSlug, pendingDelete.item.id);
      else await deleteFit(workspaceSlug, pendingDelete.item.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.product_master.toasts.deleted") });
      setPendingDelete(null);
    } catch (error) {
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteCopyKey =
    pendingDelete?.kind === "fit"
      ? "workspace_settings.settings.product_master.delete_fit_confirm"
      : "workspace_settings.settings.product_master.delete_category_confirm";

  return (
    <div className="mt-8 w-full">
      <div>
        <h4 className="text-body-sm-medium">{t("workspace_settings.settings.product_master.heading")}</h4>
        <p className="mt-1 text-body-xs-regular text-tertiary">
          {t("workspace_settings.settings.product_master.description")}
        </p>
      </div>

      {isEditable && (
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateCategory();
          }}
        >
          <Input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder={t("workspace_settings.settings.product_master.category_placeholder")}
            className="w-full max-w-sm"
            disabled={isCreating}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            prependIcon={<Plus className="h-3.5 w-3.5" />}
            loading={isCreating}
            disabled={!newCategoryName.trim()}
          >
            {t("workspace_settings.settings.product_master.add_category")}
          </Button>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && !workspaceCategories ? (
          <Loader className="flex flex-col gap-2">
            <Loader.Item height="52px" />
            <Loader.Item height="52px" />
          </Loader>
        ) : workspaceCategories && workspaceCategories.length > 0 ? (
          workspaceCategories.map((category) => (
            <ProductCategoryItem
              key={category.id}
              workspaceSlug={workspaceSlug}
              category={category}
              isEditable={isEditable}
              onError={showError}
              onDeleteCategory={(item) => setPendingDelete({ kind: "category", item })}
              onDeleteFit={(item) => setPendingDelete({ kind: "fit", item })}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle px-4 py-8 text-center">
            <Boxes className="h-6 w-6 text-placeholder" />
            <span className="text-body-sm-medium text-secondary">
              {t("workspace_settings.settings.product_master.empty_state.title")}
            </span>
            <span className="text-body-xs-regular text-tertiary">
              {t("workspace_settings.settings.product_master.empty_state.description")}
            </span>
          </div>
        )}
      </div>

      <AlertModalCore
        isOpen={!!pendingDelete}
        handleClose={() => !isDeleting && setPendingDelete(null)}
        handleSubmit={handleDelete}
        isSubmitting={isDeleting}
        title={t(`${deleteCopyKey}.title`)}
        content={t(`${deleteCopyKey}.description`, { name: pendingDelete?.item.name ?? "" })}
      />
    </div>
  );
});
