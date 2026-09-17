/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";

export const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Props = {
  workspaceSlug: string | undefined;
  projectId: string | null | undefined;
  issueId: string | undefined;
  /** posted as `<commentLabel>: <reason>` on the work item once confirmed */
  commentLabel: string;
};

/**
 * Gates a field change behind a "why is this changing?" confirmation whenever
 * the field already had a value - the typed reason is posted as a comment on
 * the work item. A change from empty to a value applies immediately, no
 * reason needed.
 */
export const useDateChangeReason = ({ workspaceSlug, projectId, issueId, commentLabel }: Props) => {
  const { t } = useTranslation();
  const { comment } = useIssueDetail();
  const [pendingAction, setPendingAction] = useState<(() => void | Promise<unknown>) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestChange = (hadExistingValue: boolean, apply: () => void | Promise<unknown>) => {
    if (!hadExistingValue) {
      apply();
      return;
    }
    setPendingAction(() => apply);
  };

  const handleConfirm = async (reason: string) => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      await pendingAction();
      if (workspaceSlug && projectId && issueId) {
        await comment.createComment(workspaceSlug, projectId, issueId, {
          comment_html: `<p>${commentLabel}: ${escapeHtml(reason)}</p>`,
        });
      }
      setPendingAction(null);
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? error?.error ?? "Something went wrong",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    requestChange,
    reasonModalProps: {
      isOpen: !!pendingAction,
      isSubmitting,
      onClose: () => setPendingAction(null),
      onConfirm: handleConfirm,
    },
  };
};
