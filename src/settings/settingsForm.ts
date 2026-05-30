import type { IntegrationKey, RuntimeMode, RuntimeSettings } from "../runtime/settings";

export interface ConnectionConfigStatus {
  enabled: boolean;
  configured: boolean;
  hasRequiredSecrets: boolean;
  missing: string[];
}

export type ConfigStatus = Record<IntegrationKey, ConnectionConfigStatus>;

export interface IntegrationStatusView {
  integrationKey: IntegrationKey;
  enabled: boolean;
  state: "disabled" | "missing-config" | "connecting" | "connected" | "error";
  message: string | null;
  updatedAt: string;
}

export interface RuntimeSettingsPatch {
  app?: {
    mode?: RuntimeMode;
  };
  integrations?: Partial<Record<IntegrationKey, {
    enabled?: boolean;
    host?: string | null;
    port?: number | null;
    extra?: Record<string, unknown>;
  }>>;
}

export interface SecretPatchRequest {
  integrationKey: IntegrationKey;
  secrets: Record<string, string | null>;
}

export interface SettingsFormState {
  appMode: RuntimeMode;
  pco: {
    enabled: boolean;
    baseUrl: string;
    serviceTypeId: string;
    planId: string;
    pollSeconds: string;
    clientId: string;
    secret: string;
    clearSecret: boolean;
  };
  propresenter: {
    enabled: boolean;
    host: string;
    port: string;
  };
  obs: {
    enabled: boolean;
    host: string;
    port: string;
    password: string;
    clearPassword: boolean;
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberString(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function formFromRuntimeSettings(settings: RuntimeSettings): SettingsFormState {
  const pco = settings.integrations.pco;
  const propresenter = settings.integrations.propresenter;
  const obs = settings.integrations.obs;

  return {
    appMode: settings.app.mode,
    pco: {
      enabled: pco.enabled,
      baseUrl: stringValue(pco.extra.baseUrl),
      serviceTypeId: stringValue(pco.extra.serviceTypeId),
      planId: stringValue(pco.extra.planId),
      pollSeconds: numberString(pco.extra.pollSeconds),
      clientId: stringValue(pco.extra.clientId),
      secret: "",
      clearSecret: false,
    },
    propresenter: {
      enabled: propresenter.enabled,
      host: propresenter.host ?? "",
      port: numberString(propresenter.port),
    },
    obs: {
      enabled: obs.enabled,
      host: obs.host ?? "",
      port: numberString(obs.port),
      password: "",
      clearPassword: false,
    },
  };
}

export function runtimeSettingsPatchFromForm(form: SettingsFormState): RuntimeSettingsPatch {
  return {
    app: {
      mode: form.appMode,
    },
    integrations: {
      pco: {
        enabled: form.pco.enabled,
        extra: {
          serviceTypeId: form.pco.serviceTypeId.trim(),
          planId: form.pco.planId.trim(),
          baseUrl: form.pco.baseUrl.trim(),
          pollSeconds: numberOrUndefined(form.pco.pollSeconds),
          clientId: form.pco.clientId.trim(),
        },
      },
      propresenter: {
        enabled: form.propresenter.enabled,
        host: form.propresenter.host.trim() || null,
        port: numberOrNull(form.propresenter.port),
      },
      obs: {
        enabled: form.obs.enabled,
        host: form.obs.host.trim() || null,
        port: numberOrNull(form.obs.port),
      },
    },
  };
}

export function secretPatchRequestsFromForm(form: SettingsFormState): SecretPatchRequest[] {
  const requests: SecretPatchRequest[] = [];
  const pcoSecret = form.pco.secret.trim();
  const obsPassword = form.obs.password;

  if (pcoSecret || form.pco.clearSecret) {
    requests.push({
      integrationKey: "pco",
      secrets: {
        secret: pcoSecret || null,
      },
    });
  }

  if (obsPassword || form.obs.clearPassword) {
    requests.push({
      integrationKey: "obs",
      secrets: {
        password: obsPassword || null,
      },
    });
  }

  return requests;
}
