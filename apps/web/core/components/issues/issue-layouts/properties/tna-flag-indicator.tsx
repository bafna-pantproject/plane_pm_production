/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Flag } from "lucide-react";
import { observer } from "mobx-react";
// i18n
import { TNA_FLAG_SEVERITY_DETAILS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue } from "@plane/types";
import { cn, getTnaFlagSeverity, renderFormattedDate } from "@plane/utils";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  issue: TIssue;
};

/**
 * Read-only badge showing an issue's next-stage TNA flag (red/orange/yellow)
 * — see getTnaFlagSeverity for the bucketing rule. Renders nothing when the
 * issue isn't flagged.
 */
export const TnaFlagIndicator = observer(function TnaFlagIndicator({ issue }: Props) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();

  const severity = getTnaFlagSeverity(issue.next_state_target_date, issue.next_state_target_entered_at);
  if (!severity) return null;

  const { colorClassName, titleTranslationKey } = TNA_FLAG_SEVERITY_DETAILS[severity];
  const targetDate = issue.next_state_target_date;
  const formattedTargetDate = targetDate ? renderFormattedDate(targetDate) : "";

  return (
    <Tooltip
      tooltipHeading={t("common.tna_flag")}
      tooltipContent={t(titleTranslationKey, { days: formattedTargetDate })}
      isMobile={isMobile}
      renderByDefault={false}
    >
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
        <Flag className={cn("h-3.5 w-3.5", colorClassName)} strokeWidth={2} fill="currentColor" />
      </div>
    </Tooltip>
  );
});
