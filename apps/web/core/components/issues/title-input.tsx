/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import type { TNameDescriptionLoader } from "@plane/types";
// components
import { TextArea } from "@plane/ui";
// types
import { cn } from "@plane/utils";
import useDebounce from "@/hooks/use-debounce";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useVendor } from "@/hooks/store/use-vendor";
import type { TIssueOperations } from "./issue-detail";
// hooks

export type IssueTitleInputProps = {
  disabled?: boolean;
  value: string | undefined | null;
  workspaceSlug: string;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
  issueOperations: TIssueOperations;
  projectId: string;
  issueId: string;
  className?: string;
  containerClassName?: string;
};

export const IssueTitleInput = observer(function IssueTitleInput(props: IssueTitleInputProps) {
  const {
    disabled,
    value,
    workspaceSlug,
    isSubmitting,
    setIsSubmitting,
    issueId,
    issueOperations,
    projectId,
    className,
    containerClassName,
  } = props;
  const { t } = useTranslation();
  // states
  const [title, setTitle] = useState(value || "");
  const [isLengthVisible, setIsLengthVisible] = useState(false);
  // ref to track if there are unsaved changes
  const hasUnsavedChanges = useRef(false);
  // ref to store current title value for cleanup function
  const currentTitleRef = useRef(title);
  // hooks
  const debouncedValue = useDebounce(title, 1500);
  // order detail (category/vendor/quantity) hooks
  const { getOrderDetailByIssueId, fetchIssueOrderDetail } = useOrderDetail();
  const { getVendorById } = useVendor();
  const orderDetail = getOrderDetailByIssueId(issueId);

  // the project-wide bulk fetch (project-wrapper.tsx) may not have completed yet when this
  // mounts on its own (e.g. deep-linking straight into an issue), so backstop it here too.
  useEffect(() => {
    if (!orderDetail) fetchIssueOrderDetail(workspaceSlug, projectId, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, issueId]);

  useEffect(() => {
    if (value) {
      setTitle(value);
      currentTitleRef.current = value;
      // Reset unsaved changes flag when value is set from props
      hasUnsavedChanges.current = false;
    }
  }, [value]);

  useEffect(() => {
    const textarea = document.querySelector("#title-input");
    if (debouncedValue && debouncedValue !== value) {
      if (debouncedValue.trim().length > 0) {
        issueOperations.update(workspaceSlug, projectId, issueId, { name: debouncedValue }).finally(() => {
          setIsSubmitting("saved");
          hasUnsavedChanges.current = false;
          if (textarea && !textarea.matches(":focus")) {
            const trimmedTitle = debouncedValue.trim();
            if (trimmedTitle !== title) setTitle(trimmedTitle);
          }
        });
      } else {
        setTitle(value || "");
        setIsSubmitting("saved");
        hasUnsavedChanges.current = false;
      }
    }
    // DO NOT Add more dependencies here. It will cause multiple requests to be sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  useEffect(() => {
    const handleBlur = () => {
      const trimmedTitle = title.trim();
      if (trimmedTitle !== title && isSubmitting !== "submitting") {
        if (trimmedTitle.length > 0) {
          setTitle(trimmedTitle);
          setIsSubmitting("submitting");
          hasUnsavedChanges.current = true;
        } else {
          setTitle(value || "");
          setIsSubmitting("saved");
          hasUnsavedChanges.current = false;
        }
      }
    };

    const textarea = document.querySelector("#title-input"); // You might need to change this selector according to your TextArea component
    if (textarea) {
      textarea.addEventListener("blur", handleBlur);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener("blur", handleBlur);
      }
    };
  }, [title, isSubmitting, setIsSubmitting]);

  // Save on unmount if there are unsaved changes
  useEffect(
    () => () => {
      if (hasUnsavedChanges.current && currentTitleRef.current.trim().length > 0) {
        issueOperations
          .update(workspaceSlug, projectId, issueId, { name: currentTitleRef.current.trim() })
          .catch((error) => {
            console.error("Failed to save title on unmount:", error);
          })
          .finally(() => {
            setIsSubmitting("saved");
            hasUnsavedChanges.current = false;
          });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setIsSubmitting("submitting");
      const titleFromEvent = e.target.value;
      setTitle(titleFromEvent);
      currentTitleRef.current = titleFromEvent;
      hasUnsavedChanges.current = true;
    },
    [setIsSubmitting]
  );

  // work items that have been through the category/vendor/quantity form (i.e. every work
  // item created or edited since that change shipped) show those 3 values instead of the
  // free-form title. Legacy/generic work items with no category set yet keep the title.
  if (orderDetail?.category) {
    const vendor = orderDetail.vendor ? getVendorById(orderDetail.vendor) : null;
    return (
      <div className={cn("flex flex-wrap items-baseline gap-x-6 gap-y-1 px-3", containerClassName)}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-13 font-medium text-secondary">{t("common.category")}:</span>
          <span className="text-20 font-medium">{orderDetail.category}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-13 font-medium text-secondary">{t("common.vendor")}:</span>
          <span className="text-20 font-medium">{vendor?.name ?? "—"}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-13 font-medium text-secondary">{t("common.quantity")}:</span>
          <span className="text-20 font-medium">
            {orderDetail.quantity ? `${orderDetail.quantity} units` : "—"}
          </span>
        </div>
      </div>
    );
  }

  if (disabled) return <div className="text-20 font-medium whitespace-pre-line">{title}</div>;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("relative", containerClassName)}>
        <TextArea
          id="title-input"
          className={cn(
            "block w-full resize-none overflow-hidden rounded-sm border-none bg-transparent px-3 py-0 text-20 font-medium ring-0 outline-none",
            {
              "mx-2.5 ring-1 ring-danger-strong": title?.length === 0,
            },
            className
          )}
          disabled={disabled}
          value={title}
          onChange={handleTitleChange}
          maxLength={255}
          placeholder={t("issue.title.label")}
          onFocus={() => setIsLengthVisible(true)}
          onBlur={() => setIsLengthVisible(false)}
        />
        <div
          className={cn(
            "pointer-events-none absolute right-1 bottom-1 z-[2] rounded-sm bg-surface-1 p-0.5 text-11 text-secondary opacity-0 transition-opacity",
            {
              "opacity-100": isLengthVisible,
            }
          )}
        >
          <span className={`${title.length === 0 || title.length > 255 ? "text-danger-primary" : ""}`}>
            {title.length}
          </span>
          /255
        </div>
      </div>
      {title?.length === 0 && (
        <span className="text-13 font-medium text-danger-primary">{t("form.title.required")}</span>
      )}
    </div>
  );
});
