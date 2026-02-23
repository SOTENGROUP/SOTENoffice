"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { GatewayConnectionsPanel } from "@/components/gateways/GatewayConnectionsPanel";
import { GatewayHealthBadge } from "@/components/gateways/GatewayHealthBadge";
import { GatewayMetricsCard } from "@/components/gateways/GatewayMetricsCard";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";
import { customFetch } from "@/api/mutator";
import {
  useGetGatewayApiV1GatewaysGatewayIdGet,
  type getGatewayApiV1GatewaysGatewayIdGetResponse,
} from "@/api/generated/gateways/gateways";
import { ApiError } from "@/api/mutator";

type GatewayConnectionsData = {
  gateway_id: string;
  is_connected: boolean;
  active_connections: number;
};

type GatewayMetricsData = {
  cpu_pct: number | null;
  memory_mb: number | null;
  active_sessions: number | null;
  agent_count: number | null;
  status: string;
  last_heartbeat_at: string | null;
  gateway_version: string | null;
  gateway_ip: string | null;
};

export default function GatewayConnectionsPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const gatewayIdParam = params?.gatewayId;
  const gatewayId = Array.isArray(gatewayIdParam)
    ? gatewayIdParam[0]
    : gatewayIdParam;

  const gatewayQuery = useGetGatewayApiV1GatewaysGatewayIdGet<
    getGatewayApiV1GatewaysGatewayIdGetResponse,
    ApiError
  >(gatewayId ?? "", {
    query: {
      enabled: Boolean(isSignedIn && isAdmin && gatewayId),
      refetchInterval: 30_000,
    },
  });

  const gateway =
    gatewayQuery.data?.status === 200 ? gatewayQuery.data.data : null;

  const connectionsQuery = useQuery<GatewayConnectionsData>({
    queryKey: ["gateway-connections", gatewayId],
    queryFn: async () => {
      const res = await customFetch<{ data: GatewayConnectionsData; status: number }>(
        `/api/v1/gateways/${gatewayId}/connections`,
        { method: "GET" },
      );
      return res.data;
    },
    enabled: Boolean(isSignedIn && isAdmin && gatewayId),
    refetchInterval: 10_000,
  });

  const metricsQuery = useQuery<GatewayMetricsData>({
    queryKey: ["gateway-metrics", gatewayId],
    queryFn: async () => {
      const res = await customFetch<{ data: GatewayMetricsData; status: number }>(
        `/api/v1/gateways/${gatewayId}/metrics`,
        { method: "GET" },
      );
      return res.data;
    },
    enabled: Boolean(isSignedIn && isAdmin && gatewayId),
    refetchInterval: 15_000,
  });

  const gatewayStatus = gateway
    ? (metricsQuery.data?.status ?? "pending")
    : "pending";

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("gateways.signInView"),
        forceRedirectUrl: `/gateways/${gatewayId}/connections`,
      }}
      title={
        gateway?.name
          ? `${gateway.name} — ${t("gatewayHealth.connections")}`
          : t("gatewayHealth.connections")
      }
      description={t("gatewayHealth.connectionsDesc")}
      headerActions={
        <div className="flex items-center gap-2">
          {gateway ? <GatewayHealthBadge status={gatewayStatus} /> : null}
          <Button
            variant="outline"
            onClick={() => router.push(`/gateways/${gatewayId}`)}
          >
            {t("gateways.backToGateways")}
          </Button>
        </div>
      }
      isAdmin={isAdmin}
      adminOnlyMessage={t("gateways.adminOnly")}
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <GatewayConnectionsPanel
            connections={connectionsQuery.data ?? null}
            isLoading={connectionsQuery.isLoading}
            gatewayName={gateway?.name}
          />
          <GatewayMetricsCard
            metrics={metricsQuery.data ?? null}
            isLoading={metricsQuery.isLoading}
          />
        </div>
      </div>
    </DashboardPageLayout>
  );
}
