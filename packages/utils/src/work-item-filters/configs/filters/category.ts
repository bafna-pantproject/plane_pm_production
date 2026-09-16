/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TFilterProperty, TSupportedOperators } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/**
 * Category filter specific params. Category is free text with no catalog of its own,
 * so the list of selectable options is the set of distinct values already in use.
 */
export type TCreateCategoryFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<string> & {
    categories: string[];
  };

/**
 * Helper to get the category multi select config
 * @param params - The filter params
 * @returns The category multi select config
 */
export const getCategoryMultiSelectConfig = (
  params: TCreateCategoryFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<string, string, string>(
    {
      items: params.categories,
      getId: (category) => category,
      getLabel: (category) => category,
      getValue: (category) => category,
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
 * Get the category filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the category filter config
 */
export const getCategoryFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateCategoryFilterParams> =>
  (params: TCreateCategoryFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "Category",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getCategoryMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
