/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TVendor, TVendorCapacity } from "@plane/types";
import { Button, EModalPosition, EModalWidth, Input, Loader, ModalCore, Tooltip, cn } from "@plane/ui";
// hooks
import { useVendor } from "@/hooks/store/use-vendor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  vendor: TVendor | null;
};

type TCapacityRow = {
  key: string;
  year: number;
  month: number;
  capacityEntry: TVendorCapacity | null;
  used: number;
};

const formatMonth = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

export const VendorCapacityModal = observer(function VendorCapacityModal(props: Props) {
  const { isOpen, onClose, vendor } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  const {
    getVendorCapacities,
    fetchVendorCapacities,
    getVendorCapacityUsage,
    fetchVendorCapacityUsage,
    upsertVendorCapacity,
    updateVendorCapacity,
    deleteVendorCapacity,
  } = useVendor();

  const [newMonth, setNewMonth] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const slug = workspaceSlug?.toString();
  const vendorId = vendor?.id;

  const { isLoading: isLoadingCapacities } = useSWR(
    isOpen && slug && vendorId ? `VENDOR_CAPACITIES_${vendorId}` : null,
    isOpen && slug && vendorId ? () => fetchVendorCapacities(slug, vendorId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  const { isLoading: isLoadingUsage } = useSWR(
    isOpen && slug && vendorId ? `VENDOR_CAPACITY_USAGE_${vendorId}` : null,
    isOpen && slug && vendorId ? () => fetchVendorCapacityUsage(slug, vendorId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );
  const isLoading = isLoadingCapacities || isLoadingUsage;

  const capacities = vendorId ? getVendorCapacities(vendorId) : [];
  const usage = vendorId ? getVendorCapacityUsage(vendorId) : [];

  const rowsByKey = new Map<string, TCapacityRow>();
  capacities.forEach((capacity) => {
    const key = `${capacity.year}-${capacity.month}`;
    rowsByKey.set(key, { key, year: capacity.year, month: capacity.month, capacityEntry: capacity, used: 0 });
  });
  usage.forEach((entry) => {
    const key = `${entry.year}-${entry.month}`;
    const existing = rowsByKey.get(key);
    if (existing) existing.used = entry.used;
    else rowsByKey.set(key, { key, year: entry.year, month: entry.month, capacityEntry: null, used: entry.used });
  });
  // toSorted() isn't available at this repo's configured TS lib target.
  // oxlint-disable-next-line no-array-sort
  const rows = [...rowsByKey.values()].sort((a, b) => a.year - b.year || a.month - b.month);

  const handleClose = () => {
    onClose();
    setNewMonth("");
    setNewCapacity("");
    setIsAdding(false);
  };

  const handleAdd = async () => {
    if (!slug || !vendorId || !newMonth || !newCapacity || isAdding) return;
    const [yearStr, monthStr] = newMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const capacityValue = Number(newCapacity);
    if (!year || !month || !Number.isFinite(capacityValue) || capacityValue < 0) return;

    setIsAdding(true);
    try {
      await upsertVendorCapacity(slug, vendorId, { year, month, capacity: capacityValue });
      setNewMonth("");
      setNewCapacity("");
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? t("workspace_settings.settings.vendors.capacity.toasts.error"),
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetRowCapacity = async (row: TCapacityRow, value: string) => {
    if (!slug || !vendorId) return;
    const capacityValue = Number(value);
    if (!Number.isFinite(capacityValue) || capacityValue < 0) return;
    try {
      if (row.capacityEntry) {
        await updateVendorCapacity(slug, vendorId, row.capacityEntry.id, { capacity: capacityValue });
      } else {
        await upsertVendorCapacity(slug, vendorId, { year: row.year, month: row.month, capacity: capacityValue });
      }
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? t("workspace_settings.settings.vendors.capacity.toasts.error"),
      });
    }
  };

  const handleDelete = async (capacity: TVendorCapacity) => {
    if (!slug || !vendorId) return;
    try {
      await deleteVendorCapacity(slug, vendorId, capacity.id);
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? t("workspace_settings.settings.vendors.capacity.toasts.error"),
      });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XL}>
      <div className="p-5">
        <h3 className="text-h4-medium text-primary">
          {t("workspace_settings.settings.vendors.capacity.modal_title", { name: vendor?.name ?? "" })}
        </h3>
        <p className="mt-1 text-body-xs-regular text-tertiary">
          {t("workspace_settings.settings.vendors.capacity.description")}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {rows.length > 0 && (
            <div className="flex items-center gap-2 px-0.5 text-11 text-placeholder">
              <span className="w-40 flex-shrink-0">
                {t("workspace_settings.settings.vendors.capacity.month_label")}
              </span>
              <span className="w-full">{t("workspace_settings.settings.vendors.capacity.capacity_label")}</span>
              <span className="w-24 flex-shrink-0">{t("workspace_settings.settings.vendors.capacity.used_label")}</span>
              <span className="w-7 flex-shrink-0" />
            </div>
          )}
          {isLoading ? (
            <Loader className="flex flex-col gap-2">
              <Loader.Item height="36px" />
              <Loader.Item height="36px" />
            </Loader>
          ) : rows.length > 0 ? (
            rows.map((row) => {
              const isOverCapacity = !!row.capacityEntry && row.used > row.capacityEntry.capacity;
              return (
                <div key={row.key} className="group flex items-center gap-2">
                  <span className="w-40 flex-shrink-0 text-body-sm-regular text-secondary">
                    {formatMonth(row.year, row.month)}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={row.capacityEntry?.capacity}
                    onBlur={(event) => handleSetRowCapacity(row, event.target.value)}
                    placeholder={t("workspace_settings.settings.vendors.capacity.capacity_label")}
                    className="w-full"
                    inputSize="xs"
                  />
                  <span
                    className={cn(
                      "w-24 flex-shrink-0 text-body-xs-regular",
                      isOverCapacity ? "text-danger-primary" : "text-tertiary"
                    )}
                  >
                    {row.used}
                  </span>
                  <Tooltip tooltipContent={t("common.delete")}>
                    <button
                      type="button"
                      onClick={() => row.capacityEntry && handleDelete(row.capacityEntry)}
                      disabled={!row.capacityEntry}
                      className="grid w-7 flex-shrink-0 place-items-center rounded-sm p-1.5 text-tertiary opacity-0 group-hover:opacity-100 hover:bg-layer-1 hover:text-danger-primary disabled:pointer-events-none disabled:opacity-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              );
            })
          ) : (
            <p className="text-body-xs-regular text-tertiary">
              {t("workspace_settings.settings.vendors.capacity.empty_state")}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-subtle pt-4">
          <Input
            type="month"
            value={newMonth}
            onChange={(event) => setNewMonth(event.target.value)}
            className="w-40 flex-shrink-0"
            inputSize="xs"
          />
          <Input
            type="number"
            min={0}
            placeholder={t("workspace_settings.settings.vendors.capacity.capacity_label")}
            value={newCapacity}
            onChange={(event) => setNewCapacity(event.target.value)}
            className="w-full"
            inputSize="xs"
          />
          <Button
            variant="neutral-primary"
            size="sm"
            onClick={handleAdd}
            disabled={!newMonth || !newCapacity}
            loading={isAdding}
          >
            {t("workspace_settings.settings.vendors.capacity.add_month")}
          </Button>
        </div>

        <div className="mt-5 flex items-center justify-end">
          <Button variant="neutral-primary" size="sm" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
