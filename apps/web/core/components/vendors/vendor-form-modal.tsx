/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TVendor } from "@plane/types";
import { Button, EModalPosition, EModalWidth, Input, ModalCore, TextArea, ToggleSwitch } from "@plane/ui";
// hooks
import { useVendor } from "@/hooks/store/use-vendor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  vendorToUpdate: TVendor | null;
};

type TFormState = {
  name: string;
  code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  is_active: boolean;
};

const EMPTY_FORM: TFormState = {
  name: "",
  code: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  is_active: true,
};

export const VendorFormModal = observer(function VendorFormModal(props: Props) {
  const { isOpen, onClose, vendorToUpdate } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const { createVendor, updateVendor } = useVendor();

  const [formData, setFormData] = useState<TFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!vendorToUpdate;

  useEffect(() => {
    if (isOpen) {
      setFormData(
        vendorToUpdate
          ? {
              name: vendorToUpdate.name,
              code: vendorToUpdate.code,
              contact_name: vendorToUpdate.contact_name,
              contact_email: vendorToUpdate.contact_email,
              contact_phone: vendorToUpdate.contact_phone,
              address: vendorToUpdate.address,
              is_active: vendorToUpdate.is_active,
            }
          : EMPTY_FORM
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vendorToUpdate]);

  const handleClose = () => {
    onClose();
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!workspaceSlug || !formData.name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing && vendorToUpdate) {
        await updateVendor(workspaceSlug.toString(), vendorToUpdate.id, formData);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.vendors.toasts.updated") });
      } else {
        await createVendor(workspaceSlug.toString(), formData);
        setToast({ type: TOAST_TYPE.SUCCESS, title: t("workspace_settings.settings.vendors.toasts.created") });
      }
      handleClose();
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.name?.[0] ?? error?.detail ?? t("workspace_settings.settings.vendors.toasts.error"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XL}>
      <div className="p-5">
        <h3 className="text-h4-medium text-primary">
          {isEditing
            ? t("workspace_settings.settings.vendors.edit_vendor")
            : t("workspace_settings.settings.vendors.add_vendor")}
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.name")}
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.name")}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.code")}
            </label>
            <Input
              type="text"
              value={formData.code}
              onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.code")}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.contact_name")}
            </label>
            <Input
              type="text"
              value={formData.contact_name}
              onChange={(event) => setFormData((prev) => ({ ...prev, contact_name: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.contact_name")}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.contact_email")}
            </label>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(event) => setFormData((prev) => ({ ...prev, contact_email: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.contact_email")}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.contact_phone")}
            </label>
            <Input
              type="text"
              value={formData.contact_phone}
              onChange={(event) => setFormData((prev) => ({ ...prev, contact_phone: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.contact_phone")}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-2 self-end pb-1.5">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.is_active")}
            </label>
            <ToggleSwitch
              value={formData.is_active}
              onChange={(value) => setFormData((prev) => ({ ...prev, is_active: value }))}
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-body-xs-medium text-tertiary">
              {t("workspace_settings.settings.vendors.fields.address")}
            </label>
            <TextArea
              value={formData.address}
              onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
              placeholder={t("workspace_settings.settings.vendors.fields.address")}
              className="w-full"
              rows={2}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
            loading={isSubmitting}
          >
            {isEditing ? t("common.save") : t("common.add")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
