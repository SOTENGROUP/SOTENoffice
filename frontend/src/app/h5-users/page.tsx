"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { H5UserTable, type H5UserRow } from "@/components/h5-users/H5UserTable";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";
import { customFetch } from "@/api/mutator";

type H5UsersPage = {
  items: H5UserRow[];
  total: number;
  limit: number;
  offset: number;
};

export default function H5UsersPage() {
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const usersQuery = useQuery<H5UsersPage>({
    queryKey: ["h5-users"],
    queryFn: async () => {
      const res = await customFetch<{ data: H5UsersPage; status: number }>(
        "/api/v1/h5/users?limit=100&offset=0",
        { method: "GET" },
      );
      return res.data;
    },
    enabled: Boolean(isSignedIn && isAdmin),
    refetchInterval: 30_000,
    refetchOnMount: "always",
  });

  const users = usersQuery.data?.items ?? [];

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("h5Users.signInPrompt"),
        forceRedirectUrl: "/h5-users",
      }}
      title={t("h5Users.title")}
      description={t("h5Users.description")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("h5Users.adminOnly")}
      stickyHeader
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <H5UserTable
          users={users}
          isLoading={usersQuery.isLoading}
          stickyHeader
          emptyState={{
            title: t("h5Users.noUsers"),
            description: t("h5Users.noUsersDesc"),
          }}
        />
      </div>

      {usersQuery.error ? (
        <p className="mt-4 text-sm text-red-500">
          {(usersQuery.error as Error).message}
        </p>
      ) : null}
    </DashboardPageLayout>
  );
}
