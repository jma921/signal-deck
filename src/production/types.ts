export type ProductionMode = "simulation" | "live";
export type ServiceItemSource = "simulation" | "pco";
export type ServicePositionUpdatedBy = "operator" | "simulation" | "system";
export type TimingState = "running" | "paused" | "stopped";
export type ConnectionState = "ok" | "warn" | "err";
export type ChatPlatform = "YT" | "FB";
export type StreamHealthState = "healthy" | "degraded" | "critical";

export interface Slide {
  label: string;
  lines: string[];
}

export interface ServiceOrderItem {
  id: string;
  source: ServiceItemSource;
  type: string;
  icon: string;
  name: string;
  durationSeconds: number | null;
  slideCount: number;
}

export interface ServiceOrder {
  source: ServiceItemSource;
  items: ServiceOrderItem[];
  stale: boolean;
  lastSyncedAt: string | null;
}

export interface ServicePosition {
  serviceItemId: string;
  updatedAt: string;
  updatedBy: ServicePositionUpdatedBy;
}

export interface ServiceTiming {
  serviceItemId: string;
  startedAt: string | null;
  plannedDurationSeconds: number | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  state: TimingState;
}

export interface SlideState {
  presentation: string;
  arrangement: string;
  slides: Slide[];
  currentIndex: number;
  nextIndex: number;
  live: boolean;
}

export interface StreamHealth {
  state: StreamHealthState;
  bitrateKbps: number;
  targetBitrateKbps: number;
  droppedFramesPct: number;
  encoderLoadPct: number;
  uptimeSeconds: number;
  totalFrames: number;
}

export interface Connection {
  id: string;
  name: string;
  status: string;
  state: ConnectionState;
}

export interface ChatMessage {
  id: string;
  platform: ChatPlatform;
  author: string;
  text: string;
  time: string;
}

export interface SimulationState {
  serviceAutoAdvanceEnabled: boolean;
}

export interface ProductionSnapshot {
  mode: ProductionMode;
  serviceOrder: ServiceOrder;
  servicePosition: ServicePosition;
  serviceTiming: ServiceTiming;
  slides: SlideState;
  streamHealth: StreamHealth;
  connections: Connection[];
  chatMessages: ChatMessage[];
  viewerCount: number;
  simulation: SimulationState | null;
  updatedAt: string;
}

export interface ProductionActions {
  setServicePosition: (serviceItemId: string) => void;
  advanceServicePosition: () => void;
  retreatServicePosition: () => void;
  enableServiceAutoAdvance: () => void;
  disableServiceAutoAdvance: () => void;
}

export interface ProductionState {
  snapshot: ProductionSnapshot;
  actions: ProductionActions;
}
