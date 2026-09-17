// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Barcode } from "lucide-react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { EFileAssetType } from "@plane/types";
import type { TNameDescriptionLoader } from "@plane/types";
import { Input } from "@plane/ui";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useUser } from "@/hooks/store/user";
import useDebounce from "@/hooks/use-debounce";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
// plane web components
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
// plane web hooks
// services
import { WorkItemVersionService } from "@/services/issue";
// local components
import type { TIssueOperations } from "../issue-detail";
import { IssueParentDetail } from "../issue-detail/parent";
import { IssueReaction } from "../issue-detail/reactions";
import { IssueTitleInput } from "../title-input";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  editorRef: React.RefObject<EditorRefApi>;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  disabled: boolean;
  isArchived: boolean;
  isSubmitting: TNameDescriptionLoader;
  setIsSubmitting: (value: TNameDescriptionLoader) => void;
};

export const PeekOverviewIssueDetails = observer(function PeekOverviewIssueDetails(props: Props) {
  const { editorRef, workspaceSlug, issueId, issueOperations, disabled, isArchived, isSubmitting, setIsSubmitting } =
    props;
  // store hooks
  const { t } = useTranslation();
  const { data: currentUser } = useUser();
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getUserDetails } = useMember();
  const { getOrderDetailByIssueId, fetchIssueOrderDetail, updateIssueOrderDetail } = useOrderDetail();
  // reload confirmation
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");

  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;
  const orderDetail = issue?.project_id ? getOrderDetailByIssueId(issueId) : null;

  // the project-wide bulk fetch (project-wrapper.tsx) may not have completed yet when this
  // mounts, so backstop it with a fetch scoped to just this issue (mirrors sidebar.tsx).
  useEffect(() => {
    if (!orderDetail && issue?.project_id) fetchIssueOrderDetail(workspaceSlug, issue.project_id, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, issue?.project_id, issueId]);

  // local editable copy of order number, since it's free-typed rather than picked from a
  // dropdown; debounced and synced back from the store like the sidebar's order number input.
  const [orderNumberInput, setOrderNumberInput] = useState(orderDetail?.order_number ?? "");
  const debouncedOrderNumberInput = useDebounce(orderNumberInput, 800);

  useEffect(() => {
    setOrderNumberInput(orderDetail?.order_number ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDetail?.order_number]);

  useEffect(() => {
    const trimmedOrderNumber = debouncedOrderNumberInput.trim();
    if (!issue?.project_id || trimmedOrderNumber === (orderDetail?.order_number ?? "")) return;
    updateIssueOrderDetail(workspaceSlug, issue.project_id, issueId, { order_number: trimmedOrderNumber });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedOrderNumberInput]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      timer = setTimeout(() => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") {
      setShowAlert(true);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  if (!issue || !issue.project_id) return <></>;

  const issueDescription =
    issue.description_html !== undefined || issue.description_html !== null
      ? issue.description_html != ""
        ? issue.description_html
        : "<p></p>"
      : undefined;

  return (
    <div className="space-y-2">
      {issue.parent_id && (
        <IssueParentDetail
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issueId}
          issue={issue}
          issueOperations={issueOperations}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <IssueTypeSwitcher issueId={issueId} disabled={isArchived || disabled} />
      </div>
      <IssueTitleInput
        workspaceSlug={workspaceSlug}
        projectId={issue.project_id}
        issueId={issue.id}
        isSubmitting={isSubmitting}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        issueOperations={issueOperations}
        disabled={disabled || isArchived}
        value={issue.name}
        containerClassName="-ml-3"
      />

      <div className="flex items-center gap-2">
        <Barcode className="h-3.5 w-3.5 flex-shrink-0 text-secondary" strokeWidth={2} />
        <Input
          type="text"
          value={orderNumberInput}
          onChange={(e) => setOrderNumberInput(e.target.value)}
          disabled={disabled || isArchived}
          placeholder={t("common.order_number")}
          className="h-7 w-auto min-w-40 grow-0 border-none bg-transparent px-1 text-body-xs-regular"
        />
      </div>

      <DescriptionInput
        issueSequenceId={issue.sequence_id}
        containerClassName="-ml-3 border-none"
        disabled={disabled || isArchived}
        editorRef={editorRef}
        entityId={issue.id}
        fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
        initialValue={issueDescription}
        key={issue.id}
        onSubmit={async (value, isMigrationUpdate) => {
          if (!issue.id || !issue.project_id) return;
          await issueOperations.update(workspaceSlug, issue.project_id, issue.id, {
            description_html: value.description_html,
            ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
          });
        }}
        setIsSubmitting={(value) => setIsSubmitting(value)}
        projectId={issue.project_id}
        workspaceSlug={workspaceSlug}
      />

      <div className="flex items-center justify-between gap-2">
        {currentUser && (
          <IssueReaction
            workspaceSlug={workspaceSlug}
            projectId={issue.project_id}
            issueId={issueId}
            currentUser={currentUser}
            disabled={isArchived}
          />
        )}
        {!disabled && (
          <DescriptionVersionsRoot
            className="flex-shrink-0"
            entityInformation={{
              createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
              createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
              id: issueId,
              isRestoreDisabled: disabled || isArchived,
            }}
            fetchHandlers={{
              listDescriptionVersions: (issueId) =>
                workItemVersionService.listDescriptionVersions(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId
                ),
              retrieveDescriptionVersion: (issueId, versionId) =>
                workItemVersionService.retrieveDescriptionVersion(
                  workspaceSlug,
                  issue.project_id?.toString() ?? "",
                  issueId,
                  versionId
                ),
            }}
            handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
            projectId={issue.project_id}
            workspaceSlug={workspaceSlug}
          />
        )}
      </div>
    </div>
  );
});
