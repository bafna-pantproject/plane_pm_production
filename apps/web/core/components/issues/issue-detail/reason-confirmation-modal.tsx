/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
// i18n
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
// ui
import { EModalPosition, EModalWidth, ModalCore, TextArea } from "@plane/ui";

type Props = {
  isOpen: boolean;
  title: string;
  description: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Shared confirmation dialog for changes that must be justified with a reason
 * - the reason is later posted as a comment on the work item by the caller.
 * Used for the TNA plan cascade action, and for changing an already-set
 * vendor promised delivery date / requested delivery date.
 */
export function ReasonConfirmationModal(props: Props) {
  const { isOpen, title, description, isSubmitting, onClose, onConfirm } = props;
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) setReason("");
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason || isSubmitting) return;
    onConfirm(trimmedReason);
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
        <span className="grid size-12 flex-shrink-0 place-items-center rounded-full bg-danger-subtle text-danger-primary sm:size-10">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <div className="w-full text-center sm:text-left">
          <h3 className="text-16 font-medium">{title}</h3>
          <p className="mt-1 text-13 text-secondary">{description}</p>
          <TextArea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("common.reason_placeholder")}
            className="mt-3 w-full text-body-sm-regular"
            rows={3}
            disabled={isSubmitting}
          />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t-[0.5px] border-subtle px-5 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
          {t("cancel")}
        </Button>
        <Button variant="error-fill" onClick={handleSubmit} loading={isSubmitting} disabled={!reason.trim()}>
          {t("confirm")}
        </Button>
      </div>
    </ModalCore>
  );
}
