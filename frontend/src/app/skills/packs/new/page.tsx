"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateSkillPackApiV1SkillsPacksPost } from "@/api/generated/skills/skills";
import { MarketplaceSkillForm } from "@/components/skills/MarketplaceSkillForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";

export default function NewSkillPackPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);
  const { t } = useTranslation();

  const createMutation = useCreateSkillPackApiV1SkillsPacksPost<ApiError>();

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("skills.signInPacks"),
        forceRedirectUrl: "/skills/packs/new",
      }}
      title={t("skills.addPack")}
      description={t("skills.addPackDesc")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("skills.packAdminOnly")}
      stickyHeader
    >
      <MarketplaceSkillForm
        sourceLabel={t("skills.packUrl")}
        nameLabel={t("skills.packName")}
        descriptionLabel={t("skills.packDescription")}
        descriptionPlaceholder={t("skills.packDescPlaceholder")}
        branchLabel={t("skills.packBranch")}
        branchPlaceholder={t("skills.packBranchPlaceholder")}
        showBranch
        requiredUrlMessage={t("skills.packUrlRequired")}
        invalidUrlMessage="Pack URL must be a GitHub repository URL (https://github.com/<owner>/<repo>)."
        submitLabel={t("skills.addPackButton")}
        submittingLabel={t("skills.addingPack")}
        isSubmitting={createMutation.isPending}
        onCancel={() => router.push("/skills/packs")}
        onSubmit={async (values) => {
          const result = await createMutation.mutateAsync({
            data: {
              source_url: values.sourceUrl,
              name: values.name || undefined,
              description: values.description || undefined,
              branch: values.branch || "main",
              metadata: {},
            },
          });
          if (result.status !== 200) {
            throw new Error("Unable to add pack.");
          }
          router.push("/skills/packs");
        }}
      />
    </DashboardPageLayout>
  );
}
