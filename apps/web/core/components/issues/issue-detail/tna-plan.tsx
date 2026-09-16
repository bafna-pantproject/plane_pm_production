/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CalendarCheck2 } from "lucide-react";
import { observer } from "mobx-react";
import { useEffect } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
// utils
import { renderFormattedDate, renderFormattedPayloadDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useTaskStateTarget } from "@/hooks/store/use-task-state-target";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
  /** matches the text size used by the sidebar this renders inside of. */
  textClassName?: string;
};

/**
 * TNA (Time and Action) plan: per-workflow-state target dates for an issue,
 * with the date it actually entered that state tracked alongside it.
 */
export const IssueTNAPlan = observer(function IssueTNAPlan(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled, textClassName = "text-body-xs-regular" } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectStates } = useProjectState();
  const { getIssueStateTargets, fetchIssueStateTargets, setIssueStateTarget } = useTaskStateTarget();
  // derived values
  const stateTargets = getIssueStateTargets(issueId);
  const projectStates = getProjectStates(projectId);

  useEffect(() => {
    if (!stateTargets) fetchIssueStateTargets(workspaceSlug, projectId, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, issueId]);

  return (
    <div>
      <h6 className="text-body-xs-medium">{t("common.tna_plan")}</h6>
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
