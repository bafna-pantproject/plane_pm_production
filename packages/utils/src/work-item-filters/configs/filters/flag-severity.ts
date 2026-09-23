/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TTnaFlagSeverity } from "@plane/constants";
import { TNA_FLAG_SEVERITIES } from "@plane/constants";
import type { TFilterProperty, TSupportedOperators } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

// ------------ Next-stage TNA flag severity filter ------------

/**
 * Flag severity filter specific params
 */
export type TCreateFlagSeverityFilterParams = TCreateFilterConfigParams & IFilterIconConfig<TTnaFlagSeverity>;

/**
 * Helper to get the flag severity multi select config
 * @param params - The filter params
 * @returns The flag severity multi select config
 */
export const getFlagSeverityMultiSelectConfig = (
  params: TCreateFlagSeverityFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<{ key: TTnaFlagSeverity; title: string }, TTnaFlagSeverity, TTnaFlagSeverity>(
    {
      items: TNA_FLAG_SEVERITIES,
      getId: (severity) => severity.key,
      getLabel: (severity) => severity.title,
      getValue: (severity) => severity.key,
      getIconData: (severity) => severity.key,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      getOptionIcon: params.getOptionIcon,
    }
  );

/**
 * Get the flag severity filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the flag severity filter config
 */
export const getFlagSeverityFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateFlagSeverityFilterParams> =>
  (params: TCreateFlagSeverityFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "Flag",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getFlagSeverityMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
