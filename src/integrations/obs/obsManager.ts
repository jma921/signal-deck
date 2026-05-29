import OBSWebSocket from "obs-websocket-js";
import type { SettingsRepository } from "../../runtime/settingsRepository";
import type { IntegrationSettings } from "../../runtime/settings";
import type { IntegrationStatus, IntegrationTestResult } from "../types";

const RECONNECT_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

function nowIso() {
  return new Date().toISOString();
}

function status(state: IntegrationStatus["state"], enabled: boolean, message: string | null): IntegrationStatus {
  return {
    integrationKey: "obs",
    enabled,
    state,
    message,
    updatedAt: nowIso(),
  };
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("auth") || message.includes("password")) return "Authentication failed.";
    if (message.includes("econnrefused") || message.includes("refused")) return "OBS WebSocket refused the connection.";
    if (message.includes("timed out") || message.includes("timeout")) return "OBS WebSocket connection timed out.";
    return error.message || "OBS WebSocket connection failed.";
  }

  return "OBS WebSocket connection failed.";
}

function obsUrl(settings: IntegrationSettings): string {
  return `ws://${settings.host}:${settings.port}`;
}

function onObsEvent(client: OBSWebSocket, event: string, handler: (...args: unknown[]) => void) {
  (client as unknown as { on: (event: string, handler: (...args: unknown[]) => void) => void }).on(event, handler);
}

export class ObsManager {
  private client: OBSWebSocket | null = null;
  private currentStatus: IntegrationStatus = status("disabled", false, "OBS integration is disabled.");
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private running = false;
  private connecting = false;

  constructor(private readonly settingsRepository: SettingsRepository) {}

  start() {
    this.running = true;
    void this.refresh();
  }

  stop() {
    this.running = false;
    this.clearReconnectTimer();
    this.disconnect();
    this.currentStatus = status("disabled", false, "OBS integration stopped.");
  }

  getStatus(): IntegrationStatus {
    return this.currentStatus;
  }

  async refresh() {
    const settings = this.getSettings();

    if (!settings.enabled) {
      this.clearReconnectTimer();
      this.disconnect();
      this.reconnectAttempt = 0;
      this.currentStatus = status("disabled", false, "OBS integration is disabled.");
      return;
    }

    if (!settings.host || !settings.port) {
      this.clearReconnectTimer();
      this.disconnect();
      this.reconnectAttempt = 0;
      this.currentStatus = status("missing-config", true, "OBS host and port are required.");
      return;
    }

    await this.connect(settings);
  }

  async reconnect() {
    this.clearReconnectTimer();
    this.disconnect();
    this.reconnectAttempt = 0;
    await this.refresh();
    return this.getStatus();
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const settings = this.getSettings();

    if (!settings.enabled) {
      const testStatus = status("disabled", false, "OBS integration is disabled.");
      return { ok: false, status: testStatus };
    }

    if (!settings.host || !settings.port) {
      const testStatus = status("missing-config", true, "OBS host and port are required.");
      return { ok: false, status: testStatus };
    }

    const client = new OBSWebSocket();
    try {
      await client.connect(obsUrl(settings), this.getPassword() ?? undefined);
      client.disconnect();
      return { ok: true, status: status("connected", true, "OBS test connection succeeded.") };
    } catch (error) {
      try {
        client.disconnect();
      } catch {}
      return { ok: false, status: status("error", true, sanitizeError(error)) };
    }
  }

  private async connect(settings: IntegrationSettings) {
    if (!this.running || this.connecting) return;

    this.connecting = true;
    this.currentStatus = status("connecting", true, "Connecting to OBS WebSocket...");
    this.disconnect();

    const client = new OBSWebSocket();
    this.client = client;

    onObsEvent(client, "ConnectionClosed", () => {
      if (!this.running || this.client !== client) return;
      this.client = null;
      this.currentStatus = status("error", true, "OBS WebSocket connection closed.");
      this.scheduleReconnect();
    });

    onObsEvent(client, "ConnectionError", (error) => {
      if (!this.running || this.client !== client) return;
      this.currentStatus = status("error", true, sanitizeError(error));
      this.scheduleReconnect();
    });

    try {
      await client.connect(obsUrl(settings), this.getPassword() ?? undefined);
      this.reconnectAttempt = 0;
      this.currentStatus = status("connected", true, "Connected to OBS WebSocket.");
    } catch (error) {
      if (this.client === client) this.client = null;
      this.currentStatus = status("error", true, sanitizeError(error));
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? 30_000;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.refresh();
    }, delay);
  }

  private disconnect() {
    const client = this.client;
    this.client = null;
    if (!client) return;

    try {
      client.disconnect();
    } catch {}
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private getSettings() {
    return this.settingsRepository.getRuntimeSettings().integrations.obs;
  }

  private getPassword() {
    return this.settingsRepository.getSecretStore().getSecret("obs", "password");
  }
}
