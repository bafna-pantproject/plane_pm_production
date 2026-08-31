/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
// mobx store
import { StoreContext } from "@/lib/store-context";
// types
import type { IVendorStore } from "@/store/vendor.store";

export const useVendor = (): IVendorStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useVendor must be used within StoreProvider");
  return context.vendor;
};
