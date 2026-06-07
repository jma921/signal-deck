export type IntegrationKey = "obs" | "pco" | "propresenter" | "socialstream";
export type RuntimeMode = "simulation" | "live";

export interface AppSettings {
  mode: RuntimeMode;
  bindHost: string;
  lanReadOnlyEnabled: boolean;
}

export interface IntegrationSettings {
  integrationKey: IntegrationKey;
  enabled: boolean;
  host: string | null;
  port: number | null;
  extra: Record<string, unknown>;
}

export interface IntegrationSecretPresence {
  integrationKey: IntegrationKey;
  secrets: Record<string, boolean>;
}

export interface RuntimeSettings {
  app: AppSettings;
  integrations: Record<IntegrationKey, IntegrationSettings>;
  secretPresence: Record<IntegrationKey, Record<string, boolean>>;
}

export const INTEGRATION_KEYS: IntegrationKey[] = ["obs", "pco", "propresenter", "socialstream"];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  mode: "simulation",
  bindHost: "127.0.0.1",
  lanReadOnlyEnabled: false,
};

export const DEFAULT_INTEGRATION_SETTINGS: Record<IntegrationKey, IntegrationSettings> = {
  obs: {
    integrationKey: "obs",
    enabled: false,
    host: "127.0.0.1",
    port: 4455,
    extra: {},
  },
  pco: {
    integrationKey: "pco",
    enabled: false,
    host: null,
    port: null,
    extra: {},
  },
  propresenter: {
    integrationKey: "propresenter",
    enabled: false,
    host: "127.0.0.1",
    port: null,
    extra: {},
  },
  socialstream: {
    integrationKey: "socialstream",
    enabled: false,
    host: null,
    port: null,
    extra: {},
  },
};

export function isIntegrationKey(value: string): value is IntegrationKey {
  return (INTEGRATION_KEYS as string[]).includes(value);
}

export function isRuntimeMode(value: string): value is RuntimeMode {
  return value === "simulation" || value === "live";
}
