/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Building2, CalendarCheck2, CalendarClock, Receipt, Tag } from "lucide-react";
import { observer } from "mobx-react";
import { useEffect } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
// ui
import {
  CycleIcon,
  StatePropertyIcon,
  ModuleIcon,
  MembersPropertyIcon,
  PriorityPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
  LabelPropertyIcon,
  UserCirclePropertyIcon,
  EstimatePropertyIcon,
  ParentPropertyIcon,
} from "@plane/propel/icons";
import {
  cn,
  composeOrderDetailName,
  getDate,
  renderFormattedDate,
  renderFormattedPayloadDate,
  shouldHighlightIssueDueDate,
} from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { ButtonAvatars } from "@/components/dropdowns/member/avatar";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useOrderDetail } from "@/hooks/store/use-order-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { usePurchaseOrder } from "@/hooks/store/use-purchase-order";
import { useTaskStateTarget } from "@/hooks/store/use-task-state-target";
import { useStyle } from "@/hooks/store/use-style";
import { useVendor } from "@/hooks/store/use-vendor";
// components
import { IssueParentSelectRoot } from "@/components/issues/parent-select-root";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { CatalogSelect } from "./catalog-select";
import { IssueCycleSelect } from "./cycle-select";
import { IssueLabel } from "./label";
import { IssueModuleSelect } from "./module-select";
import type { TIssueOperations } from "./root";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  issueOperations: TIssueOperations;
  isEditable: boolean;
};

export const IssueDetailsSidebar = observer(function IssueDetailsSidebar(props: Props) {
  const { t } = useTranslation();
  const { workspaceSlug, projectId, issueId, issueOperations, isEditable } = props;
  // store hooks
  const { getProjectById } = useProject();
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getUserDetails } = useMember();
  const { getStateById, getProjectStates } = useProjectState();
  const { workspaceVendors, createVendor, getVendorById } = useVendor();
  const { workspaceStyles, createStyle } = useStyle();
  const { workspacePurchaseOrders, createPurchaseOrder } = usePurchaseOrder();
  const { getOrderDetailByIssueId, fetchIssueOrderDetail, updateIssueOrderDetail } = useOrderDetail();
  const { getIssueStateTargets, fetchIssueStateTargets, setIssueStateTarget } = useTaskStateTarget();
  const orderDetail = getOrderDetailByIssueId(issueId);
  const stateTargets = getIssueStateTargets(issueId);
  const projectStates = getProjectStates(projectId);

  // the project-wide bulk fetch (project-wrapper.tsx) may not have completed yet when the
  // sidebar first mounts, so backstop it with a fetch scoped to just this issue.
  useEffect(() => {
    if (!orderDetail) fetchIssueOrderDetail(workspaceSlug, projectId, issueId);
    if (!stateTargets) fetchIssueStateTargets(workspaceSlug, projectId, issueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceSlug, projectId, issueId]);

  const issue = getIssueById(issueId);
  if (!issue) return <></>;

  const createdByDetails = getUserDetails(issue.created_by);

  // derived values
  const projectDetails = getProjectById(issue.project_id);
  const stateDetails = getStateById(issue.state_id);
  const updateOrderDetail = (data: Parameters<typeof updateIssueOrderDetail>[3]) =>
    updateIssueOrderDetail(workspaceSlug, projectId, issueId, data);

  // work items that use category/vendor/quantity display that composite as their name
  // wherever the app just shows the plain title (kanban/list/calendar boards); keep it in
  // sync when vendor changes here too, not just from the create/edit modal.
  const handleVendorChange = (vendorId: string | null) => {
    updateOrderDetail({ vendor: vendorId });
    if (!orderDetail?.category) return;
    const vendorName = vendorId ? getVendorById(vendorId)?.name : undefined;
    const derivedName = composeOrderDetailName(orderDetail.category, vendorName, orderDetail.quantity);
    if (derivedName) issueOperations.update(workspaceSlug, projectId, issueId, { name: derivedName });
  };

  const minDate = issue.start_date ? getDate(issue.start_date) : null;
  minDate?.setDate(minDate.getDate());

  const maxDate = issue.target_date ? getDate(issue.target_date) : null;
  maxDate?.setDate(maxDate.getDate());

  return (
    <>
      <div className="flex h-full w-full flex-col items-center divide-y-2 divide-subtle-1 overflow-hidden">
        <div className="h-full w-full overflow-y-auto px-6">
          <h5 className="mt-5 text-body-xs-medium">{t("common.properties")}</h5>
          <div className={`mt-4 mb-2 space-y-2.5 truncate ${!isEditable ? "opacity-60" : ""}`}>
            <SidebarPropertyListItem icon={StatePropertyIcon} label={t("common.state")}>
              <StateDropdown
                value={issue?.state_id}
                onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { state_id: val })}
                projectId={projectId?.toString() ?? ""}
                disabled={!isEditable}
                buttonVariant="transparent-with-text"
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName="text-body-xs-regular"
                dropdownArrow
                dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={MembersPropertyIcon} label={t("common.assignees")}>
              <MemberDropdown
                value={issue?.assignee_ids ?? undefined}
                onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { assignee_ids: val })}
                disabled={!isEditable}
                projectId={projectId?.toString() ?? ""}
                placeholder={t("issue.add.assignee")}
                multiple
                buttonVariant={issue?.assignee_ids?.length > 1 ? "transparent-without-text" : "transparent-with-text"}
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName={`text-body-xs-regular justify-between ${issue?.assignee_ids?.length > 0 ? "" : "text-placeholder"}`}
                hideIcon={issue.assignee_ids?.length === 0}
                dropdownArrow
                dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={PriorityPropertyIcon} label={t("common.priority")}>
              <PriorityDropdown
                value={issue?.priority}
                onChange={(val) => issueOperations.update(workspaceSlug, projectId, issueId, { priority: val })}
                disabled={!isEditable}
                buttonVariant="transparent-with-text"
                className="h-7.5 w-full grow rounded-sm"
                buttonContainerClassName="size-full text-left"
                buttonClassName="size-full px-2 py-0.5 whitespace-nowrap [&_svg]:size-3.5"
              />
            </SidebarPropertyListItem>

            {createdByDetails && (
              <SidebarPropertyListItem icon={UserCirclePropertyIcon} label={t("common.created_by")}>
                <div className="flex gap-2 px-2">
                  <ButtonAvatars showTooltip userIds={createdByDetails.id} />
                  <span className="grow truncate text-body-xs-regular leading-5">{createdByDetails?.display_name}</span>
                </div>
              </SidebarPropertyListItem>
            )}

            <SidebarPropertyListItem icon={StartDatePropertyIcon} label={t("common.order_by.start_date")}>
              <DateDropdown
                placeholder={t("issue.add.start_date")}
                value={issue.start_date}
                onChange={(val) =>
                  issueOperations.update(workspaceSlug, projectId, issueId, {
                    start_date: val ? renderFormattedPayloadDate(val) : null,
                  })
                }
                maxDate={maxDate ?? undefined}
                disabled={!isEditable}
                buttonVariant="transparent-with-text"
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName={`text-body-xs-regular ${issue?.start_date ? "" : "text-placeholder"}`}
                hideIcon
                clearIconClassName="h-3 w-3 hidden group-hover:inline"
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={DueDatePropertyIcon} label={t("common.order_by.due_date")}>
              <div className="flex w-full items-center gap-2">
                <DateDropdown
                  placeholder={t("issue.add.due_date")}
                  value={issue.target_date}
                  onChange={(val) =>
                    issueOperations.update(workspaceSlug, projectId, issueId, {
                      target_date: val ? renderFormattedPayloadDate(val) : null,
                    })
                  }
                  minDate={minDate ?? undefined}
                  disabled={!isEditable}
                  buttonVariant="transparent-with-text"
                  className="group w-full grow"
                  buttonContainerClassName="w-full text-left h-7.5"
                  buttonClassName={cn("text-body-xs-regular", {
                    "text-placeholder": !issue.target_date,
                    "text-danger-primary": shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group),
                  })}
                  hideIcon
                  clearIconClassName="h-3 w-3 hidden group-hover:inline text-primary"
                />
              </div>
            </SidebarPropertyListItem>

            {projectId && areEstimateEnabledByProjectId(projectId) && (
              <SidebarPropertyListItem icon={EstimatePropertyIcon} label={t("common.estimate")}>
                <EstimateDropdown
                  value={issue?.estimate_point ?? undefined}
                  onChange={(val: string | undefined) =>
                    issueOperations.update(workspaceSlug, projectId, issueId, { estimate_point: val })
                  }
                  projectId={projectId}
                  disabled={!isEditable}
                  buttonVariant="transparent-with-text"
                  className="group w-full grow"
                  buttonContainerClassName="w-full text-left h-7.5"
                  buttonClassName={`text-body-xs-regular ${issue?.estimate_point !== null ? "" : "text-placeholder"}`}
                  placeholder={t("common.none")}
                  hideIcon
                  dropdownArrow
                  dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
                />
              </SidebarPropertyListItem>
            )}

            {projectDetails?.module_view && (
              <SidebarPropertyListItem icon={ModuleIcon} label={t("common.modules")}>
                <IssueModuleSelect
                  className="w-full grow"
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  issueOperations={issueOperations}
                  disabled={!isEditable}
                />
              </SidebarPropertyListItem>
            )}

            {projectDetails?.cycle_view && (
              <SidebarPropertyListItem icon={CycleIcon} label={t("common.cycle")} appendElement={null}>
                <IssueCycleSelect
                  className="h-7.5 w-full grow"
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  issueId={issueId}
                  issueOperations={issueOperations}
                  disabled={!isEditable}
                />
              </SidebarPropertyListItem>
            )}

            <SidebarPropertyListItem icon={ParentPropertyIcon} label={t("common.parent")}>
              <IssueParentSelectRoot
                className="h-7.5 w-full grow"
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={issueId}
                issueOperations={issueOperations}
                disabled={!isEditable}
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={LabelPropertyIcon} label={t("common.labels")}>
              <IssueLabel
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                issueId={issueId}
                disabled={!isEditable}
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={Building2} label={t("common.vendor")}>
              <CatalogSelect
                className="w-full grow"
                value={orderDetail?.vendor}
                onChange={handleVendorChange}
                options={(workspaceVendors ?? []).map((vendor) => ({ id: vendor.id, label: vendor.name }))}
                placeholder={t("common.vendor")}
                disabled={!isEditable}
                onCreate={isEditable ? (name) => createVendor(workspaceSlug, { name }) : undefined}
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={Tag} label={t("common.style")}>
              <CatalogSelect
                className="w-full grow"
                value={orderDetail?.style}
                onChange={(val) => updateOrderDetail({ style: val })}
                options={(workspaceStyles ?? []).map((style) => ({ id: style.id, label: style.name || style.code }))}
                placeholder={t("common.style")}
                disabled={!isEditable}
                onCreate={isEditable ? (name) => createStyle(workspaceSlug, { code: name, name }) : undefined}
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={Receipt} label={t("common.purchase_order")}>
              <CatalogSelect
                className="w-full grow"
                value={orderDetail?.purchase_order}
                onChange={(val) => updateOrderDetail({ purchase_order: val })}
                options={(workspacePurchaseOrders ?? []).map((po) => ({ id: po.id, label: po.po_number }))}
                placeholder={t("common.purchase_order")}
                disabled={!isEditable}
                // a PO must belong to a vendor, so quick-create is only offered once one is picked above
                onCreate={
                  isEditable && orderDetail?.vendor
                    ? (name) => createPurchaseOrder(workspaceSlug, { po_number: name, vendor: orderDetail.vendor! })
                    : undefined
                }
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={CalendarClock} label={t("common.requested_delivery_date")}>
              <DateDropdown
                placeholder={t("common.requested_delivery_date")}
                value={orderDetail?.requested_delivery_date ?? null}
                onChange={(val) =>
                  updateOrderDetail({ requested_delivery_date: val ? renderFormattedPayloadDate(val) : null })
                }
                disabled={!isEditable}
                buttonVariant="transparent-with-text"
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName={`text-body-xs-regular ${orderDetail?.requested_delivery_date ? "" : "text-placeholder"}`}
                hideIcon
                clearIconClassName="h-3 w-3 hidden group-hover:inline"
              />
            </SidebarPropertyListItem>

            <SidebarPropertyListItem icon={CalendarClock} label={t("common.vendor_promised_date")}>
              <DateDropdown
                placeholder={t("common.vendor_promised_date")}
                value={orderDetail?.vendor_promised_date ?? null}
                onChange={(val) =>
                  updateOrderDetail({ vendor_promised_date: val ? renderFormattedPayloadDate(val) : null })
                }
                disabled={!isEditable}
                buttonVariant="transparent-with-text"
                className="group w-full grow"
                buttonContainerClassName="w-full text-left h-7.5"
                buttonClassName={`text-body-xs-regular ${orderDetail?.vendor_promised_date ? "" : "text-placeholder"}`}
                hideIcon
                clearIconClassName="h-3 w-3 hidden group-hover:inline"
              />
            </SidebarPropertyListItem>
          </div>

          <h5 className="mt-5 text-body-xs-medium">{t("common.state_targets")}</h5>
          <div className={`mt-4 mb-2 space-y-2.5 truncate ${!isEditable ? "opacity-60" : ""}`}>
            {(projectStates ?? []).map((state) => {
              const stateTarget = stateTargets?.find((target) => target.state === state.id);
              return (
                <SidebarPropertyListItem key={state.id} icon={CalendarCheck2} label={state.name}>
                  <DateDropdown
                    placeholder={t("common.target_date")}
                    value={stateTarget?.target_date ?? null}
                    onChange={(val) =>
                      setIssueStateTarget(
                        workspaceSlug,
                        projectId,
                        issueId,
                        state.id,
                        val ? renderFormattedPayloadDate(val) : null
                      )
                    }
                    disabled={!isEditable}
                    buttonVariant="transparent-with-text"
                    className="group w-full grow"
                    buttonContainerClassName="w-full text-left h-7.5"
                    buttonClassName={`text-body-xs-regular ${stateTarget?.target_date ? "" : "text-placeholder"}`}
                    hideIcon
                    clearIconClassName="h-3 w-3 hidden group-hover:inline"
                  />
                  <span className="shrink-0 px-2 text-body-xs-regular text-tertiary">
                    {stateTarget?.entered_at
                      ? `${t("common.entered_at")}: ${renderFormattedDate(stateTarget.entered_at)}`
                      : ""}
                  </span>
                </SidebarPropertyListItem>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
});
