import type { IntegrationKey, RuntimeSettings } from "./settings";
import type { IntegrationSettingsPatch, RuntimeSettingsPatch, SettingsRepository } from "./settingsRepository";

type Env = Record<string, string | undefined>;

interface SecretBootstrap {
  integrationKey: IntegrationKey;
  secretKey: string;
  envKey: string;
}

const SECRET_BOOTSTRAPS: SecretBootstrap[] = [
  { integrationKey: "obs", secretKey: "password", envKey: "OBS_PASSWORD" },
  { integrationKey: "pco", secretKey: "secret", envKey: "PCO_SECRET" },
];

function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

function parseEnabled(value: string | undefined): boolean | undefined {
  if (value == null || value === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function stringOrNull(value: string | undefined): string | null | undefined {
  if (value == null || value === "") return undefined;
  return value;
}

function patchFromEnv(env: Env, integrationKey: IntegrationKey): IntegrationSettingsPatch | null {
  if (integrationKey === "obs") {
    return compactPatch({
      enabled: parseEnabled(env.OBS_ENABLED),
      host: stringOrNull(env.OBS_HOST),
      port: parsePort(env.OBS_PORT) ?? undefined,
    });
  }

  if (integrationKey === "propresenter") {
    return compactPatch({
      enabled: parseEnabled(env.PROPRESENTER_ENABLED),
      host: stringOrNull(env.PROPRESENTER_HOST),
      port: parsePort(env.PROPRESENTER_PORT) ?? undefined,
    });
  }

  if (integrationKey === "pco") {
    const extra = compactObject({
      serviceTypeId: env.PCO_SERVICE_TYPE_ID,
      planId: env.PCO_PLAN_ID,
      baseUrl: env.PCO_BASE_URL,
      pollSeconds: parsePort(env.PCO_POLL_SECONDS) ?? undefined,
      clientId: env.PCO_CLIENT_ID,
    });
    return compactPatch({
      enabled: parseEnabled(env.PCO_ENABLED),
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    });
  }

  return null;
}

function compactPatch(patch: IntegrationSettingsPatch): IntegrationSettingsPatch | null {
  const next = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as IntegrationSettingsPatch;
  return Object.keys(next).length > 0 ? next : null;
}

function compactObject(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== "")
  );
}

export function bootstrapRuntimeSettingsFromEnv(settingsRepository: SettingsRepository, env: Env = process.env): RuntimeSettings {
  const current = settingsRepository.getRuntimeSettings();
  const settingsPatch: RuntimeSettingsPatch = { integrations: {} };

  if (
    current.app.mode === "simulation"
    && current.app.bindHost === "127.0.0.1"
    && (env.SIGNALDECK_MODE || env.SIGNALDECK_BIND_HOST)
  ) {
    settingsPatch.app = {
      mode: env.SIGNALDECK_MODE,
      bindHost: env.SIGNALDECK_BIND_HOST,
    };
  }

  for (const integrationKey of ["obs", "pco", "propresenter"] as IntegrationKey[]) {
    if (!settingsRepository.integrationLooksDefault(integrationKey)) continue;
    const patch = patchFromEnv(env, integrationKey);
    if (patch) settingsPatch.integrations![integrationKey] = patch;
  }

  if (Object.keys(settingsPatch.integrations ?? {}).length > 0) {
    settingsRepository.updateRuntimeSettings(settingsPatch);
  }

  const secretStore = settingsRepository.getSecretStore();
  for (const bootstrap of SECRET_BOOTSTRAPS) {
    const value = env[bootstrap.envKey];
    if (!value || secretStore.hasSecret(bootstrap.integrationKey, bootstrap.secretKey)) continue;
    secretStore.setSecret(bootstrap.integrationKey, bootstrap.secretKey, value);
  }

  return settingsRepository.getRuntimeSettings();
}
