"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateTagApiV1TagsPost } from "@/api/generated/tags/tags";
import { TagForm } from "@/components/tags/TagForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";

export default function NewTagPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const { t } = useTranslation();

  const createMutation = useCreateTagApiV1TagsPost<ApiError>({
    mutation: {
      retry: false,
    },
  });

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("tags.signInCreate"),
        forceRedirectUrl: "/tags/add",
        signUpForceRedirectUrl: "/tags/add",
      }}
      title={t("tags.createTitle")}
      description={t("tags.createDesc")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("tags.adminOnly")}
    >
      <TagForm
        isSubmitting={createMutation.isPending}
        submitLabel={t("tags.createTitle")}
        submittingLabel={t("tags.creating")}
        onCancel={() => router.push("/tags")}
        onSubmit={async (values) => {
          const result = await createMutation.mutateAsync({
            data: values,
          });
          if (result.status !== 200) {
            throw new Error("Unable to create tag.");
          }
          router.push("/tags");
        }}
      />
    </DashboardPageLayout>
  );
}
