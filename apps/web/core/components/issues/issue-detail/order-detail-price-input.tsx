/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
// types
import type { TOrderDetail } from "@plane/types";
// ui
import { Input } from "@plane/ui";
// hooks
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import useDebounce from "@/hooks/use-debounce";

export type TOrderDetailPriceField = keyof Pick<TOrderDetail, "fabric_price" | "trims_price" | "fob_price">;

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  field: TOrderDetailPriceField;
  placeholder: string;
  disabled: boolean;
};

const parsePrice = (value: string | null | undefined): number | null => {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const OrderDetailPriceInput = observer(function OrderDetailPriceInput(props: Props) {
  const { workspaceSlug, projectId, issueId, field, placeholder, disabled } = props;
  const { getOrderDetailByIssueId, updateIssueOrderDetail } = useOrderDetail();
  const savedValue = getOrderDetailByIssueId(issueId)?.[field] ?? null;

  // local editable copy, debounced and synced back from the store like the quantity input
  const [value, setValue] = useState(savedValue ?? "");
  const debouncedValue = useDebounce(value, 800);

  useEffect(() => {
    setValue(savedValue ?? "");
  }, [savedValue]);

  useEffect(() => {
    const parsedValue = parsePrice(debouncedValue);
    // compare numerically so "12.5" doesn't re-save over the server's "12.50"
    if (Number.isNaN(parsedValue) || (parsedValue !== null && parsedValue < 0)) return;
    if (parsedValue === parsePrice(savedValue)) return;
    updateIssueOrderDetail(workspaceSlug, projectId, issueId, {
      [field]: parsedValue === null ? null : parsedValue.toFixed(2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="h-7.5 w-full grow border-none bg-transparent text-body-xs-regular"
    />
  );
});
