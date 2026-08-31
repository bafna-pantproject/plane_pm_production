/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TVendor } from "@plane/types";
import { AlertModalCore } from "@plane/ui";
// hooks
import { useVendor } from "@/hooks/store/use-vendor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  vendor: TVendor | null;
};

export const VendorDeleteModal = observer(function VendorDeleteModal(props: Props) {
  const { isOpen, onClose, vendor } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { deleteVendor } = useVendor();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClose = () => {
    onClose();
    setIsDeleting(false);
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !vendor) return;
    setIsDeleting(true);
    try {
      await deleteVendor(workspaceSlug.toString(), vendor.id);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.vendors.toasts.deleted") });
      handleClose();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? t("workspace_settings.settings.vendors.toasts.error"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertModalCore
      handleClose={handleClose}
      handleSubmit={handleDelete}
      isSubmitting={isDeleting}
      isOpen={isOpen}
      title={t("workspace_settings.settings.vendors.delete_confirm.title")}
      content={t("workspace_settings.settings.vendors.delete_confirm.description", { name: vendor?.name ?? "" })}
    />
  );
});
