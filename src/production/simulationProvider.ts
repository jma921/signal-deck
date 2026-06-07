import { useCallback, useEffect, useMemo, useState } from "react";
import { clamp } from "../utils";
import { CHAT_SCRIPT, CHAT_SEED, CONNECTIONS, HEALTH, SERVICE, SLIDE_COUNTS, SONG } from "../data";
import type {
  ChatMessage,
  Connection,
  ProductionActions,
  ProductionSnapshot,
  ProductionState,
  ServiceOrderItem,
  ServicePositionUpdatedBy,
  StreamHealthState,
} from "./types";

export interface SimulationProviderOptions {
  health: StreamHealthState;
  liveData: boolean;
}

function nowIso() {
  return new Date().toISOString();
}

function timeLabel(d: Date) {
  return `${String(d.getHours() % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function connectionRows(state: StreamHealthState): Connection[] {
  const base = CONNECTIONS.map((r, i) => ({ id: `conn-${i + 1}`, ...r }));
  if (state === "degraded") {
    base[2] = { id: "conn-3", name: "YouTube Live", status: "Buffering", state: "warn" };
  } else if (state === "critical") {
    base[2] = { id: "conn-3", name: "YouTube Live", status: "Frames dropped", state: "err" };
    base[3] = { id: "conn-4", name: "Facebook Live", status: "Reconnecting", state: "err" };
  }
  return base;
}

function serviceItems(): ServiceOrderItem[] {
  return SERVICE.map((item, i) => ({
    id: item.id,
    source: "simulation",
    type: item.type,
    icon: item.icon,
    name: item.name,
    durationSeconds: item.durationSeconds,
    slideCount: SLIDE_COUNTS[i] ?? 1,
  }));
}

function chatSeed(): ChatMessage[] {
  return CHAT_SEED.map((m, i) => ({
    id: `seed-${i + 1}`,
    platform: m.plat,
    author: m.author,
    text: m.text,
    time: m.time,
  }));
}

export function useSimulationProduction({ health, liveData }: SimulationProviderOptions): ProductionState {
  const items = useMemo(() => serviceItems(), []);
  const initialItemId = items[3]?.id ?? items[0]?.id ?? "";

  const [tick, setTick] = useState(Date.now());
  const [slideIdx, setSlideIdx] = useState(2);
  const [serviceItemId, setServiceItemId] = useState(initialItemId);
  const [positionUpdatedAt, setPositionUpdatedAt] = useState(nowIso);
  const [positionUpdatedBy, setPositionUpdatedBy] = useState<ServicePositionUpdatedBy>("simulation");
  const [timingStartedAt, setTimingStartedAt] = useState(Date.now());
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [uptime, setUptime] = useState(5050);
  const [bitrate, setBitrate] = useState(HEALTH.healthy.bitrate);
  const [dropped, setDropped] = useState(HEALTH.healthy.dropped);
  const [cpu, setCpu] = useState(HEALTH.healthy.cpu);
  const [viewers, setViewers] = useState(842);
  const [chat, setChat] = useState<ChatMessage[]>(chatSeed);

  const activeIdx = Math.max(0, items.findIndex((item) => item.id === serviceItemId));
  const activeItem = items[activeIdx] ?? items[0];

  const moveToServiceItem = useCallback((id: string, updatedBy: ServicePositionUpdatedBy) => {
    if (!items.some((item) => item.id === id)) return;
    setServiceItemId(id);
    setPositionUpdatedAt(nowIso());
    setPositionUpdatedBy(updatedBy);
    setTimingStartedAt(Date.now());
  }, [items]);

  const setServicePosition = useCallback((id: string) => {
    setAutoAdvance(false);
    moveToServiceItem(id, "operator");
  }, [moveToServiceItem]);

  const advanceServicePosition = useCallback(() => {
    const next = items[Math.min(activeIdx + 1, items.length - 1)];
    if (next) setServicePosition(next.id);
  }, [activeIdx, items, setServicePosition]);

  const retreatServicePosition = useCallback(() => {
    const prev = items[Math.max(activeIdx - 1, 0)];
    if (prev) setServicePosition(prev.id);
  }, [activeIdx, items, setServicePosition]);

  useEffect(() => {
    const cfg = HEALTH[health] ?? HEALTH.healthy;
    setBitrate(cfg.bitrate);
    setDropped(cfg.dropped);
    setCpu(cfg.cpu);
  }, [health]);

  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [liveData]);

  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => {
      setUptime((u) => u + 1);
      setViewers((v) => clamp(v + Math.round((Math.random() - 0.45) * 6), 600, 1500));
    }, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  useEffect(() => {
    if (!liveData) return;
    const cfg = HEALTH[health] ?? HEALTH.healthy;
    const id = setInterval(() => {
      setBitrate(() => clamp(Math.round(cfg.bitrate + (Math.random() - 0.5) * cfg.jit), 400, 6800));
      setDropped(() => clamp(+(cfg.dropped + (Math.random() - 0.5) * (cfg.dropped * 0.6 + 0.02)).toFixed(2), 0, 12));
      setCpu(() => clamp(Math.round(cfg.cpu + (Math.random() - 0.5) * 7), 5, 100));
    }, 1200);
    return () => clearInterval(id);
  }, [health, liveData]);

  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % SONG.slides.length), 8500);
    return () => clearInterval(id);
  }, [liveData]);

  useEffect(() => {
    if (!liveData || !autoAdvance || !activeItem || !activeItem.durationSeconds) return;
    const elapsedSeconds = Math.floor((tick - timingStartedAt) / 1000);
    if (elapsedSeconds < activeItem.durationSeconds) return;
    const next = items[Math.min(activeIdx + 1, items.length - 1)];
    if (next && next.id !== activeItem.id) moveToServiceItem(next.id, "simulation");
  }, [activeIdx, activeItem, autoAdvance, items, liveData, moveToServiceItem, tick, timingStartedAt]);

  useEffect(() => {
    if (!liveData) return;
    let n = 0;
    const id = setInterval(() => {
      const src = CHAT_SCRIPT[n % CHAT_SCRIPT.length];
      n++;
      if (!src) return;
      const d = new Date();
      setChat((c) => [...c.slice(-40), {
        id: `script-${Date.now()}-${n}`,
        platform: src.plat!,
        author: src.author!,
        text: src.text!,
        time: timeLabel(d),
      }]);
    }, 6500);
    return () => clearInterval(id);
  }, [liveData]);

  const elapsedSeconds = liveData ? Math.max(0, Math.floor((tick - timingStartedAt) / 1000)) : Math.max(0, Math.floor((Date.now() - timingStartedAt) / 1000));
  const plannedDurationSeconds = activeItem?.durationSeconds ?? null;
  const remainingSeconds = plannedDurationSeconds == null ? null : plannedDurationSeconds - elapsedSeconds;

  const snapshot: ProductionSnapshot = useMemo(() => ({
    mode: "simulation",
    serviceOrder: {
      source: "simulation",
      items,
      stale: false,
      lastSyncedAt: null,
    },
    servicePosition: {
      serviceItemId,
      updatedAt: positionUpdatedAt,
      updatedBy: positionUpdatedBy,
    },
    serviceTiming: {
      serviceItemId,
      startedAt: new Date(timingStartedAt).toISOString(),
      plannedDurationSeconds,
      elapsedSeconds,
      remainingSeconds,
      state: "running",
    },
    slides: {
      presentation: SONG.presentation,
      currentText: SONG.slides[slideIdx]?.lines.join("\n") ?? "",
      currentLabel: SONG.slides[slideIdx]?.label ?? "",
      nextText: SONG.slides[(slideIdx + 1) % SONG.slides.length]?.lines.join("\n") ?? "",
      nextLabel: SONG.slides[(slideIdx + 1) % SONG.slides.length]?.label ?? "",
      live: liveData,
    },
    streamHealth: {
      state: health,
      bitrateKbps: bitrate,
      targetBitrateKbps: 6500,
      droppedFramesPct: dropped,
      encoderLoadPct: cpu,
      uptimeSeconds: uptime,
      totalFrames: 18420,
    },
    connections: connectionRows(health),
    chatMessages: chat,
    viewerCount: viewers,
    simulation: {
      serviceAutoAdvanceEnabled: autoAdvance,
    },
    updatedAt: new Date(tick).toISOString(),
  }), [autoAdvance, bitrate, chat, cpu, dropped, elapsedSeconds, health, items, liveData, plannedDurationSeconds, positionUpdatedAt, positionUpdatedBy, remainingSeconds, serviceItemId, slideIdx, tick, timingStartedAt, uptime, viewers]);

  const actions: ProductionActions = useMemo(() => ({
    setServicePosition,
    advanceServicePosition,
    retreatServicePosition,
    enableServiceAutoAdvance: () => setAutoAdvance(true),
    disableServiceAutoAdvance: () => setAutoAdvance(false),
  }), [advanceServicePosition, retreatServicePosition, setServicePosition]);

  return { snapshot, actions };
}
