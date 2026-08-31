/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Pencil, Trash2 } from "lucide-react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TVendor } from "@plane/types";
import { Tooltip, cn } from "@plane/ui";

type Props = {
  vendor: TVendor;
  isEditable: boolean;
  onEdit: (vendor: TVendor) => void;
  onDelete: (vendor: TVendor) => void;
};

export const VendorListItem = observer(function VendorListItem(props: Props) {
  const { vendor, isEditable, onEdit, onDelete } = props;
  const { t } = useTranslation();

  const contactLine = [vendor.contact_name, vendor.contact_email, vendor.contact_phone].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-center justify-between gap-3 rounded-md border-[0.5px] border-subtle bg-surface-1 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-body-sm-medium text-primary">{vendor.name}</span>
          {vendor.code && (
            <span className="rounded-sm bg-layer-1 px-1.5 py-0.5 text-11 text-tertiary">{vendor.code}</span>
          )}
          {!vendor.is_active && (
            <span className="rounded-sm bg-layer-1 px-1.5 py-0.5 text-11 text-placeholder">
              {t("workspace_settings.settings.vendors.inactive_badge")}
            </span>
          )}
        </div>
        {contactLine && <span className="truncate text-body-xs-regular text-tertiary">{contactLine}</span>}
      </div>

      {isEditable && (
        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip tooltipContent={t("common.edit")}>
            <button
              type="button"
              onClick={() => onEdit(vendor)}
              className={cn(
                "grid place-items-center rounded-sm p-1.5 text-tertiary hover:bg-layer-1 hover:text-primary"
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip tooltipContent={t("common.delete")}>
            <button
              type="button"
              onClick={() => onDelete(vendor)}
              className={cn(
                "grid place-items-center rounded-sm p-1.5 text-tertiary hover:bg-layer-1 hover:text-danger-primary"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
});
