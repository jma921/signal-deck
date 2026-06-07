import type { SettingsRepository } from "../../runtime/settingsRepository";
import type { ChatMessage, ChatPlatform } from "../../production/types";
import type { IntegrationStatus } from "../types";
import { integrationStatus, sanitizeError } from "../status";

const RECONNECT_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];
const MAX_CHAT_MESSAGES = 40;

// Social Stream Ninja sends a `type` field identifying the source platform.
// Map known platform identifiers to our ChatPlatform codes.
const PLATFORM_MAP: Record<string, ChatPlatform> = {
  youtube: "YT",
  facebook: "FB",
  fb: "FB",
  yt: "YT",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parsePlatform(type: unknown): ChatPlatform | null {
  const key = asString(type).toLowerCase();
  return PLATFORM_MAP[key] ?? null;
}

function parseMessage(raw: Record<string, unknown>, receivedAt: string): ChatMessage | null {
  const platform = parsePlatform(raw.type);
  if (!platform) return null;
  const text = asString(raw.chatmessage).trim();
  if (!text) return null;
  return {
    id: asString(raw.id) || `ss-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platform,
    author: asString(raw.chatname) || "Viewer",
    text,
    time: receivedAt,
  };
}

export class SocialStreamManager {
  private currentStatus: IntegrationStatus = integrationStatus("socialstream", "disabled", false, "Social Stream integration is disabled.");
  private messages: ChatMessage[] = [];
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private running = false;

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly onChange: () => void,
  ) {}

  start() {
    this.running = true;
    void this.refresh();
  }

  stop() {
    this.running = false;
    this.clearReconnectTimer();
    this.closeSocket();
    this.reconnectAttempt = 0;
    this.messages = [];
    this.currentStatus = integrationStatus("socialstream", "disabled", false, "Social Stream integration stopped.");
  }

  getStatus(): IntegrationStatus {
    return this.currentStatus;
  }

  getChatMessages(): ChatMessage[] | null {
    return this.currentStatus.state === "connected" ? this.messages : null;
  }

  // Stub for future Reply and Broadcast features.
  // - Omit platform to broadcast to all connected platforms.
  // - Pass a platform to reply only to that platform's chat.
  sendChat(_text: string, _platform?: ChatPlatform): void {
    // Not yet wired to the UI. Implementation: send JSON over this.ws.
  }

  async refresh(): Promise<IntegrationStatus> {
    const settings = this.settingsRepository.getRuntimeSettings().integrations.socialstream;

    if (!settings.enabled) {
      this.clearReconnectTimer();
      this.closeSocket();
      this.reconnectAttempt = 0;
      this.messages = [];
      this.currentStatus = integrationStatus("socialstream", "disabled", false, "Social Stream integration is disabled.");
      this.emit();
      return this.currentStatus;
    }

    const sessionId = this.settingsRepository.getSecretStore().getSecret("socialstream", "sessionId");
    if (!sessionId) {
      this.clearReconnectTimer();
      this.closeSocket();
      this.reconnectAttempt = 0;
      this.currentStatus = integrationStatus("socialstream", "missing-config", true, "Social Stream session ID is required.");
      this.emit();
      return this.currentStatus;
    }

    this.connect(sessionId);
    return this.currentStatus;
  }

  private connect(sessionId: string) {
    if (!this.running || this.ws) return;

    this.currentStatus = integrationStatus("socialstream", "connecting", true, "Connecting to Social Stream...");
    this.emit();

    let ws: WebSocket;
    try {
      ws = new WebSocket(`wss://io.socialstream.ninja/join/${sessionId}`);
    } catch (error) {
      this.handleDisconnect(sanitizeError(error, "Failed to open Social Stream WebSocket."));
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempt = 0;
      this.currentStatus = integrationStatus("socialstream", "connected", true, "Connected to Social Stream.");
      this.emit();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const raw = JSON.parse(typeof event.data === "string" ? event.data : "") as Record<string, unknown>;
        const time = new Date().toTimeString().slice(0, 5);
        const message = parseMessage(raw, time);
        if (!message) return;
        this.messages = [...this.messages, message].slice(-MAX_CHAT_MESSAGES);
        this.emit();
      } catch {
        // Ignore malformed frames.
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.handleDisconnect("Social Stream connection error.");
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.handleDisconnect("Social Stream connection closed.");
    };
  }

  private handleDisconnect(message: string) {
    if (!this.running) return;
    this.closeSocket();
    this.messages = [];
    this.currentStatus = integrationStatus("socialstream", "error", true, message);
    this.emit();
    this.scheduleReconnect();
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

  private closeSocket() {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    try {
      ws.close();
    } catch {}
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private emit() {
    this.onChange();
  }
}
