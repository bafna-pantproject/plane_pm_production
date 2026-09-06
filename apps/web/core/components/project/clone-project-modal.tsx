/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ChangeEvent } from "react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { InfoIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Tooltip } from "@plane/propel/tooltip";
import type { TProject } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
import { cn, projectIdentifierSanitizer } from "@plane/utils";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  isOpen: boolean;
  project: TProject;
  workspaceSlug: string;
  onClose: () => void;
};

type TFormValues = {
  name: string;
  identifier: string;
};

export function CloneProjectModal(props: Props) {
  const { isOpen, project, workspaceSlug, onClose } = props;
  // store hooks
  const { cloneProject } = useProject();
  // router
  const router = useAppRouter();
  // translation
  const { t } = useTranslation();
  // form info
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<TFormValues>({
    defaultValues: { name: "", identifier: "" },
  });

  useEffect(() => {
    if (isOpen && project) {
      const copyName = `${project.name} (Copy)`;
      reset({
        name: copyName,
        identifier: projectIdentifierSanitizer(copyName).substring(0, 10),
      });
    }
  }, [isOpen, project, reset]);

  const handleClose = () => {
    onClose();
    setTimeout(() => reset(), 300);
  };

  const handleNameChange =
    (onChange: (event: ChangeEvent<HTMLInputElement>) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      setValue("identifier", projectIdentifierSanitizer(e.target.value).substring(0, 10));
      onChange(e);
    };

  const handleIdentifierChange = (onChange: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    onChange(projectIdentifierSanitizer(e.target.value));
  };

  const onSubmit = async (formData: TFormValues) => {
    try {
      const clonedProject = await cloneProject(workspaceSlug, project.id, {
        name: formData.name,
        identifier: formData.identifier.toUpperCase(),
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: t("project_cloned_successfully"),
      });
      handleClose();
      router.push(`/${workspaceSlug}/projects/${clonedProject.id}/issues`);
    } catch (error: any) {
      const errorData = error?.data ?? {};
      if (errorData?.name?.includes("PROJECT_NAME_ALREADY_EXIST")) {
        setError("name", { message: t("project_name_already_taken") });
      } else if (errorData?.identifier?.includes("PROJECT_IDENTIFIER_ALREADY_EXIST")) {
        setError("identifier", { message: t("project_identifier_already_taken") });
      } else if (errorData?.name?.includes("PROJECT_NAME_CANNOT_CONTAIN_SPECIAL_CHARACTERS")) {
        setError("name", { message: t("project_name_cannot_contain_special_characters") });
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("toast.error"),
          message: t("something_went_wrong"),
        });
      }
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-6">
        <h3 className="text-18 font-medium 2xl:text-20">{t("clone_project")}</h3>
        <p className="text-13 leading-6 text-secondary">
          {t("clone_project_modal_description", { name: project?.name })}
        </p>
        <div>
          <Controller
            control={control}
            name="name"
            rules={{
              required: t("name_is_required"),
              maxLength: { value: 255, message: t("title_should_be_less_than_255_characters") },
            }}
            render={({ field: { value, onChange } }) => (
              <Input
                id="clone-project-name"
                name="name"
                type="text"
                value={value}
                onChange={handleNameChange(onChange)}
                hasError={Boolean(errors.name)}
                placeholder={t("project_name")}
                className="w-full"
                autoComplete="off"
                autoFocus
              />
            )}
          />
          <span className="text-11 text-danger-primary">{errors?.name?.message}</span>
        </div>
        <div className="relative">
          <Controller
            control={control}
            name="identifier"
            rules={{
              required: t("project_id_is_required"),
              validate: (value) =>
                /^[ÇŞĞIİÖÜA-Z0-9]+$/.test(value.toUpperCase()) || t("only_alphanumeric_non_latin_characters_allowed"),
              minLength: { value: 1, message: t("project_id_min_char") },
              maxLength: { value: 10, message: t("project_id_max_char") },
            }}
            render={({ field: { value, onChange } }) => (
              <Input
                id="clone-project-identifier"
                name="identifier"
                type="text"
                value={value}
                onChange={handleIdentifierChange(onChange)}
                hasError={Boolean(errors.identifier)}
                placeholder={t("project_id")}
                className={cn("w-full pr-7 text-11", { uppercase: value })}
                autoComplete="off"
              />
            )}
          />
          <Tooltip tooltipContent={t("project_id_tooltip_content")} className="text-13" position="right-start">
            <InfoIcon className="absolute top-2.5 right-2 h-3 w-3 text-placeholder" />
          </Tooltip>
          <span className="text-11 text-danger-primary">{errors?.identifier?.message}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="lg" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="lg" type="submit" loading={isSubmitting}>
            {isSubmitting ? t("cloning_project") : t("clone_project")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
