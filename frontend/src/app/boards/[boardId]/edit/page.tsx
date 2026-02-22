"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/auth/clerk";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/mutator";
import {
  type getBoardApiV1BoardsBoardIdGetResponse,
  useGetBoardApiV1BoardsBoardIdGet,
  useUpdateBoardApiV1BoardsBoardIdPatch,
} from "@/api/generated/boards/boards";
import {
  type listAgentsApiV1AgentsGetResponse,
  useListAgentsApiV1AgentsGet,
} from "@/api/generated/agents/agents";
import {
  getListBoardWebhooksApiV1BoardsBoardIdWebhooksGetQueryKey,
  type listBoardWebhooksApiV1BoardsBoardIdWebhooksGetResponse,
  useCreateBoardWebhookApiV1BoardsBoardIdWebhooksPost,
  useDeleteBoardWebhookApiV1BoardsBoardIdWebhooksWebhookIdDelete,
  useListBoardWebhooksApiV1BoardsBoardIdWebhooksGet,
  useUpdateBoardWebhookApiV1BoardsBoardIdWebhooksWebhookIdPatch,
} from "@/api/generated/board-webhooks/board-webhooks";
import {
  type listBoardGroupsApiV1BoardGroupsGetResponse,
  useListBoardGroupsApiV1BoardGroupsGet,
} from "@/api/generated/board-groups/board-groups";
import {
  type listGatewaysApiV1GatewaysGetResponse,
  useListGatewaysApiV1GatewaysGet,
} from "@/api/generated/gateways/gateways";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { useTranslation } from "@/lib/i18n";
import type {
  AgentRead,
  BoardGroupRead,
  BoardWebhookRead,
  BoardRead,
  BoardUpdate,
} from "@/api/generated/model";
import { BoardOnboardingChat } from "@/components/BoardOnboardingChat";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { localDateInputToUtcIso, toLocalDateInput } from "@/lib/datetime";
import { Markdown } from "@/components/atoms/Markdown";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "board";

const LEAD_AGENT_VALUE = "__lead_agent__";

type WebhookCardProps = {
  webhook: BoardWebhookRead;
  agents: AgentRead[];
  isLoading: boolean;
  isWebhookCreating: boolean;
  isDeletingWebhook: boolean;
  isUpdatingWebhook: boolean;
  copiedWebhookId: string | null;
  onCopy: (webhook: BoardWebhookRead) => void;
  onDelete: (webhookId: string) => void;
  onViewPayloads: (webhookId: string) => void;
  onUpdate: (
    webhookId: string,
    description: string,
    agentId: string | null,
  ) => Promise<boolean>;
  t: (key: string) => string;
};

function WebhookCard({
  webhook,
  agents,
  isLoading,
  isWebhookCreating,
  isDeletingWebhook,
  isUpdatingWebhook,
  copiedWebhookId,
  onCopy,
  onDelete,
  onViewPayloads,
  onUpdate,
  t,
}: WebhookCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState(webhook.description);
  const [draftAgentValue, setDraftAgentValue] = useState(
    webhook.agent_id ?? LEAD_AGENT_VALUE,
  );

  const isBusy =
    isLoading || isWebhookCreating || isDeletingWebhook || isUpdatingWebhook;
  const trimmedDescription = draftDescription.trim();
  const isDescriptionChanged =
    trimmedDescription !== webhook.description.trim();
  const isAgentChanged =
    draftAgentValue !== (webhook.agent_id ?? LEAD_AGENT_VALUE);
  const isChanged = isDescriptionChanged || isAgentChanged;
  const mappedAgent = webhook.agent_id
    ? (agents.find((agent) => agent.id === webhook.agent_id) ?? null)
    : null;

  const handleSave = async () => {
    if (!trimmedDescription) return;
    if (!isChanged) {
      setIsEditing(false);
      return;
    }
    const saved = await onUpdate(
      webhook.id,
      trimmedDescription,
      draftAgentValue === LEAD_AGENT_VALUE ? null : draftAgentValue,
    );
    if (saved) {
      setIsEditing(false);
    }
  };

  return (
    <div
      key={webhook.id}
      className="space-y-3 rounded-lg border border-slate-200 px-4 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">
          Webhook {webhook.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onCopy(webhook)}
            disabled={isBusy}
          >
            {copiedWebhookId === webhook.id ? t("common.copied") : t("boards.copyEndpoint")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onViewPayloads(webhook.id)}
            disabled={isBusy}
          >
            {t("boards.viewPayloads")}
          </Button>
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraftDescription(webhook.description);
                  setDraftAgentValue(webhook.agent_id ?? LEAD_AGENT_VALUE);
                  setIsEditing(false);
                }}
                disabled={isBusy}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isBusy || !trimmedDescription}
              >
                {isUpdatingWebhook ? t("common.saving") : t("common.save")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraftDescription(webhook.description);
                  setDraftAgentValue(webhook.agent_id ?? LEAD_AGENT_VALUE);
                  setIsEditing(true);
                }}
                disabled={isBusy}
              >
                {t("common.edit")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDelete(webhook.id)}
                disabled={isBusy}
              >
                {isDeletingWebhook ? t("common.deleting") : t("common.delete")}
              </Button>
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <>
          <Textarea
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            placeholder={t("boards.webhookDescriptionPlaceholder")}
            className="min-h-[90px]"
            disabled={isBusy}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">{t("boards.agentLabel")}</label>
            <Select
              value={draftAgentValue}
              onValueChange={setDraftAgentValue}
              disabled={isBusy}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("boards.leadAgentFallback")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LEAD_AGENT_VALUE}>
                  {t("boards.leadAgentFallback")}
                </SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.is_board_lead ? " (lead)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm text-slate-700">
            <Markdown
              content={webhook.description || ""}
              variant="description"
            />
          </div>
          <p className="text-xs text-slate-600">
            {t("boards.recipientPrefix")} {mappedAgent?.name ?? t("boards.leadAgent")}
          </p>
        </>
      )}
      <div className="rounded-md bg-slate-50 px-3 py-2">
        <code className="break-all text-xs text-slate-700">
          {webhook.endpoint_url ?? webhook.endpoint_path}
        </code>
      </div>
    </div>
  );
}

export default function EditBoardPage() {
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const boardIdParam = params?.boardId;
  const boardId = Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam;

  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const mainRef = useRef<HTMLElement | null>(null);

  const [board, setBoard] = useState<BoardRead | null>(null);
  const [name, setName] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [gatewayId, setGatewayId] = useState<string | undefined>(undefined);
  const [boardGroupId, setBoardGroupId] = useState<string | undefined>(
    undefined,
  );
  const [boardType, setBoardType] = useState<string | undefined>(undefined);
  const [objective, setObjective] = useState<string | undefined>(undefined);
  const [requireApprovalForDone, setRequireApprovalForDone] = useState<
    boolean | undefined
  >(undefined);
  const [requireReviewBeforeDone, setRequireReviewBeforeDone] = useState<
    boolean | undefined
  >(undefined);
  const [
    blockStatusChangesWithPendingApproval,
    setBlockStatusChangesWithPendingApproval,
  ] = useState<boolean | undefined>(undefined);
  const [onlyLeadCanChangeStatus, setOnlyLeadCanChangeStatus] = useState<
    boolean | undefined
  >(undefined);
  const [maxAgents, setMaxAgents] = useState<number | undefined>(undefined);
  const [successMetrics, setSuccessMetrics] = useState<string | undefined>(
    undefined,
  );
  const [targetDate, setTargetDate] = useState<string | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [webhookDescription, setWebhookDescription] = useState("");
  const [webhookAgentValue, setWebhookAgentValue] = useState(LEAD_AGENT_VALUE);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);

  const onboardingParam = searchParams.get("onboarding");
  const searchParamsString = searchParams.toString();
  const shouldAutoOpenOnboarding =
    onboardingParam !== null &&
    onboardingParam !== "" &&
    onboardingParam !== "0" &&
    onboardingParam.toLowerCase() !== "false";

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    shouldAutoOpenOnboarding,
  );

  useEffect(() => {
    if (!isOnboardingOpen) return;

    const mainEl = mainRef.current;
    const previousMainOverflow = mainEl?.style.overflow ?? "";
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    if (mainEl) {
      mainEl.style.overflow = "hidden";
    }
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      if (mainEl) {
        mainEl.style.overflow = previousMainOverflow;
      }
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isOnboardingOpen]);

  useEffect(() => {
    if (!boardId) return;
    if (!shouldAutoOpenOnboarding) return;

    // Remove the flag from the URL so refreshes don't constantly reopen it.
    const nextParams = new URLSearchParams(searchParamsString);
    nextParams.delete("onboarding");
    const qs = nextParams.toString();
    router.replace(
      qs ? `/boards/${boardId}/edit?${qs}` : `/boards/${boardId}/edit`,
    );
  }, [boardId, router, searchParamsString, shouldAutoOpenOnboarding]);

  const gatewaysQuery = useListGatewaysApiV1GatewaysGet<
    listGatewaysApiV1GatewaysGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const groupsQuery = useListBoardGroupsApiV1BoardGroupsGet<
    listBoardGroupsApiV1BoardGroupsGetResponse,
    ApiError
  >(undefined, {
    query: {
      enabled: Boolean(isSignedIn && isAdmin),
      refetchOnMount: "always",
      retry: false,
    },
  });

  const boardQuery = useGetBoardApiV1BoardsBoardIdGet<
    getBoardApiV1BoardsBoardIdGetResponse,
    ApiError
  >(boardId ?? "", {
    query: {
      enabled: Boolean(isSignedIn && isAdmin && boardId),
      refetchOnMount: "always",
      retry: false,
    },
  });
  const webhooksQuery = useListBoardWebhooksApiV1BoardsBoardIdWebhooksGet<
    listBoardWebhooksApiV1BoardsBoardIdWebhooksGetResponse,
    ApiError
  >(
    boardId ?? "",
    { limit: 50 },
    {
      query: {
        enabled: Boolean(isSignedIn && isAdmin && boardId),
        refetchOnMount: "always",
        retry: false,
      },
    },
  );
  const agentsQuery = useListAgentsApiV1AgentsGet<
    listAgentsApiV1AgentsGetResponse,
    ApiError
  >(
    { board_id: boardId ?? null, limit: 200 },
    {
      query: {
        enabled: Boolean(isSignedIn && isAdmin && boardId),
        refetchOnMount: "always",
        retry: false,
      },
    },
  );

  const updateBoardMutation = useUpdateBoardApiV1BoardsBoardIdPatch<ApiError>({
    mutation: {
      onSuccess: (result) => {
        if (result.status === 200) {
          router.push(`/boards/${result.data.id}`);
        }
      },
      onError: (err) => {
        setError(err.message || t("gateways.somethingWentWrong"));
      },
    },
  });
  const createWebhookMutation =
    useCreateBoardWebhookApiV1BoardsBoardIdWebhooksPost<ApiError>({
      mutation: {
        onSuccess: async () => {
          if (!boardId) return;
          setWebhookDescription("");
          setWebhookAgentValue(LEAD_AGENT_VALUE);
          await queryClient.invalidateQueries({
            queryKey:
              getListBoardWebhooksApiV1BoardsBoardIdWebhooksGetQueryKey(
                boardId,
              ),
          });
        },
        onError: (err) => {
          setWebhookError(err.message || t("boards.unableToCreateWebhook"));
        },
      },
    });
  const deleteWebhookMutation =
    useDeleteBoardWebhookApiV1BoardsBoardIdWebhooksWebhookIdDelete<ApiError>({
      mutation: {
        onSuccess: async () => {
          if (!boardId) return;
          await queryClient.invalidateQueries({
            queryKey:
              getListBoardWebhooksApiV1BoardsBoardIdWebhooksGetQueryKey(
                boardId,
              ),
          });
        },
        onError: (err) => {
          setWebhookError(err.message || t("boards.unableToDeleteWebhook"));
        },
      },
    });
  const updateWebhookMutation =
    useUpdateBoardWebhookApiV1BoardsBoardIdWebhooksWebhookIdPatch<ApiError>({
      mutation: {
        onSuccess: async () => {
          if (!boardId) return;
          await queryClient.invalidateQueries({
            queryKey:
              getListBoardWebhooksApiV1BoardsBoardIdWebhooksGetQueryKey(
                boardId,
              ),
          });
        },
        onError: (err) => {
          setWebhookError(err.message || t("boards.unableToUpdateWebhook"));
        },
      },
    });

  const gateways = useMemo(() => {
    if (gatewaysQuery.data?.status !== 200) return [];
    return gatewaysQuery.data.data.items ?? [];
  }, [gatewaysQuery.data]);
  const loadedBoard: BoardRead | null =
    boardQuery.data?.status === 200 ? boardQuery.data.data : null;
  const baseBoard = board ?? loadedBoard;

  const resolvedName = name ?? baseBoard?.name ?? "";
  const resolvedDescription = description ?? baseBoard?.description ?? "";
  const resolvedGatewayId = gatewayId ?? baseBoard?.gateway_id ?? "";
  const resolvedBoardGroupId =
    boardGroupId ?? baseBoard?.board_group_id ?? "none";
  const resolvedBoardType = boardType ?? baseBoard?.board_type ?? "goal";
  const resolvedObjective = objective ?? baseBoard?.objective ?? "";
  const resolvedRequireApprovalForDone =
    requireApprovalForDone ?? baseBoard?.require_approval_for_done ?? true;
  const resolvedRequireReviewBeforeDone =
    requireReviewBeforeDone ?? baseBoard?.require_review_before_done ?? false;
  const resolvedBlockStatusChangesWithPendingApproval =
    blockStatusChangesWithPendingApproval ??
    baseBoard?.block_status_changes_with_pending_approval ??
    false;
  const resolvedOnlyLeadCanChangeStatus =
    onlyLeadCanChangeStatus ?? baseBoard?.only_lead_can_change_status ?? false;
  const resolvedMaxAgents = maxAgents ?? baseBoard?.max_agents ?? 1;
  const resolvedSuccessMetrics =
    successMetrics ??
    (baseBoard?.success_metrics
      ? JSON.stringify(baseBoard.success_metrics, null, 2)
      : "");
  const resolvedTargetDate =
    targetDate ?? toLocalDateInput(baseBoard?.target_date);

  const displayGatewayId = resolvedGatewayId || gateways[0]?.id || "";
  const isWebhookCreating = createWebhookMutation.isPending;
  const deletingWebhookId =
    deleteWebhookMutation.isPending && deleteWebhookMutation.variables
      ? deleteWebhookMutation.variables.webhookId
      : null;
  const updatingWebhookId =
    updateWebhookMutation.isPending && updateWebhookMutation.variables
      ? updateWebhookMutation.variables.webhookId
      : null;
  const isWebhookBusy =
    isWebhookCreating ||
    deleteWebhookMutation.isPending ||
    updateWebhookMutation.isPending;

  const isLoading =
    gatewaysQuery.isLoading ||
    groupsQuery.isLoading ||
    boardQuery.isLoading ||
    updateBoardMutation.isPending;
  const errorMessage =
    error ??
    gatewaysQuery.error?.message ??
    groupsQuery.error?.message ??
    boardQuery.error?.message ??
    null;
  const webhookErrorMessage =
    webhookError ??
    webhooksQuery.error?.message ??
    agentsQuery.error?.message ??
    null;

  const isFormReady = Boolean(
    resolvedName.trim() && resolvedDescription.trim() && displayGatewayId,
  );

  const gatewayOptions = useMemo(
    () =>
      gateways.map((gateway) => ({ value: gateway.id, label: gateway.name })),
    [gateways],
  );

  const groups = useMemo<BoardGroupRead[]>(() => {
    if (groupsQuery.data?.status !== 200) return [];
    return groupsQuery.data.data.items ?? [];
  }, [groupsQuery.data]);
  const groupOptions = useMemo(
    () => [
      { value: "none", label: t("boards.noGroup") },
      ...groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups, t],
  );
  const webhookAgents = useMemo<AgentRead[]>(() => {
    if (agentsQuery.data?.status !== 200) return [];
    return agentsQuery.data.data.items ?? [];
  }, [agentsQuery.data]);
  const webhooks = useMemo<BoardWebhookRead[]>(() => {
    if (webhooksQuery.data?.status !== 200) return [];
    return webhooksQuery.data.data.items ?? [];
  }, [webhooksQuery.data]);

  const handleOnboardingConfirmed = (updated: BoardRead) => {
    setBoard(updated);
    setDescription(updated.description ?? "");
    setBoardType(updated.board_type ?? "goal");
    setObjective(updated.objective ?? "");
    setRequireApprovalForDone(updated.require_approval_for_done ?? true);
    setRequireReviewBeforeDone(updated.require_review_before_done ?? false);
    setBlockStatusChangesWithPendingApproval(
      updated.block_status_changes_with_pending_approval ?? false,
    );
    setOnlyLeadCanChangeStatus(updated.only_lead_can_change_status ?? false);
    setMaxAgents(updated.max_agents ?? 1);
    setSuccessMetrics(
      updated.success_metrics
        ? JSON.stringify(updated.success_metrics, null, 2)
        : "",
    );
    setTargetDate(toLocalDateInput(updated.target_date));
    setBoardGroupId(updated.board_group_id ?? "none");
    setIsOnboardingOpen(false);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn || !boardId) return;
    const trimmedName = resolvedName.trim();
    if (!trimmedName) {
      setError(t("boards.nameRequired"));
      return;
    }
    const resolvedGatewayId = displayGatewayId;
    if (!resolvedGatewayId) {
      setError(t("boards.selectGatewayRequired"));
      return;
    }
    const trimmedDescription = resolvedDescription.trim();
    if (!trimmedDescription) {
      setError(t("boards.descriptionRequired"));
      return;
    }
    if (!Number.isInteger(resolvedMaxAgents) || resolvedMaxAgents < 0) {
      setError(t("boards.maxAgentsInvalid"));
      return;
    }

    setError(null);
    setMetricsError(null);

    let parsedMetrics: Record<string, unknown> | null = null;
    if (resolvedBoardType !== "general" && resolvedSuccessMetrics.trim()) {
      try {
        parsedMetrics = JSON.parse(resolvedSuccessMetrics) as Record<
          string,
          unknown
        >;
      } catch {
        setMetricsError(t("boards.successMetricsInvalidJson"));
        return;
      }
    }

    const payload: BoardUpdate = {
      name: trimmedName,
      slug: slugify(trimmedName),
      description: trimmedDescription,
      gateway_id: resolvedGatewayId || null,
      board_group_id:
        resolvedBoardGroupId === "none" ? null : resolvedBoardGroupId,
      board_type: resolvedBoardType,
      objective:
        resolvedBoardType === "general"
          ? null
          : resolvedObjective.trim() || null,
      require_approval_for_done: resolvedRequireApprovalForDone,
      require_review_before_done: resolvedRequireReviewBeforeDone,
      block_status_changes_with_pending_approval:
        resolvedBlockStatusChangesWithPendingApproval,
      only_lead_can_change_status: resolvedOnlyLeadCanChangeStatus,
      max_agents: resolvedMaxAgents,
      success_metrics: resolvedBoardType === "general" ? null : parsedMetrics,
      target_date:
        resolvedBoardType === "general"
          ? null
          : localDateInputToUtcIso(resolvedTargetDate),
    };

    updateBoardMutation.mutate({ boardId, data: payload });
  };

  const handleCreateWebhook = () => {
    if (!boardId) return;
    const trimmedDescription = webhookDescription.trim();
    if (!trimmedDescription) {
      setWebhookError(t("boards.webhookInstructionRequired"));
      return;
    }
    setWebhookError(null);
    const mappedAgentId =
      webhookAgentValue === LEAD_AGENT_VALUE ? null : webhookAgentValue;
    createWebhookMutation.mutate({
      boardId,
      data: {
        description: trimmedDescription,
        enabled: true,
        agent_id: mappedAgentId,
      },
    });
  };

  const handleDeleteWebhook = (webhookId: string) => {
    if (!boardId) return;
    if (deleteWebhookMutation.isPending) return;
    setWebhookError(null);
    deleteWebhookMutation.mutate({ boardId, webhookId });
  };

  const handleUpdateWebhook = async (
    webhookId: string,
    description: string,
    agentId: string | null,
  ): Promise<boolean> => {
    if (!boardId) return false;
    if (updateWebhookMutation.isPending) return false;
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setWebhookError(t("boards.webhookInstructionRequired"));
      return false;
    }
    setWebhookError(null);
    try {
      await updateWebhookMutation.mutateAsync({
        boardId,
        webhookId,
        data: {
          description: trimmedDescription,
          agent_id: agentId,
        },
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyWebhookEndpoint = async (webhook: BoardWebhookRead) => {
    const endpoint = (webhook.endpoint_url ?? webhook.endpoint_path).trim();
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedWebhookId(webhook.id);
      window.setTimeout(() => {
        setCopiedWebhookId((current) =>
          current === webhook.id ? null : current,
        );
      }, 1500);
    } catch {
      setWebhookError(t("boards.unableToCopyWebhookEndpoint"));
    }
  };

  const handleViewWebhookPayloads = (webhookId: string) => {
    if (!boardId) return;
    router.push(`/boards/${boardId}/webhooks/${webhookId}/payloads`);
  };

  return (
    <>
      <DashboardPageLayout
        signedOut={{
          message: t("boards.signInEdit"),
          forceRedirectUrl: `/boards/${boardId}/edit`,
          signUpForceRedirectUrl: `/boards/${boardId}/edit`,
        }}
        title={t("boards.editTitle")}
        description={t("boards.editDesc")}
        isAdmin={isAdmin}
        adminOnlyMessage={t("boards.editAdminOnly")}
        mainRef={mainRef}
      >
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {resolvedBoardType !== "general" &&
            baseBoard &&
            !(baseBoard.goal_confirmed ?? false) ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    {t("boards.goalNeedsConfirmation")}
                  </p>
                  <p className="mt-1 text-xs text-amber-800/80">
                    {t("boards.startOnboardingHint")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsOnboardingOpen(true)}
                  disabled={isLoading || !baseBoard}
                >
                  {t("boards.startOnboarding")}
                </Button>
              </div>
            ) : null}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.boardName")} <span className="text-red-500">*</span>
                </label>
                <Input
                  value={resolvedName}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("boards.boardName")}
                  disabled={isLoading || !baseBoard}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.selectGateway")} <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  ariaLabel={t("boards.selectGateway")}
                  value={displayGatewayId}
                  onValueChange={setGatewayId}
                  options={gatewayOptions}
                  placeholder={t("boards.selectGateway")}
                  searchPlaceholder={t("boards.searchGateways")}
                  emptyMessage={t("boards.noGatewaysFound")}
                  triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  contentClassName="rounded-xl border border-slate-200 shadow-lg"
                  itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.boardType")}
                </label>
                <Select value={resolvedBoardType} onValueChange={setBoardType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("boards.selectBoardType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goal">{t("boards.boardTypeGoal")}</SelectItem>
                    <SelectItem value="general">{t("boards.boardTypeGeneral")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-2 pt-1">
                  <label className="text-sm font-medium text-slate-900">
                    {t("boards.maxWorkerAgents")}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={resolvedMaxAgents}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      if (Number.isNaN(next)) {
                        setMaxAgents(0);
                        return;
                      }
                      setMaxAgents(Math.max(0, next));
                    }}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.boardGroup")}
                </label>
                <SearchableSelect
                  ariaLabel={t("boards.boardGroup")}
                  value={resolvedBoardGroupId}
                  onValueChange={setBoardGroupId}
                  options={groupOptions}
                  placeholder={t("boards.noGroup")}
                  searchPlaceholder={t("boards.searchGroups")}
                  emptyMessage={t("boards.noGroupsFound")}
                  triggerClassName="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  contentClassName="rounded-xl border border-slate-200 shadow-lg"
                  itemClassName="px-4 py-3 text-sm text-slate-700 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-900"
                  disabled={isLoading}
                />
                <p className="text-xs text-slate-500">
                  {t("boards.groupOptional")}
                </p>
              </div>
              {resolvedBoardType !== "general" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("boards.targetDate")}
                  </label>
                  <Input
                    type="date"
                    value={resolvedTargetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">
                {t("boards.boardDescription")} <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={resolvedDescription}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("boards.descriptionContextPlaceholder")}
                className="min-h-[120px]"
                disabled={isLoading}
              />
            </div>

            {resolvedBoardType !== "general" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("boards.objectiveLabel")}
                  </label>
                  <Textarea
                    value={resolvedObjective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder={t("boards.objectivePlaceholder")}
                    className="min-h-[120px]"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("boards.successMetricsLabel")}
                  </label>
                  <Textarea
                    value={resolvedSuccessMetrics}
                    onChange={(event) => setSuccessMetrics(event.target.value)}
                    placeholder={t("boards.successMetricsPlaceholder")}
                    className="min-h-[140px] font-mono text-xs"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-slate-500">
                    {t("boards.successMetricsHint")}
                  </p>
                  {metricsError ? (
                    <p className="text-xs text-red-500">{metricsError}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            <section className="space-y-3 border-t border-slate-200 pt-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {t("boards.rulesSection")}
                </h2>
                <p className="text-xs text-slate-600">
                  {t("boards.rulesDesc")}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={resolvedRequireApprovalForDone}
                  aria-label={t("boards.requireApproval")}
                  onClick={() =>
                    setRequireApprovalForDone(!resolvedRequireApprovalForDone)
                  }
                  disabled={isLoading}
                  className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    resolvedRequireApprovalForDone
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-slate-300 bg-slate-200"
                  } ${isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      resolvedRequireApprovalForDone
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {t("boards.requireApproval")}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {t("boards.requireApprovalDesc")}
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={resolvedRequireReviewBeforeDone}
                  aria-label={t("boards.requireReviewBeforeDone")}
                  onClick={() =>
                    setRequireReviewBeforeDone(!resolvedRequireReviewBeforeDone)
                  }
                  disabled={isLoading}
                  className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    resolvedRequireReviewBeforeDone
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-slate-300 bg-slate-200"
                  } ${isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      resolvedRequireReviewBeforeDone
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {t("boards.requireReviewBeforeDone")}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {t("boards.requireReviewBeforeDoneDesc")}
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={resolvedBlockStatusChangesWithPendingApproval}
                  aria-label={t("boards.blockStatusChanges")}
                  onClick={() =>
                    setBlockStatusChangesWithPendingApproval(
                      !resolvedBlockStatusChangesWithPendingApproval,
                    )
                  }
                  disabled={isLoading}
                  className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    resolvedBlockStatusChangesWithPendingApproval
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-slate-300 bg-slate-200"
                  } ${isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      resolvedBlockStatusChangesWithPendingApproval
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {t("boards.blockStatusChanges")}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {t("boards.blockStatusChangesDesc")}
                  </span>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={resolvedOnlyLeadCanChangeStatus}
                  aria-label={t("boards.onlyLeadCanChangeStatus")}
                  onClick={() =>
                    setOnlyLeadCanChangeStatus(!resolvedOnlyLeadCanChangeStatus)
                  }
                  disabled={isLoading}
                  className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                    resolvedOnlyLeadCanChangeStatus
                      ? "border-emerald-600 bg-emerald-600"
                      : "border-slate-300 bg-slate-200"
                  } ${isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      resolvedOnlyLeadCanChangeStatus
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {t("boards.onlyLeadCanChangeStatus")}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {t("boards.onlyLeadCanChangeStatusDesc")}
                  </span>
                </span>
              </div>
            </section>

            {gateways.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>
                  {t("boards.noGatewaysPrefix")}{" "}
                  {t("boards.gatewaysLink")}{" "}
                  {t("boards.noGatewaysSuffix")}
                </p>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-red-500">{errorMessage}</p>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(`/boards/${boardId}`)}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !baseBoard || !isFormReady}
              >
                {isLoading ? t("boards.savingChanges") : t("boards.saveChanges")}
              </Button>
            </div>

            <section className="space-y-4 border-t border-slate-200 pt-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {t("boards.webhooksSection")}
                </h2>
                <p className="text-xs text-slate-600">
                  {t("boards.webhooksDesc")}
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 px-4 py-4">
                <label className="text-sm font-medium text-slate-900">
                  {t("boards.leadAgentInstruction")}
                </label>
                <Textarea
                  value={webhookDescription}
                  onChange={(event) =>
                    setWebhookDescription(event.target.value)
                  }
                  placeholder={t("boards.webhookDescriptionPlaceholder")}
                  className="min-h-[90px]"
                  disabled={isLoading || isWebhookBusy}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">
                    {t("boards.agentLabel")}
                  </label>
                  <Select
                    value={webhookAgentValue}
                    onValueChange={setWebhookAgentValue}
                    disabled={isLoading || isWebhookBusy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("boards.leadAgentFallback")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LEAD_AGENT_VALUE}>
                        {t("boards.leadAgentFallback")}
                      </SelectItem>
                      {webhookAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                          {agent.is_board_lead ? " (lead)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleCreateWebhook}
                    disabled={
                      isLoading ||
                      isWebhookBusy ||
                      !baseBoard ||
                      !webhookDescription.trim()
                    }
                  >
                    {createWebhookMutation.isPending
                      ? t("boards.creatingWebhook")
                      : t("boards.createWebhook")}
                  </Button>
                </div>
              </div>

              {webhookErrorMessage ? (
                <p className="text-sm text-red-500">{webhookErrorMessage}</p>
              ) : null}

              {webhooksQuery.isLoading ? (
                <p className="text-sm text-slate-500">{t("boards.loadingWebhooks")}</p>
              ) : null}

              {!webhooksQuery.isLoading && webhooks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
                  {t("boards.noWebhooksConfigured")}
                </p>
              ) : null}

              <div className="space-y-3">
                {webhooks.map((webhook) => {
                  const isDeletingWebhook = deletingWebhookId === webhook.id;
                  const isUpdatingWebhook = updatingWebhookId === webhook.id;
                  return (
                    <WebhookCard
                      key={webhook.id}
                      webhook={webhook}
                      agents={webhookAgents}
                      isLoading={isLoading}
                      isWebhookCreating={isWebhookCreating}
                      isDeletingWebhook={isDeletingWebhook}
                      isUpdatingWebhook={isUpdatingWebhook}
                      copiedWebhookId={copiedWebhookId}
                      onCopy={handleCopyWebhookEndpoint}
                      onDelete={handleDeleteWebhook}
                      onViewPayloads={handleViewWebhookPayloads}
                      onUpdate={handleUpdateWebhook}
                      t={t}
                    />
                  );
                })}
              </div>
            </section>
          </form>
        </div>
      </DashboardPageLayout>
      <Dialog open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen}>
        <DialogContent
          aria-label={t("boards.boardOnboardingAriaLabel")}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex">
            <DialogClose asChild>
              <button
                type="button"
                className="sticky top-4 z-10 ml-auto rounded-lg border border-slate-200 bg-[color:var(--surface)] p-2 text-slate-500 transition hover:bg-slate-50"
                aria-label={t("boards.closeOnboarding")}
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          {boardId ? (
            <BoardOnboardingChat
              boardId={boardId}
              onConfirmed={handleOnboardingConfirmed}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {t("boards.unableToStartOnboarding")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
