/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { STATE_REQUIRED_FIELDS, getTnaRequiredField, getTnaRequiredFieldStateId } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TIssue, TOrderDetail, TStateRequiredField } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
import { composeOrderDetailName, renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useStateTransitionGate } from "@/hooks/store/use-state-transition-gate";
import { useTaskStateTarget } from "@/hooks/store/use-task-state-target";
import { useVendor } from "@/hooks/store/use-vendor";
import { escapeHtml } from "@/hooks/use-date-change-reason";
// store
import type { TPendingStateTransition } from "@/store/state-transition-gate.store";
// local components
import { CatalogSelect } from "./catalog-select";

type TFieldValues = Partial<Record<TStateRequiredField, string | null>>;

const PRICE_FIELDS = new Set<TStateRequiredField>(["fabric_price", "trims_price", "fob_price"]);
const DATE_FIELDS = new Set<TStateRequiredField>(["requested_delivery_date", "target_date"]);

const isDateField = (field: TStateRequiredField) =>
  DATE_FIELDS.has(field) || getTnaRequiredFieldStateId(field) !== null;

const isFieldFilled = (field: TStateRequiredField, value: string | null | undefined) => {
  if (value === null || value === undefined || value.trim() === "") return false;
  if (field === "quantity") {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity > 0;
  }
  if (PRICE_FIELDS.has(field)) {
    const price = Number(value);
    return Number.isFinite(price) && price >= 0;
  }
  return true;
};

type TFormProps = { pending: TPendingStateTransition };

const StateRequiredFieldsForm = observer(function StateRequiredFieldsForm(props: TFormProps) {
  const { pending } = props;
  const { workspaceSlug, projectId, issueId, stateId, missingFields } = pending;
  // hooks
  const { t } = useTranslation();
  const { settle } = useStateTransitionGate();
  const { getStateById, getProjectStates } = useProjectState();
  const { updateIssueOrderDetail, getOrderDetailByIssueId } = useOrderDetail();
  const { setIssueStateTarget } = useTaskStateTarget();
  const { comment } = useIssueDetail();
  const { workspaceVendors, createVendor, getVendorById } = useVendor();
  // states
  const [values, setValues] = useState<TFieldValues>({});
  const [isSaving, setIsSaving] = useState(false);
  // derived values
  const stateName = getStateById(stateId)?.name ?? "";
  // plain order fields first, then the TNA target dates in workflow order
  const fields = [
    ...STATE_REQUIRED_FIELDS.filter((field) => missingFields.includes(field.key)).map((field) => ({
      key: field.key,
      label: t(field.i18n_label),
    })),
    ...(getProjectStates(projectId) ?? [])
      .filter((state) => missingFields.includes(getTnaRequiredField(state.id)))
      .map((state) => ({
        key: getTnaRequiredField(state.id),
        label: t("common.state_required_tna_date_label", { state: state.name }),
      })),
  ];
  const canSave = fields.every((field) => isFieldFilled(field.key, values[field.key]));

  const setValue = (field: TStateRequiredField, value: string | null) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const handleCancel = () => {
    if (isSaving) return;
    settle({ proceed: false });
  };

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const orderDetailPatch: Record<string, unknown> = {};
      const issueData: Partial<TIssue> = {};
      const tnaTargets: { stateId: string; date: string }[] = [];
      fields.forEach(({ key }) => {
        const value = (values[key] ?? "").trim();
        const tnaStateId = getTnaRequiredFieldStateId(key);
        if (tnaStateId) tnaTargets.push({ stateId: tnaStateId, date: value });
        else if (key === "target_date") issueData.target_date = value;
        else if (key === "quantity") orderDetailPatch.quantity = Number.parseInt(value, 10);
        else if (PRICE_FIELDS.has(key)) orderDetailPatch[key] = Number(value).toFixed(2);
        else orderDetailPatch[key] = value;
      });

      if (Object.keys(orderDetailPatch).length > 0)
        await updateIssueOrderDetail(workspaceSlug, projectId, issueId, orderDetailPatch as Partial<TOrderDetail>);

      for (const { stateId: targetStateId, date } of tnaTargets) {
        // sequential on purpose: the store appends to a per-issue list, so concurrent writes could drop one
        // oxlint-disable-next-line no-await-in-loop
        await setIssueStateTarget(workspaceSlug, projectId, issueId, targetStateId, date);
        // the TNA plan UI records every target date change as a comment, so do the same here (best effort)
        const targetStateName = getStateById(targetStateId)?.name ?? "";
        // oxlint-disable-next-line no-await-in-loop
        await comment
          .createComment(workspaceSlug, projectId, issueId, {
            comment_html: `<p>TNA Plan Changed: ${escapeHtml(targetStateName)} target date not set → ${renderFormattedDate(date)}</p>`,
          })
          .catch((error: unknown) => console.error("Error posting TNA plan comment:", error));
      }

      // work items named after their category/vendor/quantity keep that name in sync, as the sidebar does
      if ("category" in orderDetailPatch || "vendor" in orderDetailPatch || "quantity" in orderDetailPatch) {
        const detail = getOrderDetailByIssueId(issueId);
        const vendorName = detail?.vendor ? getVendorById(detail.vendor)?.name : undefined;
        const derivedName = composeOrderDetailName(detail?.category, vendorName, detail?.quantity);
        if (detail?.category && derivedName) issueData.name = derivedName;
      }

      settle({ proceed: true, issueData });
    } catch (error) {
      console.error("Error saving required fields:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error.label"),
        message: t("entity.update.failed", { entity: t("issue.label") }),
      });
      setIsSaving(false);
    }
  };

  const renderInput = (field: TStateRequiredField, label: string) => {
    if (field === "vendor")
      return (
        <CatalogSelect
          className="w-full"
          value={values.vendor}
          onChange={(vendorId) => setValue("vendor", vendorId)}
          options={(workspaceVendors ?? []).map((vendor) => ({ id: vendor.id, label: vendor.name }))}
          placeholder={label}
          disabled={isSaving}
          onCreate={(name) => createVendor(workspaceSlug, { name })}
        />
      );
    if (isDateField(field))
      return (
        <DateDropdown
          placeholder={label}
          value={values[field] ?? null}
          onChange={(date) => setValue(field, (date && renderFormattedPayloadDate(date)) || null)}
          disabled={isSaving}
          buttonVariant="border-with-text"
          className="w-full"
          buttonContainerClassName="w-full text-left"
          buttonClassName="w-full text-body-xs-regular"
          isClearable={false}
        />
      );
    const isQuantity = field === "quantity";
    const isPrice = PRICE_FIELDS.has(field);
    return (
      <Input
        type={isQuantity || isPrice ? "number" : "text"}
        min={isQuantity ? 1 : isPrice ? 0 : undefined}
        step={isQuantity ? 1 : isPrice ? "0.01" : undefined}
        value={values[field] ?? ""}
        onChange={(event) => setValue(field, event.target.value)}
        placeholder={label}
        disabled={isSaving}
        className="w-full"
      />
    );
  };

  return (
    <ModalCore isOpen handleClose={handleCancel} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="p-5">
        <h3 className="text-16 font-medium">{t("common.state_required_fields_modal_title", { state: stateName })}</h3>
        <p className="mt-1 text-13 text-secondary">
          {t("common.state_required_fields_modal_description", { state: stateName })}
        </p>
        <div className="mt-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-12 font-medium text-secondary">
                {field.label}
                <span className="ml-0.5 text-danger-primary">*</span>
              </label>
              {renderInput(field.key, field.label)}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t-[0.5px] border-subtle px-5 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>
          {t("cancel")}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!canSave}>
          {t("common.state_required_fields_save_and_move")}
        </Button>
      </div>
    </ModalCore>
  );
});

/** Global popup: shown whenever a state move is waiting on required fields (see StateTransitionGateStore). */
export const StateRequiredFieldsModal = observer(function StateRequiredFieldsModal() {
  const { pending } = useStateTransitionGate();
  if (!pending) return null;
  // keyed so each pending move starts with a clean form
  return <StateRequiredFieldsForm key={`${pending.issueId}:${pending.stateId}`} pending={pending} />;
});
