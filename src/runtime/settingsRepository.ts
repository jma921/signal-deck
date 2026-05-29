import type { Database } from "bun:sqlite";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_INTEGRATION_SETTINGS,
  INTEGRATION_KEYS,
  isIntegrationKey,
  isRuntimeMode,
  type AppSettings,
  type IntegrationKey,
  type IntegrationSettings,
  type RuntimeSettings,
} from "./settings";
import { SecretStore } from "./secretStore";

interface AppSettingRow {
  key: string;
  value: string;
}

interface IntegrationSettingRow {
  integration_key: string;
  enabled: number;
  host: string | null;
  port: number | null;
  extra_json: string | null;
}

export interface AppSettingsPatch {
  mode?: string;
  bindHost?: string;
  lanReadOnlyEnabled?: boolean;
}

export interface IntegrationSettingsPatch {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  extra?: Record<string, unknown>;
}

export interface RuntimeSettingsPatch {
  app?: AppSettingsPatch;
  integrations?: Partial<Record<IntegrationKey, IntegrationSettingsPatch>>;
}

function nowIso() {
  return new Date().toISOString();
}

function boolFromSetting(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

function parseExtra(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function normalizePort(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (value === undefined) return fallback;
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : fallback;
}

function normalizeStringOrNull(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (value === undefined) return fallback;
  return typeof value === "string" ? value : fallback;
}

export class SettingsRepository {
  private readonly secretStore: SecretStore;

  constructor(private readonly db: Database) {
    this.secretStore = new SecretStore(db);
  }

  getRuntimeSettings(): RuntimeSettings {
    return {
      app: this.getAppSettings(),
      integrations: this.getIntegrationSettings(),
      secretPresence: this.secretStore.getPresence(),
    };
  }

  updateRuntimeSettings(patch: RuntimeSettingsPatch): RuntimeSettings {
    if (patch.app) this.updateAppSettings(patch.app);
    if (patch.integrations) {
      for (const [key, value] of Object.entries(patch.integrations)) {
        if (!value || !isIntegrationKey(key)) continue;
        this.updateIntegrationSettings(key, value);
      }
    }
    return this.getRuntimeSettings();
  }

  getSecretStore() {
    return this.secretStore;
  }

  private getAppSettings(): AppSettings {
    const rows = this.db.query<AppSettingRow, []>("select key, value from app_settings").all();
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const mode = values.mode && isRuntimeMode(values.mode) ? values.mode : DEFAULT_APP_SETTINGS.mode;

    return {
      mode,
      bindHost: values.bind_host ?? DEFAULT_APP_SETTINGS.bindHost,
      lanReadOnlyEnabled: boolFromSetting(values.lan_read_only_enabled, DEFAULT_APP_SETTINGS.lanReadOnlyEnabled),
    };
  }

  private getIntegrationSettings(): Record<IntegrationKey, IntegrationSettings> {
    const settings = { ...DEFAULT_INTEGRATION_SETTINGS };
    const rows = this.db.query<IntegrationSettingRow, []>("select integration_key, enabled, host, port, extra_json from integration_settings").all();

    for (const row of rows) {
      if (!isIntegrationKey(row.integration_key)) continue;
      settings[row.integration_key] = {
        integrationKey: row.integration_key,
        enabled: row.enabled === 1,
        host: row.host,
        port: row.port,
        extra: parseExtra(row.extra_json),
      };
    }

    for (const key of INTEGRATION_KEYS) {
      settings[key] = { ...DEFAULT_INTEGRATION_SETTINGS[key], ...settings[key] };
    }

    return settings;
  }

  private updateAppSettings(patch: AppSettingsPatch) {
    const current = this.getAppSettings();
    const next: AppSettings = {
      mode: patch.mode && isRuntimeMode(patch.mode) ? patch.mode : current.mode,
      bindHost: typeof patch.bindHost === "string" ? patch.bindHost : current.bindHost,
      lanReadOnlyEnabled: patch.lanReadOnlyEnabled ?? current.lanReadOnlyEnabled,
    };

    const set = this.db.query(`
      insert into app_settings (key, value, updated_at) values (?, ?, ?)
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    `);
    const now = nowIso();
    set.run("mode", next.mode, now);
    set.run("bind_host", next.bindHost, now);
    set.run("lan_read_only_enabled", next.lanReadOnlyEnabled ? "true" : "false", now);
  }

  private updateIntegrationSettings(integrationKey: IntegrationKey, patch: IntegrationSettingsPatch) {
    const current = this.getIntegrationSettings()[integrationKey];
    const next: IntegrationSettings = {
      integrationKey,
      enabled: patch.enabled ?? current.enabled,
      host: normalizeStringOrNull(patch.host, current.host),
      port: normalizePort(patch.port, current.port),
      extra: patch.extra ?? current.extra,
    };

    this.db.query(`
      insert into integration_settings (integration_key, enabled, host, port, extra_json, updated_at)
      values (?, ?, ?, ?, ?, ?)
      on conflict(integration_key) do update set
        enabled = excluded.enabled,
        host = excluded.host,
        port = excluded.port,
        extra_json = excluded.extra_json,
        updated_at = excluded.updated_at
    `).run(
      integrationKey,
      next.enabled ? 1 : 0,
      next.host,
      next.port,
      JSON.stringify(next.extra),
      nowIso(),
    );
  }
}
