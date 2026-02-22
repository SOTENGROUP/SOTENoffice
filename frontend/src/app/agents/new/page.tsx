"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type listBoardsApiV1BoardsGetResponse,
  useListBoardsApiV1BoardsGet,
} from "@/api/generated/boards/boards";
import { useCreateAgentApiV1AgentsPost } from "@/api/generated/agents/agents";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import type { BoardRead } from "@/api/generated/model";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_IDENTITY_PROFILE } from "@/lib/agent-templates";
import { useTranslation } from "@/lib/i18n";

type IdentityProfile = {
  role: string;
  communication_style: string;
  emoji: string;
};

const EMOJI_BASE_OPTIONS = [
  { value: ":gear:", labelKey: "emojiGear" as const, glyph: "⚙️" },
  { value: ":sparkles:", labelKey: "emojiSparkles" as const, glyph: "✨" },
  { value: ":rocket:", labelKey: "emojiRocket" as const, glyph: "🚀" },
  { value: ":megaphone:", labelKey: "emojiMegaphone" as const, glyph: "📣" },
  { value: ":chart_with_upwards_trend:", labelKey: "emojiGrowth" as const, glyph: "📈" },
  { value: ":bulb:", labelKey: "emojiIdea" as const, glyph: "💡" },
  { value: ":wrench:", labelKey: "emojiBuilder" as const, glyph: "🔧" },
  { value: ":shield:", labelKey: "emojiShield" as const, glyph: "🛡️" },
  { value: ":memo:", labelKey: "emojiNotes" as const, glyph: "📝" },
  { value: ":brain:", labelKey: "emojiBrain" as const, glyph: "🧠" },
];

const getBoardOptions = (boards: BoardRead[]): SearchableSelectOption[] =>
  boards.map((board) => ({
    value: board.id,
    label: board.name,
  }));

const normalizeIdentityProfile = (
  profile: IdentityProfile,
): IdentityProfile | null => {
  const normalized: IdentityProfile = {
    role: profile.role.trim(),
    communication_style: profile.communication_style.trim(),
    emoji: profile.emoji.trim(),
  };
  const hasValue = Object.values(normalized).some((value) => value.length > 0);
  return hasValue ? normalized : null;
};

export default function NewAgentPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();

  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const [name, setName] = useState("");
  const [boardId, setBoardId] = useState<string>("");
  const [heartbeatEvery, setHeartbeatEvery] = useState("10m");
  const [identityProfile, setIdentityProfile] = useState<IdentityProfile>({
    ...DEFAULT_IDENTITY_PROFILE,
  });
  const [error, setError] = useState<string | null>(null);

  const boardsQuery = useListBoardsApiV1BoardsGet<
    listBoardsApiV1BoardsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchOnMount: "always",
    },
  });

  const createAgentMutation = useCreateAgentApiV1AgentsPost<ApiError>({
    mutation: {
      onSuccess: (result) => {
        if (result.status === 200) {
          router.push(`/agents/${result.data.id}`);
        }
      },
      onError: (err) => {
        setError(err.message || "Something went wrong.");
      },
    },
  });

  const boards =
    boardsQuery.data?.status === 200 ? (boardsQuery.data.data.items ?? []) : [];
  const displayBoardId = boardId || boards[0]?.id || "";
  const isLoading = boardsQuery.isLoading || createAgentMutation.isPending;
  const errorMessage = error ?? boardsQuery.error?.message ?? null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("agents.agentNameRequired"));
      return;
    }
    const resolvedBoardId = displayBoardId;
    if (!resolvedBoardId) {
      setError(t("agents.selectBoardRequired"));
      return;
    }
    setError(null);
    createAgentMutation.mutate({
      data: {
        name: trimmed,
        board_id: resolvedBoardId,
        heartbeat_config: {
          every: heartbeatEvery.trim() || "10m",
          target: "last",
          includeReasoning: false,
        },
        identity_profile: normalizeIdentityProfile(
          identityProfile,
        ) as unknown as Record<string, unknown> | null,
      },
    });
  };

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("agents.signInCreate"),
        forceRedirectUrl: "/agents/new",
        signUpForceRedirectUrl: "/agents/new",
      }}
      title={t("agents.createTitle")}
      description={t("agents.createDesc")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("agents.adminOnlyCreate")}
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("agents.basicConfig")}
          </p>
          <div className="mt-4 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("agents.agentName")} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("agents.agentNamePlaceholder")}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("common.role")}
                </label>
                <Input
                  value={identityProfile.role}
                  onChange={(event) =>
                    setIdentityProfile((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  placeholder={t("agents.rolePlaceholder")}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.board")} <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  ariaLabel={t("agents.selectBoard")}
                  value={displayBoardId}
                  onValueChange={setBoardId}
                  options={getBoardOptions(boards)}
                  placeholder={t("agents.selectBoard")}
                  searchPlaceholder={t("agents.searchBoards")}
                  emptyMessage={t("agents.noMatchingBoards")}
                  triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  contentClassName="rounded-xl border border-slate-200 shadow-lg"
                  itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                  disabled={boards.length === 0}
                />
                {boards.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {t("agents.createBoardFirst")}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("agents.emoji")}
                </label>
                <Select
                  value={identityProfile.emoji}
                  onValueChange={(value) =>
                    setIdentityProfile((current) => ({
                      ...current,
                      emoji: value,
                    }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("agents.selectEmoji")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOJI_BASE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.glyph} {t(`agents.${option.labelKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("agents.personality")}
          </p>
          <div className="mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("agents.commStyle")}
              </label>
              <Input
                value={identityProfile.communication_style}
                onChange={(event) =>
                  setIdentityProfile((current) => ({
                    ...current,
                    communication_style: event.target.value,
                  }))
                }
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("agents.schedule")}
          </p>
          <div className="mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("agents.interval")}
              </label>
              <Input
                value={heartbeatEvery}
                onChange={(event) => setHeartbeatEvery(event.target.value)}
                placeholder={t("agents.intervalPlaceholder")}
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">
                {t("agents.intervalDesc")}
              </p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("agents.creating") : t("agents.createTitle")}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/agents")}
          >
            {t("agents.backToAgents")}
          </Button>
        </div>
      </form>
    </DashboardPageLayout>
  );
}
