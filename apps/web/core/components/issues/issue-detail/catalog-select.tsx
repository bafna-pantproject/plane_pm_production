/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { KeyboardEvent } from "react";
import { useState } from "react";
import { Loader } from "lucide-react";
import { observer } from "mobx-react";
// ui
import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSearchSelect, Input } from "@plane/ui";

type TCatalogOption = { id: string; label: string };

type Props = {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: TCatalogOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  /** When provided, shows a "create new" row so the item can be added without leaving the dropdown. */
  onCreate?: (name: string) => Promise<{ id: string }>;
};

export const CatalogSelect = observer(function CatalogSelect(props: Props) {
  const { value, onChange, options, placeholder, disabled, className, onCreate } = props;
  const { t } = useTranslation();
  const [newItemName, setNewItemName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedOption = options.find((option) => option.id === value);

  const searchOptions = [
    { value: null, query: t("common.none"), content: <span className="text-placeholder">{t("common.none")}</span> },
    ...options.map((option) => ({
      value: option.id,
      query: option.label,
      content: <span className="truncate">{option.label}</span>,
    })),
  ];

  const handleCreate = async () => {
    if (!onCreate || !newItemName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const created = await onCreate(newItemName.trim());
      setNewItemName("");
      onChange(created.id);
    } catch (error: any) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("toast.error"),
        message: error?.name?.[0] ?? error?.detail ?? "Something went wrong",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreate();
    }
  };

  return (
    <CustomSearchSelect
      value={value ?? null}
      onChange={onChange}
      options={searchOptions}
      label={
        selectedOption ? (
          <span className="truncate">{selectedOption.label}</span>
        ) : (
          <span className="text-placeholder">{placeholder}</span>
        )
      }
      buttonClassName="text-body-xs-regular w-full text-left h-7.5"
      className={className}
      disabled={disabled}
      footerOption={
        onCreate ? (
          <div className="flex items-center gap-1 border-t border-subtle p-1">
            <Input
              type="text"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("common.type_to_create")}
              className="w-full px-1.5 py-1 text-11"
              disabled={isCreating}
            />
            <button
              type="button"
              className="grid flex-shrink-0 place-items-center rounded-sm bg-success-primary p-1 disabled:opacity-50"
              onClick={handleCreate}
              disabled={isCreating || !newItemName.trim()}
            >
              {isCreating ? (
                <Loader className="spin h-3.5 w-3.5 text-on-color" />
              ) : (
                <PlusIcon className="h-3.5 w-3.5 text-on-color" />
              )}
            </button>
          </div>
        ) : undefined
      }
    />
  );
});
