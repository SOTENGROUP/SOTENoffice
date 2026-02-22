"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/mutator";
import {
  type listBoardsApiV1BoardsGetResponse,
  useListBoardsApiV1BoardsGet,
} from "@/api/generated/boards/boards";
import {
  type listOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetResponse,
  getListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetQueryKey,
  useListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGet,
  useUpdateOrgCustomFieldApiV1OrganizationsMeCustomFieldsTaskCustomFieldDefinitionIdPatch,
} from "@/api/generated/org-custom-fields/org-custom-fields";
import type { TaskCustomFieldDefinitionUpdate } from "@/api/generated/model";
import { CustomFieldForm } from "@/components/custom-fields/CustomFieldForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import {
  buildCustomFieldUpdatePayload,
  deriveFormStateFromCustomField,
  extractApiErrorMessage,
  type NormalizedCustomFieldFormValues,
} from "@/components/custom-fields/custom-field-form-utils";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";

export default function EditCustomFieldPage() {
  const router = useRouter();
  const params = useParams();
  const fieldIdParam = params?.fieldId;
  const fieldId = Array.isArray(fieldIdParam) ? fieldIdParam[0] : fieldIdParam;

  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const customFieldsQuery =
    useListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGet<
      listOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetResponse,
      ApiError
    >({
      query: {
        enabled: Boolean(isSignedIn && fieldId),
        refetchOnMount: "always",
      },
    });

  const field = useMemo(() => {
    if (!fieldId || customFieldsQuery.data?.status !== 200) return null;
    return (
      customFieldsQuery.data.data.find((item) => item.id === fieldId) ?? null
    );
  }, [customFieldsQuery.data, fieldId]);

  const boardsQuery = useListBoardsApiV1BoardsGet<
    listBoardsApiV1BoardsGetResponse,
    ApiError
  >(
    { limit: 200 },
    {
      query: {
        enabled: Boolean(isSignedIn),
        refetchOnMount: "always",
        retry: false,
      },
    },
  );

  const boards = useMemo(
    () =>
      boardsQuery.data?.status === 200
        ? (boardsQuery.data.data.items ?? [])
        : [],
    [boardsQuery.data],
  );

  const updateMutation =
    useUpdateOrgCustomFieldApiV1OrganizationsMeCustomFieldsTaskCustomFieldDefinitionIdPatch<ApiError>();
  const customFieldsKey =
    getListOrgCustomFieldsApiV1OrganizationsMeCustomFieldsGetQueryKey();

  const loadError = useMemo(() => {
    if (!fieldId) return t("customFields.missingId");
    if (customFieldsQuery.error) {
      return extractApiErrorMessage(
        customFieldsQuery.error,
        t("customFields.loadFailed"),
      );
    }
    if (!customFieldsQuery.isLoading && !field)
      return t("customFields.fieldNotFound");
    return null;
  }, [customFieldsQuery.error, customFieldsQuery.isLoading, field, fieldId, t]);

  const handleSubmit = async (values: NormalizedCustomFieldFormValues) => {
    if (!fieldId || !field) return;

    const updates: TaskCustomFieldDefinitionUpdate =
      buildCustomFieldUpdatePayload(field, values);
    if (Object.keys(updates).length === 0) {
      throw new Error(t("customFields.noChanges"));
    }

    await updateMutation.mutateAsync({
      taskCustomFieldDefinitionId: fieldId,
      data: updates,
    });
    await queryClient.invalidateQueries({ queryKey: customFieldsKey });
    router.push("/custom-fields");
  };

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("customFields.signInEdit"),
        forceRedirectUrl: "/custom-fields",
        signUpForceRedirectUrl: "/custom-fields",
      }}
      title={t("customFields.editTitle")}
      description={t("customFields.editDesc")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("customFields.adminOnly")}
      stickyHeader
    >
      {customFieldsQuery.isLoading ? (
        <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {t("customFields.loadingField")}
        </div>
      ) : null}
      {!customFieldsQuery.isLoading && loadError ? (
        <div className="max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          {loadError}
        </div>
      ) : null}
      {!customFieldsQuery.isLoading && !loadError && field ? (
        <CustomFieldForm
          key={field.id}
          mode="edit"
          initialFormState={deriveFormStateFromCustomField(field)}
          initialBoardIds={field.board_ids ?? []}
          boards={boards}
          boardsLoading={boardsQuery.isLoading}
          boardsError={boardsQuery.error?.message ?? null}
          isSubmitting={updateMutation.isPending}
          submitLabel={t("customFields.saveChanges")}
          submittingLabel={t("customFields.savingChanges")}
          submitErrorFallback="Failed to update custom field."
          onSubmit={handleSubmit}
        />
      ) : null}
    </DashboardPageLayout>
  );
}
