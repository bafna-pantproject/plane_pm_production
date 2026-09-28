/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useEffect, useState } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui
import { Input } from "@plane/ui";
// hooks
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import useDebounce from "@/hooks/use-debounce";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

export const PurchaseOrderNumberInput = observer(function PurchaseOrderNumberInput(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { t } = useTranslation();
  const { getOrderDetailByIssueId, updateIssueOrderDetail } = useOrderDetail();
  const savedValue = getOrderDetailByIssueId(issueId)?.purchase_order_number ?? "";

  // local editable copy, debounced and synced back from the store like the order number input
  const [value, setValue] = useState(savedValue);
  const debouncedValue = useDebounce(value, 800);

  useEffect(() => {
    setValue(savedValue);
  }, [savedValue]);

  useEffect(() => {
    const trimmedValue = debouncedValue.trim();
    if (trimmedValue === savedValue) return;
    updateIssueOrderDetail(workspaceSlug, projectId, issueId, { purchase_order_number: trimmedValue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      placeholder={t("common.purchase_order")}
      className="h-7.5 w-full grow border-none bg-transparent text-body-xs-regular"
    />
  );
});
