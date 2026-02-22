"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import {
  type getAgentApiV1AgentsAgentIdGetResponse,
  useDeleteAgentApiV1AgentsAgentIdDelete,
  useGetAgentApiV1AgentsAgentIdGet,
} from "@/api/generated/agents/agents";
import {
  type listActivityApiV1ActivityGetResponse,
  useListActivityApiV1ActivityGet,
} from "@/api/generated/activity/activity";
import {
  type listBoardsApiV1BoardsGetResponse,
  useListBoardsApiV1BoardsGet,
} from "@/api/generated/boards/boards";
import {
  formatRelativeTimestamp as formatRelative,
  formatTimestamp,
} from "@/lib/formatters";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import type {
  ActivityEventRead,
  AgentRead,
  BoardRead,
} from "@/api/generated/model";
import { Markdown } from "@/components/atoms/Markdown";
import { StatusPill } from "@/components/atoms/StatusPill";
import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { DashboardShell } from "@/components/templates/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export default function AgentDetailPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentIdParam = params?.agentId;
  const agentId = Array.isArray(agentIdParam) ? agentIdParam[0] : agentIdParam;
  const { t } = useTranslation();

  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const agentQuery = useGetAgentApiV1AgentsAgentIdGet<
    getAgentApiV1AgentsAgentIdGetResponse,
    ApiError
  >(agentId ?? "", {
    query: {
      enabled: Boolean(isSignedIn && isAdmin && agentId),
      refetchInterval: 30_000,
      refetchOnMount: "always",
      retry: false,
    },
  });

  const activityQuery = useListActivityApiV1ActivityGet<
    listActivityApiV1ActivityGetResponse,
    ApiError
  >(
    { limit: 200 },
    {
      query: {
        enabled: Boolean(isSignedIn && isAdmin),
        refetchInterval: 30_000,
        retry: false,
      },
    },
  );

  const boardsQuery = useListBoardsApiV1BoardsGet<
    listBoardsApiV1BoardsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchInterval: 60_000,
      refetchOnMount: "always",
      retry: false,
    },
  });

  const agent: AgentRead | null =
    agentQuery.data?.status === 200 ? agentQuery.data.data : null;
  const events = useMemo<ActivityEventRead[]>(() => {
    if (activityQuery.data?.status !== 200) return [];
    return activityQuery.data.data.items ?? [];
  }, [activityQuery.data]);
  const boards = useMemo<BoardRead[]>(() => {
    if (boardsQuery.data?.status !== 200) return [];
    return boardsQuery.data.data.items ?? [];
  }, [boardsQuery.data]);

  const agentEvents = useMemo(() => {
    if (!agent) return [];
    return events.filter((event) => event.agent_id === agent.id);
  }, [events, agent]);
  const linkedBoard =
    !agent?.board_id || agent?.is_gateway_main
      ? null
      : (boards.find((board) => board.id === agent.board_id) ?? null);

  const deleteMutation = useDeleteAgentApiV1AgentsAgentIdDelete<ApiError>({
    mutation: {
      onSuccess: () => {
        setDeleteOpen(false);
        router.push("/agents");
      },
      onError: (err) => {
        setDeleteError(err.message || "Something went wrong.");
      },
    },
  });

  const isLoading =
    agentQuery.isLoading || activityQuery.isLoading || boardsQuery.isLoading;
  const error =
    agentQuery.error?.message ??
    activityQuery.error?.message ??
    boardsQuery.error?.message ??
    null;

  const isDeleting = deleteMutation.isPending;
  const agentStatus = agent?.status ?? "unknown";

  const handleDelete = () => {
    if (!agentId || !isSignedIn) return;
    setDeleteError(null);
    deleteMutation.mutate({ agentId });
  };

  return (
    <DashboardShell>
      <SignedOut>
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl surface-panel p-10 text-center">
          <p className="text-sm text-muted">{t("agents.signInView")}</p>
          <SignInButton
            mode="modal"
            forceRedirectUrl="/agents"
            signUpForceRedirectUrl="/agents"
          >
            <Button>{t("common.signInRequired")}</Button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        {!isAdmin ? (
          <div className="flex h-full flex-col gap-6 rounded-2xl surface-panel p-8">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 text-sm text-muted">
              {t("agents.adminOnly")}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-6 rounded-2xl surface-panel p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quiet">
                  {t("menu.agents")}
                </p>
                <h1 className="text-2xl font-semibold text-strong">
                  {agent?.name ?? t("agents.agent")}
                </h1>
                <p className="text-sm text-muted">
                  {t("agents.reviewDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/agents")}
                >
                  {t("agents.backToAgents")}
                </Button>
                {agent ? (
                  <Link
                    href={`/agents/${agent.id}/edit`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--border)] px-4 text-sm font-semibold text-muted transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    {t("common.edit")}
                  </Link>
                ) : null}
                {agent ? (
                  <Button variant="outline" onClick={() => setDeleteOpen(true)}>
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                {t("agents.loadingDetails")}
              </div>
            ) : agent ? (
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("agents.overview")}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-strong">
                          {agent.name}
                        </p>
                      </div>
                      <StatusPill status={agentStatus} />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("agents.agentId")}
                        </p>
                        <p className="mt-1 text-sm text-muted">{agent.id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("agents.sessionKey")}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {agent.openclaw_session_id ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("boards.board")}
                        </p>
                        {agent.is_gateway_main ? (
                          <p className="mt-1 text-sm text-strong">
                            {t("agents.gatewayMain")}
                          </p>
                        ) : linkedBoard ? (
                          <Link
                            href={`/boards/${linkedBoard.id}`}
                            className="mt-1 inline-flex text-sm font-medium text-[color:var(--accent)] transition hover:underline"
                          >
                            {linkedBoard.name}
                          </Link>
                        ) : (
                          <p className="mt-1 text-sm text-strong">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("agents.lastSeen")}
                        </p>
                        <p className="mt-1 text-sm text-strong">
                          {formatRelative(agent.last_seen_at)}
                        </p>
                        <p className="text-xs text-quiet">
                          {formatTimestamp(agent.last_seen_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("common.updated")}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {formatTimestamp(agent.updated_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                          {t("common.created")}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {formatTimestamp(agent.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                        {t("agents.health")}
                      </p>
                      <StatusPill status={agentStatus} />
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-muted">
                      <div className="flex items-center justify-between">
                        <span>{t("agents.heartbeatWindow")}</span>
                        <span>{formatRelative(agent.last_seen_at)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("agents.sessionBinding")}</span>
                        <span>
                          {agent.openclaw_session_id ? t("agents.bound") : t("agents.unbound")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("common.status")}</span>
                        <span className="text-strong">{agentStatus}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
                      {t("agents.activitySection")}
                    </p>
                    <p className="text-xs text-quiet">
                      {agentEvents.length} {t("agents.events")}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {agentEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-muted">
                        {t("agents.noActivity")}
                      </div>
                    ) : (
                      agentEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-muted"
                        >
                          {event.message?.trim() ? (
                            <div className="select-text cursor-text leading-relaxed text-strong break-words">
                              <Markdown
                                content={event.message}
                                variant="comment"
                              />
                            </div>
                          ) : (
                            <p className="font-medium text-strong">
                              {event.event_type}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-quiet">
                            {formatTimestamp(event.created_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                {t("agents.agentNotFound")}
              </div>
            )}
          </div>
        )}
      </SignedIn>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent aria-label={t("agents.deleteAgent")}>
          <DialogHeader>
            <DialogTitle>{t("agents.deleteAgent")}</DialogTitle>
            <DialogDescription>
              {t("agents.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3 text-xs text-muted">
              {deleteError}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
