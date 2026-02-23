"use client";

import { useTranslation } from "@/lib/i18n";
import { GatewayHealthBadge } from "./GatewayHealthBadge";

type GatewayConnectionsData = {
  gateway_id: string;
  is_connected: boolean;
  active_connections: number;
};

type GatewayConnectionsPanelProps = {
  connections: GatewayConnectionsData | null;
  isLoading?: boolean;
  gatewayName?: string;
};

export function GatewayConnectionsPanel({
  connections,
  isLoading,
  gatewayName,
}: GatewayConnectionsPanelProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      </div>
    );
  }

  const isConnected = connections?.is_connected ?? false;
  const count = connections?.active_connections ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("gatewayHealth.liveConnections")}
        </p>
        <GatewayHealthBadge status={isConnected ? "online" : "offline"} />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {gatewayName ?? t("gatewayHealth.gateway")}
            </p>
            <p className="text-xs text-slate-500">
              {isConnected
                ? t("gatewayHealth.wsConnected")
                : t("gatewayHealth.wsDisconnected")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{count}</p>
            <p className="text-xs text-slate-400">
              {t("gatewayHealth.connections")}
            </p>
          </div>
        </div>
      </div>
      {!isConnected ? (
        <p className="mt-3 text-xs text-slate-400">
          {t("gatewayHealth.noActiveConnections")}
        </p>
      ) : null}
    </div>
  );
}
