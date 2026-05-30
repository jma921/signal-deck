import type { SettingsRepository } from "../../runtime/settingsRepository";
import type { IntegrationSettings } from "../../runtime/settings";
import type { ServiceOrder, ServiceOrderItem } from "../../production/types";
import type { IntegrationStatus } from "../types";
import { integrationStatus, nowIso, sanitizeError } from "../status";

const DEFAULT_BASE_URL = "https://api.planningcenteronline.com";
const DEFAULT_POLL_SECONDS = 60;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function iconForType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("song")) return "♪";
  if (normalized.includes("prayer")) return "+";
  if (normalized.includes("scripture")) return "§";
  if (normalized.includes("media") || normalized.includes("video")) return "▶";
  if (normalized.includes("sermon") || normalized.includes("message")) return "◎";
  return "•";
}

interface PcoItemResource {
  id: string;
  attributes?: {
    title?: string | null;
    item_type?: string | null;
    length?: number | null;
    sequence?: number | null;
  };
}

interface PcoItemsResponse {
  data?: PcoItemResource[];
}

export class PcoManager {
  private currentStatus: IntegrationStatus = integrationStatus("pco", "disabled", false, "PCO Services integration is disabled.");
  private currentServiceOrder: ServiceOrder | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.clearRefreshTimer();
    this.currentStatus = integrationStatus("pco", "disabled", false, "PCO Services integration stopped.");
  }

  getStatus(): IntegrationStatus {
    return this.currentStatus;
  }

  getServiceOrder(): ServiceOrder | null {
    return this.currentServiceOrder;
  }

  async refresh(): Promise<IntegrationStatus> {
    const settings = this.getSettings();
    this.clearRefreshTimer();

    if (!settings.enabled) {
      this.currentStatus = integrationStatus("pco", "disabled", false, "PCO Services integration is disabled.");
      this.emit();
      return this.currentStatus;
    }

    const serviceTypeId = asString(settings.extra.serviceTypeId);
    const planId = asString(settings.extra.planId);
    const clientId = asString(settings.extra.clientId);
    const secret = this.getSecret();
    if (!serviceTypeId || !planId || !clientId || !secret) {
      this.currentStatus = integrationStatus("pco", "missing-config", true, "PCO Services client ID, secret, service type, and plan are required.");
      this.markStale();
      this.emit();
      this.scheduleRefresh(settings);
      return this.currentStatus;
    }

    this.currentStatus = integrationStatus("pco", "connecting", true, "Refreshing PCO Services Service Order...");
    this.emit();

    try {
      const items = await this.fetchItems(settings, serviceTypeId, planId, clientId, secret);
      this.currentServiceOrder = {
        source: "pco",
        items,
        stale: false,
        lastSyncedAt: nowIso(),
      };
      this.currentStatus = integrationStatus("pco", "connected", true, `Synced ${items.length} Service Items from PCO Services.`);
    } catch (error) {
      this.currentStatus = integrationStatus("pco", "error", true, sanitizeError(error, "PCO Services request failed."));
      this.markStale();
    }

    this.emit();
    this.scheduleRefresh(settings);
    return this.currentStatus;
  }

  private async fetchItems(settings: IntegrationSettings, serviceTypeId: string, planId: string, clientId: string, secret: string): Promise<ServiceOrderItem[]> {
    const baseUrl = asString(settings.extra.baseUrl) ?? DEFAULT_BASE_URL;
    const url = new URL(`/services/v2/service_types/${serviceTypeId}/plans/${planId}/items`, baseUrl);
    url.searchParams.set("per_page", "100");

    const res = await fetch(url, {
      headers: {
        "Authorization": this.authorizationHeader(clientId, secret),
        "Accept": "application/json",
      },
    });

    if (!res.ok) throw new Error(`PCO Services returned ${res.status}.`);

    const body = await res.json() as PcoItemsResponse;
    const resources = body.data ?? [];
    return resources
      .map((item, index) => this.mapItem(item, index))
      .filter((item): item is ServiceOrderItem => item != null);
  }

  private mapItem(item: PcoItemResource, index: number): ServiceOrderItem | null {
    const attrs = item.attributes ?? {};
    const name = attrs.title?.trim();
    if (!name) return null;
    const type = attrs.item_type?.trim() || "item";
    const durationSeconds = typeof attrs.length === "number" && attrs.length > 0 ? attrs.length : null;
    return {
      id: `pco-${item.id}`,
      source: "pco",
      type,
      icon: iconForType(type),
      name,
      durationSeconds,
      slideCount: 1,
    };
  }

  private authorizationHeader(clientId: string, secret: string): string {
    return `Basic ${btoa(`${clientId}:${secret}`)}`;
  }

  private getSecret(): string | null {
    return this.settingsRepository.getSecretStore().getSecret("pco", "secret");
  }

  private scheduleRefresh(settings: IntegrationSettings) {
    if (!this.running) return;
    const seconds = asNumber(settings.extra.pollSeconds, DEFAULT_POLL_SECONDS);
    this.refreshTimer = setTimeout(() => void this.refresh(), seconds * 1000);
  }

  private markStale() {
    if (!this.currentServiceOrder) return;
    this.currentServiceOrder = { ...this.currentServiceOrder, stale: true };
  }

  private clearRefreshTimer() {
    if (!this.refreshTimer) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }

  private getSettings() {
    return this.settingsRepository.getRuntimeSettings().integrations.pco;
  }

  private emit() {
    this.onChange();
  }
}
