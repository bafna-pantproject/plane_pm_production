/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext } from "react";
// mobx store
import { StoreContext } from "@/lib/store-context";
// types
import type { IStyleStore } from "@/store/style.store";

export const useStyle = (): IStyleStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useStyle must be used within StoreProvider");
  return context.style;
};
