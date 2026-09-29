/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
// i18n
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssueShipment, TStateGroups } from "@plane/types";
// ui
import { Input } from "@plane/ui";
// utils
import { cn, renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssueShipment } from "@/hooks/store/use-issue-shipment";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";

/** once work is underway shipping is the main thing to track, so the section moves above the TNA plan for these Plane state groups. */
const SHIPMENT_STATE_GROUPS = new Set<TStateGroups>(["started", "completed"]);

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  /** full work item page: dated history plus a note field. The peek drawer (narrow) gets a quick qty + date entry only. */
  showHistory?: boolean;
  /** matches the text size used by the sidebar this renders inside of. */
  textClassName?: string;
  className?: string;
  /** rendered at both spots around the TNA plan; only the one matching the ticket's state group shows. */
  position: "above-tna" | "below-tna";
};

/**
 * Partial shipments of an order: log the quantity shipped on a given day and see the
 * balance still to ship. A parent's totals roll up its direct sub work items' shipments.
 */
export const IssueShipments = observer(function IssueShipments(props: Props) {
  const {
    workspaceSlug,
    projectId,
    issueId,
    disabled,
    showHistory = false,
    textClassName = "text-body-xs-regular",
    className,
    position,
  } = props;
  const { t } = useTranslation();
  // states
  const [shippedDate, setShippedDate] = useState<Date>(new Date());
  const [quantityInput, setQuantityInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // store hooks
  const { getIssueShipments, fetchIssueShipments, createShipment, deleteShipment } = useIssueShipment();
  const { getOrderDetailByIssueId } = useOrderDetail();
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getStateById } = useProjectState();
  // derived values
  const stateGroup = getStateById(getIssueById(issueId)?.state_id)?.group;
  const isActive = !!stateGroup && SHIPMENT_STATE_GROUPS.has(stateGroup);
  const isVisible = !!stateGroup && (position === "above-tna") === isActive;
  const shipmentList = getIssueShipments(issueId);
  const shipments = shipmentList?.shipments ?? [];
  const orderQuantity = getOrderDetailByIssueId(issueId)?.quantity ?? shipmentList?.sub_issues_quantity ?? null;
  const totalShipped = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0);
  const balance = orderQuantity != null ? orderQuantity - totalShipped : null;
  const projectIdentifier = getProjectById(projectId)?.identifier;
  const parsedQuantity = Number(quantityInput);
  const isQuantityValid = quantityInput.trim() !== "" && Number.isInteger(parsedQuantity) && parsedQuantity > 0;

  useEffect(() => {
    if (isVisible && !shipmentList) void fetchIssueShipments(workspaceSlug, projectId, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, issueId, shipmentList, isVisible]);

  const showError = (error: any) =>
    setToast({
      type: TOAST_TYPE.ERROR,
      title: t("toast.error"),
      message: error?.detail ?? error?.error ?? error?.quantity?.[0] ?? "Something went wrong",
    });

  const handleAdd = async () => {
    if (!isQuantityValid) {
      setToast({ type: TOAST_TYPE.ERROR, title: t("toast.error"), message: t("common.shipments_invalid_quantity") });
      return;
    }
    const payloadDate = renderFormattedPayloadDate(shippedDate);
    if (!payloadDate) return;
    setIsSubmitting(true);
    try {
      await createShipment(workspaceSlug, projectId, issueId, {
        shipped_date: payloadDate,
        quantity: parsedQuantity,
        note: noteInput.trim(),
      });
      setQuantityInput("");
      setNoteInput("");
      // the peek drawer has no history list to show the new row, so confirm it here
      if (!showHistory)
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: t("success"),
          message: t("common.shipments_added", { quantity: parsedQuantity }),
        });
    } catch (error: any) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (shipment: TIssueShipment) => {
    setDeletingId(shipment.id);
    try {
      await deleteShipment(workspaceSlug, projectId, issueId, shipment);
    } catch (error: any) {
      showError(error);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={className}>
      <h6 className="text-body-xs-medium">{t("common.shipments")}</h6>

      <div className={cn("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-secondary", textClassName)}>
        <span>
          {t("common.shipments_order_qty")}: <span className="text-primary">{orderQuantity ?? "—"}</span>
        </span>
        <span>
          {t("common.shipments_shipped")}: <span className="text-primary">{totalShipped}</span>
        </span>
        <span>
          {t("common.shipments_balance")}:{" "}
          <span className={cn("text-primary", { "text-danger-primary": balance != null && balance < 0 })}>
            {balance == null ? "—" : balance}
            {balance != null && balance < 0 && ` (${t("common.shipments_over_shipped")})`}
          </span>
        </span>
      </div>

      {!disabled && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Input
            type="number"
            min={1}
            step={1}
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
            placeholder={t("common.shipments_quantity_placeholder")}
            className={cn("h-7 w-28 shrink-0", textClassName)}
          />
          <DateDropdown
            value={shippedDate}
            onChange={(val) => val && setShippedDate(val)}
            buttonVariant="border-with-text"
            buttonContainerClassName="h-7"
            buttonClassName={textClassName}
            isClearable={false}
            hideIcon
          />
          {showHistory && (
            <Input
              type="text"
              value={noteInput}
              maxLength={255}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAdd();
              }}
              placeholder={t("common.shipments_note_placeholder")}
              className={cn("h-7 min-w-32 grow", textClassName)}
            />
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleAdd()}
            loading={isSubmitting}
            disabled={!isQuantityValid || isSubmitting}
          >
            {t("common.shipments_add")}
          </Button>
        </div>
      )}

      {showHistory && (
        <div className={cn("mt-3 space-y-1", textClassName)}>
          {shipmentList && shipments.length === 0 && <p className="text-tertiary">{t("common.shipments_empty")}</p>}
          {shipments.map((shipment) => (
            <div key={shipment.id} className="group flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-layer-1">
              <span className="w-24 shrink-0 text-secondary">{renderFormattedDate(shipment.shipped_date)}</span>
              <span className="w-16 shrink-0 text-right font-medium">{shipment.quantity}</span>
              {shipment.issue !== issueId && projectIdentifier && (
                <span className="shrink-0 rounded-sm bg-layer-2 px-1 text-tertiary">
                  {projectIdentifier}-{shipment.issue_sequence_id}
                </span>
              )}
              <span className="min-w-0 grow truncate text-tertiary">{shipment.note}</span>
              {!disabled && (
                <Tooltip tooltipContent={t("common.shipments_delete")}>
                  <button
                    type="button"
                    onClick={() => void handleDelete(shipment)}
                    disabled={deletingId === shipment.id}
                    aria-label={t("common.shipments_delete")}
                    className="hidden shrink-0 text-tertiary group-hover:inline hover:text-danger-primary disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
