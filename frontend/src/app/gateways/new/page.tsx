"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/auth/clerk";

import { ApiError } from "@/api/mutator";
import { useCreateGatewayApiV1GatewaysPost } from "@/api/generated/gateways/gateways";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { GatewayForm } from "@/components/gateways/GatewayForm";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { useTranslation } from "@/lib/i18n";
import {
  DEFAULT_WORKSPACE_ROOT,
  checkGatewayConnection,
  type GatewayCheckStatus,
  validateGatewayUrl,
} from "@/lib/gateway-form";

export default function NewGatewayPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const [name, setName] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState(DEFAULT_WORKSPACE_ROOT);

  const [gatewayUrlError, setGatewayUrlError] = useState<string | null>(null);
  const [gatewayCheckStatus, setGatewayCheckStatus] =
    useState<GatewayCheckStatus>("idle");
  const [gatewayCheckMessage, setGatewayCheckMessage] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateGatewayApiV1GatewaysPost<ApiError>({
    mutation: {
      onSuccess: (result) => {
        if (result.status === 200) {
          router.push(`/gateways/${result.data.id}`);
        }
      },
      onError: (err) => {
        setError(err.message || t("gateways.somethingWentWrong"));
      },
    },
  });

  const isLoading = createMutation.isPending;

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(gatewayUrl.trim()) &&
    Boolean(workspaceRoot.trim()) &&
    gatewayCheckStatus === "success";

  const runGatewayCheck = async () => {
    const validationError = validateGatewayUrl(gatewayUrl);
    setGatewayUrlError(validationError);
    if (validationError) {
      setGatewayCheckStatus("error");
      setGatewayCheckMessage(validationError);
      return;
    }
    if (!isSignedIn) return;
    setGatewayCheckStatus("checking");
    setGatewayCheckMessage(null);
    const { ok, message } = await checkGatewayConnection({
      gatewayUrl,
      gatewayToken,
    });
    setGatewayCheckStatus(ok ? "success" : "error");
    setGatewayCheckMessage(message);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;

    if (!name.trim()) {
      setError(t("gateways.gatewayNameRequired"));
      return;
    }
    const gatewayValidation = validateGatewayUrl(gatewayUrl);
    setGatewayUrlError(gatewayValidation);
    if (gatewayValidation) {
      setGatewayCheckStatus("error");
      setGatewayCheckMessage(gatewayValidation);
      return;
    }
    if (!workspaceRoot.trim()) {
      setError(t("gateways.workspaceRootRequired"));
      return;
    }

    setError(null);
    createMutation.mutate({
      data: {
        name: name.trim(),
        url: gatewayUrl.trim(),
        token: gatewayToken.trim() || null,
        workspace_root: workspaceRoot.trim(),
      },
    });
  };

  return (
    <DashboardPageLayout
      signedOut={{
        message: t("gateways.signInCreate"),
        forceRedirectUrl: "/gateways/new",
      }}
      title={t("gateways.createTitle")}
      description={t("gateways.createDesc")}
      isAdmin={isAdmin}
      adminOnlyMessage={t("gateways.adminOnlyCreate")}
    >
      <GatewayForm
        name={name}
        gatewayUrl={gatewayUrl}
        gatewayToken={gatewayToken}
        workspaceRoot={workspaceRoot}
        gatewayUrlError={gatewayUrlError}
        gatewayCheckStatus={gatewayCheckStatus}
        gatewayCheckMessage={gatewayCheckMessage}
        errorMessage={error}
        isLoading={isLoading}
        canSubmit={canSubmit}
        workspaceRootPlaceholder={DEFAULT_WORKSPACE_ROOT}
        cancelLabel={t("common.cancel")}
        submitLabel={t("gateways.createTitle")}
        submitBusyLabel={t("gateways.creating")}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/gateways")}
        onRunGatewayCheck={runGatewayCheck}
        onNameChange={setName}
        onGatewayUrlChange={(next) => {
          setGatewayUrl(next);
          setGatewayUrlError(null);
          setGatewayCheckStatus("idle");
          setGatewayCheckMessage(null);
        }}
        onGatewayTokenChange={(next) => {
          setGatewayToken(next);
          setGatewayCheckStatus("idle");
          setGatewayCheckMessage(null);
        }}
        onWorkspaceRootChange={setWorkspaceRoot}
      />
    </DashboardPageLayout>
  );
}
