/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TVendor, TFilterProperty, TSupportedOperators } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/**
 * Vendor filter specific params
 */
export type TCreateVendorFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<string> & {
    vendors: TVendor[];
  };

/**
 * Helper to get the vendor multi select config
 * @param params - The filter params
 * @returns The vendor multi select config
 */
export const getVendorMultiSelectConfig = (
  params: TCreateVendorFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<TVendor, string, string>(
    {
      items: params.vendors,
      getId: (vendor) => vendor.id,
      getLabel: (vendor) => vendor.name,
      getValue: (vendor) => vendor.id,
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
 * Get the vendor filter config
 * @template K - The filter key
 * @param key - The filter key to use
 * @returns A function that takes parameters and returns the vendor filter config
 */
export const getVendorFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateVendorFilterParams> =>
  (params: TCreateVendorFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: "Vendor",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getVendorMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
