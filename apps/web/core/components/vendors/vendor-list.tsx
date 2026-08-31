/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TVendor } from "@plane/types";
import { Button, Loader } from "@plane/ui";
// hooks
import { useVendor } from "@/hooks/store/use-vendor";
// components
import { VendorDeleteModal } from "./vendor-delete-modal";
import { VendorFormModal } from "./vendor-form-modal";
import { VendorListItem } from "./vendor-list-item";

type Props = {
  workspaceSlug: string;
  isEditable: boolean;
};

export const VendorList = observer(function VendorList(props: Props) {
  const { workspaceSlug, isEditable } = props;
  const { t } = useTranslation();
  const { workspaceVendors, fetchWorkspaceVendors } = useVendor();

  const [vendorToUpdate, setVendorToUpdate] = useState<TVendor | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<TVendor | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { isLoading } = useSWR(
    workspaceSlug ? `WORKSPACE_VENDORS_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchWorkspaceVendors(workspaceSlug) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  const openCreateForm = () => {
    setVendorToUpdate(null);
    setIsFormOpen(true);
  };

  const openEditForm = (vendor: TVendor) => {
    setVendorToUpdate(vendor);
    setIsFormOpen(true);
  };

  return (
    <div className="mt-8 w-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-body-sm-medium">{t("workspace_settings.settings.vendors.heading")}</h4>
          <p className="mt-1 text-body-xs-regular text-tertiary">
            {t("workspace_settings.settings.vendors.description")}
          </p>
        </div>
        {isEditable && (
          <Button
            variant="neutral-primary"
            size="sm"
            prependIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={openCreateForm}
          >
            {t("workspace_settings.settings.vendors.add_vendor")}
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading && !workspaceVendors ? (
          <Loader className="flex flex-col gap-2">
            <Loader.Item height="52px" />
            <Loader.Item height="52px" />
          </Loader>
        ) : workspaceVendors && workspaceVendors.length > 0 ? (
          workspaceVendors.map((vendor) => (
            <VendorListItem
              key={vendor.id}
              vendor={vendor}
              isEditable={isEditable}
              onEdit={openEditForm}
              onDelete={setVendorToDelete}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-subtle px-4 py-8 text-center">
            <Building2 className="h-6 w-6 text-placeholder" />
            <span className="text-body-sm-medium text-secondary">
              {t("workspace_settings.settings.vendors.empty_state.title")}
            </span>
            <span className="text-body-xs-regular text-tertiary">
              {t("workspace_settings.settings.vendors.empty_state.description")}
            </span>
          </div>
        )}
      </div>

      <VendorFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} vendorToUpdate={vendorToUpdate} />
      <VendorDeleteModal isOpen={!!vendorToDelete} onClose={() => setVendorToDelete(null)} vendor={vendorToDelete} />
    </div>
  );
});
