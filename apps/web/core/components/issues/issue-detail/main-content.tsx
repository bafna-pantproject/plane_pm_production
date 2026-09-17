// oxlint-disable no-shadow
/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Barcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import type { TNameDescriptionLoader } from "@plane/types";
import { EFileAssetType, EIssueServiceType } from "@plane/types";
import { Input } from "@plane/ui";
// i18n
import { useTranslation } from "@plane/i18n";
// components
import { DescriptionVersionsRoot } from "@/components/core/description-versions";
import { DescriptionInput } from "@/components/editor/rich-text/description-input";
import { IssueTypeSwitcher } from "@/components/issues/issue-type-switcher";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useUser } from "@/hooks/store/user";
import useDebounce from "@/hooks/use-debounce";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import useSize from "@/hooks/use-window-size";
// services
import { WorkItemVersionService } from "@/services/issue";
// local imports
import { IssueDetailWidgets } from "../issue-detail-widgets";
import { NameDescriptionUpdateStatus } from "../issue-update-status";
import { PeekOverviewProperties } from "../peek-overview/properties";
import { IssueTitleInput } from "../title-input";
import { IssueActivity } from "./issue-activity";
import { IssueParentDetail } from "./parent";
import { IssueReaction } from "./reactions";
import type { TIssueOperations } from "./root";
// services init
const workItemVersionService = new WorkItemVersionService();

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
  isArchived: boolean;
};

export const IssueMainContent = observer(function IssueMainContent(props: Props) {
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable, isArchived } = props;
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // states
  const [isSubmitting, setIsSubmitting] = useState<TNameDescriptionLoader>("saved");
  // hooks
  const { t } = useTranslation();
  const windowSize = useSize();
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();
  const {
    issue: { getIssueById },
    peekIssue,
  } = useIssueDetail();
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");
  const { getOrderDetailByIssueId, fetchIssueOrderDetail, updateIssueOrderDetail } = useOrderDetail();
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
    } else if (isSubmitting === "submitting") setShowAlert(true);
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);

  if (!issue || !issue.project_id) return <></>;

  const isPeekModeActive = Boolean(peekIssue);

  return (
    <>
      <div className="space-y-4 rounded-lg">
        {issue.parent_id && (
          <IssueParentDetail
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            issue={issue}
            issueOperations={issueOperations}
          />
        )}

        <div className="mb-2.5 flex items-center justify-between gap-4">
          <IssueTypeSwitcher issueId={issueId} disabled={isArchived || !isEditable} />
          <div className="flex items-center gap-3">
            <NameDescriptionUpdateStatus isSubmitting={isSubmitting} />
          </div>
        </div>

        <IssueTitleInput
          workspaceSlug={workspaceSlug}
          projectId={issue.project_id}
          issueId={issue.id}
          isSubmitting={isSubmitting}
          setIsSubmitting={(value) => setIsSubmitting(value)}
          issueOperations={issueOperations}
          disabled={isArchived || !isEditable}
          value={issue.name}
          containerClassName="-ml-3"
        />

        <div className="-mb-1.5 flex items-center gap-2">
          <Barcode className="h-3.5 w-3.5 flex-shrink-0 text-secondary" strokeWidth={2} />
          <Input
            type="text"
            value={orderNumberInput}
            onChange={(e) => setOrderNumberInput(e.target.value)}
            disabled={isArchived || !isEditable}
            placeholder={t("common.order_number")}
            className="h-7 w-auto min-w-40 grow-0 border-none bg-transparent px-1 text-body-xs-regular"
          />
        </div>

        <DescriptionInput
          issueSequenceId={issue.sequence_id}
          containerClassName="-ml-6 border-none p-0! pl-6!"
          disabled={isArchived || !isEditable}
          editorRef={editorRef}
          entityId={issue.id}
          fileAssetType={EFileAssetType.ISSUE_DESCRIPTION}
          initialValue={issue.description_html}
          key={issue.id}
          onSubmit={async (value, isMigrationUpdate) => {
            if (!issue.id || !issue.project_id) return;
            await issueOperations.update(workspaceSlug, issue.project_id, issue.id, {
              description_html: value.description_html,
              ...(isMigrationUpdate ? { skip_activity: "true" } : {}),
            });
          }}
          projectId={issue.project_id}
          setIsSubmitting={(value) => setIsSubmitting(value)}
          workspaceSlug={workspaceSlug}
        />

        <div className="flex items-center justify-between gap-2">
          {currentUser && (
            <IssueReaction
              className="flex-shrink-0"
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              currentUser={currentUser}
              disabled={isArchived}
            />
          )}
          {isEditable && (
            <DescriptionVersionsRoot
              className="flex-shrink-0"
              entityInformation={{
                createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
                createdByDisplayName: getUserDetails(issue.created_by ?? "")?.display_name ?? "",
                id: issueId,
                isRestoreDisabled: !isEditable || isArchived,
              }}
              fetchHandlers={{
                listDescriptionVersions: (issueId) =>
                  workItemVersionService.listDescriptionVersions(workspaceSlug, projectId, issueId),
                retrieveDescriptionVersion: (issueId, versionId) =>
                  workItemVersionService.retrieveDescriptionVersion(workspaceSlug, projectId, issueId, versionId),
              }}
              handleRestore={(descriptionHTML) => editorRef.current?.setEditorValue(descriptionHTML, true)}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      </div>

      <IssueDetailWidgets
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        issueId={issueId}
        disabled={!isEditable || isArchived}
        renderWidgetModals={!isPeekModeActive}
        issueServiceType={EIssueServiceType.ISSUES}
      />

      {windowSize[0] < 768 && (
        <PeekOverviewProperties
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          issueOperations={issueOperations}
          disabled={!isEditable || isArchived}
        />
      )}

      <IssueActivity workspaceSlug={workspaceSlug} projectId={projectId} issueId={issueId} disabled={isArchived} />
    </>
  );
});
