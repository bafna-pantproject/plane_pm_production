/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { differenceInCalendarDays } from "date-fns/differenceInCalendarDays";
// plane imports
import type { TTnaFlagSeverity } from "@plane/constants";
// local imports
import { getDate } from "../datetime";

/**
 * @description severity of the next-stage TNA flag for an issue, based on how
 * far past (or how close to) the next workflow state's target date today is.
 * Returns null when the issue already entered that state, or the target date
 * is more than 10 days away.
 * @param targetDate the next state's TaskStateTarget.target_date
 * @param enteredAt the next state's TaskStateTarget.entered_at
 */
export const getTnaFlagSeverity = (
  targetDate: string | Date | null | undefined,
  enteredAt: string | Date | null | undefined
): TTnaFlagSeverity | null => {
  if (!targetDate || enteredAt) return null;

  const parsedTarget = getDate(targetDate);
  if (!parsedTarget) return null;

  const daysDiff = differenceInCalendarDays(new Date(), parsedTarget);

  if (daysDiff >= 10) return "red";
  if (daysDiff > 0) return "orange";
  if (daysDiff >= -10) return "yellow";
  return null;
};
