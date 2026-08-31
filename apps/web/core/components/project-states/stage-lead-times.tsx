/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// i18n
import { useTranslation } from "@plane/i18n";
import { Input } from "@plane/ui";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
import { useStageLeadTime } from "@/hooks/store/use-stage-lead-time";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isEditable: boolean;
};

const LeadTimeRow = observer(function LeadTimeRow(props: {
  workspaceSlug: string;
  projectId: string;
  stateId: string;
  stateName: string;
  isEditable: boolean;
}) {
  const { workspaceSlug, projectId, stateId, stateName, isEditable } = props;
  const { getProjectStageLeadTimes, updateStageLeadTime } = useStageLeadTime();
  const stageLeadTime = getProjectStageLeadTimes(projectId)?.find((slt) => slt.state === stateId);
  const [value, setValue] = useState<string>(String(stageLeadTime?.lead_time_days ?? 1));

  if (!stageLeadTime) return null;

  const handleBlur = () => {
    const days = Math.max(0, Number.parseInt(value, 10) || 0);
    setValue(String(days));
    if (days !== stageLeadTime.lead_time_days) {
      updateStageLeadTime(workspaceSlug, projectId, stageLeadTime.id, { lead_time_days: days });
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-subtle px-3 py-2">
      <span className="truncate text-body-xs-regular">{stateName}</span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
        disabled={!isEditable}
        className="w-20 px-2 py-1 text-right text-body-xs-regular"
      />
    </div>
  );
});

export const ProjectStageLeadTimes = observer(function ProjectStageLeadTimes(props: Props) {
  const { workspaceSlug, projectId, isEditable } = props;
  const { t } = useTranslation();
  const { getProjectStates } = useProjectState();
  const { fetchProjectStageLeadTimes } = useStageLeadTime();

  useSWR(
    workspaceSlug && projectId ? `PROJECT_STAGE_LEAD_TIMES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchProjectStageLeadTimes(workspaceSlug, projectId) : null,
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  const states = getProjectStates(projectId);
  if (!states || states.length === 0) return null;

  return (
    <div className="mt-8 w-full">
      <h4 className="text-body-sm-medium">{t("project_settings.states.lead_time_heading")}</h4>
      <p className="mt-1 text-body-xs-regular text-tertiary">{t("project_settings.states.lead_time_description")}</p>
      <div className="mt-4 flex flex-col gap-2">
        {states.map((state) => (
          <LeadTimeRow
            key={state.id}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            stateId={state.id}
            stateName={state.name}
            isEditable={isEditable}
          />
        ))}
      </div>
    </div>
  );
});
