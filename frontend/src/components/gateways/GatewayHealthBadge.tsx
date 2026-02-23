"use client";

import { useTranslation } from "@/lib/i18n";

type GatewayStatus = "online" | "pending" | "offline" | "error";

type GatewayHealthBadgeProps = {
  status: GatewayStatus | string;
  size?: "sm" | "md";
};

const STATUS_CONFIG: Record<
  GatewayStatus,
  { dot: string; bg: string; text: string; labelKey: string }
> = {
  online: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    labelKey: "gatewayHealth.online",
  },
  pending: {
    dot: "bg-amber-400",
    bg: "bg-amber-50",
    text: "text-amber-700",
    labelKey: "gatewayHealth.pending",
  },
  offline: {
    dot: "bg-slate-400",
    bg: "bg-slate-100",
    text: "text-slate-600",
    labelKey: "gatewayHealth.offline",
  },
  error: {
    dot: "bg-rose-500",
    bg: "bg-rose-50",
    text: "text-rose-700",
    labelKey: "gatewayHealth.error",
  },
};

function resolveStatus(status: string): GatewayStatus {
  if (status === "online") return "online";
  if (status === "pending") return "pending";
  if (status === "error") return "error";
  return "offline";
}

export function GatewayHealthBadge({
  status,
  size = "md",
}: GatewayHealthBadgeProps) {
  const { t } = useTranslation();
  const resolved = resolveStatus(status);
  const config = STATUS_CONFIG[resolved];

  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const textSize = size === "sm" ? "text-xs" : "text-xs font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${config.bg} ${config.text} ${textSize}`}
    >
      <span className={`rounded-full ${dotSize} ${config.dot}`} />
      {t(config.labelKey)}
    </span>
  );
}
