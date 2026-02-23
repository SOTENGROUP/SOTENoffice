"use client";

import { useTranslation } from "@/lib/i18n";

type GatewayMetrics = {
  cpu_pct?: number | null;
  memory_mb?: number | null;
  active_sessions?: number | null;
  agent_count?: number | null;
  status: string;
  last_heartbeat_at?: string | null;
  gateway_version?: string | null;
  gateway_ip?: string | null;
};

type MetricItemProps = {
  label: string;
  value: string | number;
  unit?: string;
};

function MetricItem({ label, value, unit }: MetricItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-slate-500">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

type GatewayMetricsCardProps = {
  metrics: GatewayMetrics | null;
  isLoading?: boolean;
};

export function GatewayMetricsCard({
  metrics,
  isLoading,
}: GatewayMetricsCardProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{t("gatewayHealth.noMetrics")}</p>
      </div>
    );
  }

  const cpu =
    metrics.cpu_pct != null ? `${metrics.cpu_pct.toFixed(1)}` : "—";
  const memory =
    metrics.memory_mb != null ? `${Math.round(metrics.memory_mb)}` : "—";
  const sessions = metrics.active_sessions != null ? metrics.active_sessions : "—";
  const agents = metrics.agent_count != null ? metrics.agent_count : "—";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("gatewayHealth.metrics")}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricItem
          label={t("gatewayHealth.cpu")}
          value={cpu}
          unit={cpu !== "—" ? "%" : undefined}
        />
        <MetricItem
          label={t("gatewayHealth.memory")}
          value={memory}
          unit={memory !== "—" ? "MB" : undefined}
        />
        <MetricItem
          label={t("gatewayHealth.activeSessions")}
          value={sessions}
        />
        <MetricItem
          label={t("gatewayHealth.agentCount")}
          value={agents}
        />
      </div>
      {(metrics.gateway_ip || metrics.gateway_version) ? (
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          {metrics.gateway_ip ? (
            <span>
              {t("gatewayHealth.ip")}: <strong>{metrics.gateway_ip}</strong>
            </span>
          ) : null}
          {metrics.gateway_version ? (
            <span>
              {t("gatewayHealth.version")}:{" "}
              <strong>{metrics.gateway_version}</strong>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
