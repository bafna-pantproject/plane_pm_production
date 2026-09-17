/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { ArrowDownToLine, CalendarCheck2 } from "lucide-react";
import { observer } from "mobx-react";
// i18n
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
// utils
import { renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useTaskStateTarget } from "@/hooks/store/use-task-state-target";
import { escapeHtml } from "@/hooks/use-date-change-reason";
import { ReasonConfirmationModal } from "./reason-confirmation-modal";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  /** matches the text size used by the sidebar this renders inside of. */
  textClassName?: string;
  /** direct sub work item count, used to enable/disable the cascade button. */
  subIssuesCount?: number;
};

/**
 * TNA (Time and Action) plan: per-workflow-state target dates for an issue,
 * with the date it actually entered that state tracked alongside it.
 */
export const IssueTNAPlan = observer(function IssueTNAPlan(props: Props) {
  const {
    workspaceSlug,
    projectId,
    issueId,
    disabled,
    textClassName = "text-body-xs-regular",
    subIssuesCount = 0,
  } = props;
  const { t } = useTranslation();
  // states
  const [isCascadeModalOpen, setIsCascadeModalOpen] = useState(false);
  const [isCascading, setIsCascading] = useState(false);
  // store hooks
  const { getProjectStates } = useProjectState();
  const { getIssueStateTargets, fetchIssueStateTargets, setIssueStateTarget, cascadeStateTargetsToSubIssues } =
    useTaskStateTarget();
  const { comment } = useIssueDetail();
  // derived values
  const stateTargets = getIssueStateTargets(issueId);
  const projectStates = getProjectStates(projectId);
  const hasTargetDates = !!stateTargets?.some((target) => !!target.target_date);
  const canCascade = !disabled && subIssuesCount > 0 && hasTargetDates;

  useEffect(() => {
    if (!stateTargets) fetchIssueStateTargets(workspaceSlug, projectId, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, issueId]);

  const cascadeDisabledReason = disabled
    ? undefined
    : subIssuesCount === 0
      ? t("common.tna_plan_cascade_no_sub_issues")
      : !hasTargetDates
        ? t("common.tna_plan_cascade_no_targets")
        : undefined;

  const handleCascade = async (reason: string) => {
    setIsCascading(true);
    try {
      const updatedIssueIds = await cascadeStateTargetsToSubIssues(workspaceSlug, projectId, issueId);
      await comment.createComment(workspaceSlug, projectId, issueId, {
        comment_html: `<p>TNA Plan Changed: ${escapeHtml(reason)}</p>`,
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: t("common.tna_plan_cascade_success", { count: updatedIssueIds.length }),
      });
      setIsCascadeModalOpen(false);
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.detail ?? error?.error ?? "Something went wrong",
      });
    } finally {
      setIsCascading(false);
    }
  };

  return (
    <div>
      <ReasonConfirmationModal
        isOpen={isCascadeModalOpen}
        onClose={() => setIsCascadeModalOpen(false)}
        onConfirm={handleCascade}
        isSubmitting={isCascading}
        title={t("common.tna_plan_cascade_confirm_title")}
        description={t("common.tna_plan_cascade_confirm_description", { count: subIssuesCount })}
      />
      <div className="flex items-center justify-between gap-2">
        <h6 className="text-body-xs-medium">{t("common.tna_plan")}</h6>
        <Tooltip tooltipContent={cascadeDisabledReason} disabled={!cascadeDisabledReason}>
          <button
            type="button"
            onClick={() => setIsCascadeModalOpen(true)}
            disabled={!canCascade}
            className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption-sm-medium text-accent-primary hover:bg-layer-1 disabled:cursor-not-allowed disabled:text-placeholder disabled:hover:bg-transparent"
          >
            <ArrowDownToLine className="h-3 w-3" strokeWidth={2} />
            {t("common.tna_plan_cascade_button")}
          </button>
        </Tooltip>
      </div>
      <div className={`mt-3 w-full space-y-3 ${disabled ? "opacity-60" : ""}`}>
        {(projectStates ?? []).map((state) => {
          const stateTarget = stateTargets?.find((target) => target.state === state.id);
          return (
            <SidebarPropertyListItem key={state.id} icon={CalendarCheck2} label={state.name}>
              <DateDropdown
                placeholder={t("common.target_date")}
                value={stateTarget?.target_date ?? null}
                onChange={(val) =>
                  setIssueStateTarget(
                    workspaceSlug,
                    projectId,
                    issueId,
                    state.id,
                    val ? renderFormattedPayloadDate(val) : null
                  )
                }
                disabled={disabled}
                buttonVariant="transparent-with-text"
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName={`${textClassName} ${stateTarget?.target_date ? "" : "text-placeholder"}`}
                hideIcon
                clearIconClassName="h-3 w-3 hidden group-hover:inline"
              />
              <span className={`shrink-0 px-2 text-tertiary ${textClassName}`}>
                {stateTarget?.entered_at
                  ? `${t("common.entered_at")}: ${renderFormattedDate(stateTarget.entered_at)}`
                  : ""}
              </span>
            </SidebarPropertyListItem>
          );
        })}
      </div>
    </div>
  );
});
