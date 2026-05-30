import { CHAT_SEED, HEALTH, SERVICE, SLIDE_COUNTS, SONG } from "../data";
import { IntegrationManager } from "../integrations/integrationManager";
import type { IntegrationRuntimeState } from "../integrations/types";
import type { SettingsRepository } from "../runtime/settingsRepository";
import type {
  ChatMessage,
  Connection,
  ProductionSnapshot,
  ServiceOrder,
  ServiceOrderItem,
  ServicePositionUpdatedBy,
  StreamHealth,
} from "./types";

type Listener = (snapshot: ProductionSnapshot) => void;

const STATUS_LABELS: Record<IntegrationRuntimeState, string> = {
  disabled: "Unconfigured",
  "missing-config": "Missing config",
  connecting: "Connecting",
  connected: "Connected",
  error: "Error",
};

const CONNECTION_NAMES = {
  propresenter: "ProPresenter 7",
  pco: "PCO Services",
  obs: "OBS Encoder",
} as const;

function nowIso() {
  return new Date().toISOString();
}

function simulationItems(): ServiceOrderItem[] {
  return SERVICE.map((item, index) => ({
    id: item.id,
    source: "simulation",
    type: item.type,
    icon: item.icon,
    name: item.name,
    durationSeconds: item.durationSeconds,
    slideCount: SLIDE_COUNTS[index] ?? 1,
  }));
}

function simulationOrder(): ServiceOrder {
  return {
    source: "simulation",
    items: simulationItems(),
    stale: false,
    lastSyncedAt: null,
  };
}

function simulationHealth(): StreamHealth {
  return {
    state: "healthy",
    bitrateKbps: HEALTH.healthy.bitrate,
    targetBitrateKbps: 6500,
    droppedFramesPct: HEALTH.healthy.dropped,
    encoderLoadPct: HEALTH.healthy.cpu,
    uptimeSeconds: 0,
    totalFrames: 0,
  };
}

function simulationChat(): ChatMessage[] {
  return CHAT_SEED.map((message, index) => ({
    id: `seed-${index + 1}`,
    platform: message.plat,
    author: message.author,
    text: message.text,
    time: message.time,
  }));
}

function connectionState(state: IntegrationRuntimeState): Connection["state"] {
  if (state === "connected") return "ok";
  if (state === "connecting" || state === "missing-config" || state === "disabled") return "warn";
  return "err";
}

function normalizeChat(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.time.localeCompare(b.time)).slice(-80);
}

export class ServerProductionStore {
  private readonly integrationManager: IntegrationManager;
  private readonly listeners = new Set<Listener>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private serviceItemId: string | null = null;
  private positionUpdatedAt = nowIso();
  private positionUpdatedBy: ServicePositionUpdatedBy = "system";
  private timingStartedAt = Date.now();

  constructor(private readonly settingsRepository: SettingsRepository) {
    this.integrationManager = new IntegrationManager(settingsRepository, () => this.emit());
  }

  start() {
    this.integrationManager.start();
    this.tickTimer = setInterval(() => this.emit(), 1_000);
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.integrationManager.stop();
  }

  getIntegrationManager(): IntegrationManager {
    return this.integrationManager;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ProductionSnapshot {
    const settings = this.settingsRepository.getRuntimeSettings();
    const data = this.integrationManager.getData();
    const pcoSettings = settings.integrations.pco;
    const liveOrderUnavailable = settings.app.mode === "live" && pcoSettings.enabled && !data.serviceOrder;
    const serviceOrder = data.serviceOrder
      ?? (liveOrderUnavailable ? { source: "pco", items: [], stale: true, lastSyncedAt: null } satisfies ServiceOrder : simulationOrder());
    const items = serviceOrder.items;
    const serviceItemId = this.serviceItemId ?? items[3]?.id ?? items[0]?.id ?? "";
    const activeItem = items.find((item) => item.id === serviceItemId) ?? items[0] ?? null;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.timingStartedAt) / 1000));
    const plannedDurationSeconds = activeItem?.durationSeconds ?? null;

    return {
      mode: settings.app.mode,
      serviceOrder,
      servicePosition: {
        serviceItemId,
        updatedAt: this.positionUpdatedAt,
        updatedBy: this.positionUpdatedBy,
      },
      serviceTiming: {
        serviceItemId,
        startedAt: new Date(this.timingStartedAt).toISOString(),
        plannedDurationSeconds,
        elapsedSeconds,
        remainingSeconds: plannedDurationSeconds == null ? null : plannedDurationSeconds - elapsedSeconds,
        state: activeItem ? "running" : "stopped",
      },
      slides: {
        presentation: SONG.presentation,
        arrangement: SONG.arrangement,
        slides: SONG.slides,
        currentIndex: 2,
        nextIndex: 3,
        live: settings.app.mode === "live",
      },
      streamHealth: simulationHealth(),
      connections: this.connections(),
      chatMessages: normalizeChat(simulationChat()),
      viewerCount: 0,
      simulation: settings.app.mode === "simulation" ? { serviceAutoAdvanceEnabled: false } : null,
      updatedAt: nowIso(),
    };
  }

  setServicePosition(serviceItemId: string, updatedBy: ServicePositionUpdatedBy = "operator") {
    const snapshot = this.getSnapshot();
    if (!snapshot.serviceOrder.items.some((item) => item.id === serviceItemId)) return false;
    this.serviceItemId = serviceItemId;
    this.positionUpdatedAt = nowIso();
    this.positionUpdatedBy = updatedBy;
    this.timingStartedAt = Date.now();
    this.emit();
    return true;
  }

  advanceServicePosition() {
    const snapshot = this.getSnapshot();
    const index = snapshot.serviceOrder.items.findIndex((item) => item.id === snapshot.servicePosition.serviceItemId);
    const next = snapshot.serviceOrder.items[Math.min(index + 1, snapshot.serviceOrder.items.length - 1)];
    return next ? this.setServicePosition(next.id) : false;
  }

  retreatServicePosition() {
    const snapshot = this.getSnapshot();
    const index = snapshot.serviceOrder.items.findIndex((item) => item.id === snapshot.servicePosition.serviceItemId);
    const prev = snapshot.serviceOrder.items[Math.max(index - 1, 0)];
    return prev ? this.setServicePosition(prev.id) : false;
  }

  emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private connections(): Connection[] {
    return this.integrationManager.getStatuses().map((status) => ({
      id: status.integrationKey,
      name: CONNECTION_NAMES[status.integrationKey],
      status: status.message ?? STATUS_LABELS[status.state],
      state: connectionState(status.state),
    }));
  }
}
