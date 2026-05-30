import { INTEGRATION_KEYS, type IntegrationKey, type RuntimeSettings } from "./settings";

export interface SanitizedIntegrationConfig {
  enabled: boolean;
  configured: boolean;
  hasRequiredSecrets: boolean;
  missing: string[];
}

export type SanitizedConfigStatus = Record<IntegrationKey, SanitizedIntegrationConfig>;

function hasSecret(settings: RuntimeSettings, integrationKey: IntegrationKey, secretKey: string): boolean {
  return settings.secretPresence[integrationKey]?.[secretKey] === true;
}

function hasString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function addMissing(missing: string[], condition: boolean, key: string) {
  if (!condition) missing.push(key);
}

function requiredFields(settings: RuntimeSettings, integrationKey: IntegrationKey): string[] {
  const integration = settings.integrations[integrationKey];
  const missing: string[] = [];

  if (integrationKey === "obs") {
    addMissing(missing, hasString(integration.host), "OBS_HOST");
    addMissing(missing, typeof integration.port === "number", "OBS_PORT");
  } else if (integrationKey === "propresenter") {
    addMissing(missing, hasString(integration.host), "PROPRESENTER_HOST");
    addMissing(missing, typeof integration.port === "number", "PROPRESENTER_PORT");
  } else if (integrationKey === "pco") {
    addMissing(missing, hasString(integration.extra.serviceTypeId), "PCO_SERVICE_TYPE_ID");
    addMissing(missing, hasString(integration.extra.planId), "PCO_PLAN_ID");
    addMissing(missing, hasSecret(settings, "pco", "token"), "PCO_TOKEN");
  }

  return missing;
}

export function getSanitizedConfigStatus(settings: RuntimeSettings): SanitizedConfigStatus {
  return Object.fromEntries(INTEGRATION_KEYS.map((integrationKey) => {
    const missing = requiredFields(settings, integrationKey);
    return [integrationKey, {
      enabled: settings.integrations[integrationKey].enabled,
      configured: missing.length === 0,
      hasRequiredSecrets: !missing.some((key) => key.includes("TOKEN") || key.includes("SECRET") || key.includes("API_KEY")),
      missing,
    }];
  })) as SanitizedConfigStatus;
}
