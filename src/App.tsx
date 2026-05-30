import { useState, useEffect } from "react";
import "./index.css";

import { fmtUptime } from "./utils";
import { useProduction } from "./production/useProduction";

import { Header } from "./components/Header";
import { CurrentSlide, NextSlide } from "./components/SlidePanels";
import { StreamHealth } from "./components/StreamHealth";
import { ServiceOrder } from "./components/ServiceOrder";
import type { ServiceOrderRow } from "./components/ServiceOrder";
import { PcoTimer } from "./components/PcoTimer";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { ChatPanel } from "./components/ChatPanel";
import { PlaylistStrip } from "./components/PlaylistStrip";
import {
  TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle,
  useTweaks, type TweakValues,
} from "./components/TweaksPanel";

const TWEAK_DEFAULTS: TweakValues = {
  accent: "#3d7dff",
  density: "comfortable",
  showChat: true,
  health: "healthy",
  liveData: true,
};

const ACCENTS = ["#3d7dff", "#8b5cf6", "#22d3ee", "#34d399"];

function tone(v: number, goodAbove: number, warnAbove: number, invert = false): string {
  if (invert) {
    if (v < goodAbove) return "#34d399";
    if (v < warnAbove) return "#f0b429";
    return "#ff5c5c";
  }
  if (v >= goodAbove) return "#34d399";
  if (v >= warnAbove) return "#f0b429";
  return "#ff5c5c";
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { snapshot, actions } = useProduction({ health: t.health, liveData: t.liveData });

  const [now, setNow] = useState(new Date());
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const liveData = snapshot.mode === "live" ? true : t.liveData;
  const total = snapshot.slides.slides.length;

  // clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeSvc = Math.max(0, snapshot.serviceOrder.items.findIndex((it) => it.id === snapshot.servicePosition.serviceItemId));
  const svcItems: ServiceOrderRow[] = snapshot.serviceOrder.items.map((it, i) => ({
    id: it.id,
    icon: it.icon,
    name: it.name,
    dur: formatDuration(it.durationSeconds),
    status: i < activeSvc ? "done" : i === activeSvc ? "active" : i === activeSvc + 1 ? "next" : "upcoming",
  }));

  const playlist = snapshot.serviceOrder.items.map((it) => ({
    id: it.id,
    icon: it.icon,
    name: it.name,
    slides: it.slideCount,
  }));

  const bitratePct = Math.round((snapshot.streamHealth.bitrateKbps / snapshot.streamHealth.targetBitrateKbps) * 100);
  const droppedCount = Math.round(snapshot.streamHealth.totalFrames * (snapshot.streamHealth.droppedFramesPct / 100));
  const metrics = {
    bitrate: snapshot.streamHealth.bitrateKbps.toLocaleString(),
    bitratePct,
    bitrateTone: tone(bitratePct, 85, 55) as string,
    dropped: snapshot.streamHealth.droppedFramesPct.toFixed(2),
    droppedTone: tone(snapshot.streamHealth.droppedFramesPct, 0.5, 2.0, true) as string,
    droppedCount,
    totalFrames: snapshot.streamHealth.totalFrames.toLocaleString(),
    cpu: snapshot.streamHealth.encoderLoadPct,
    cpuTone: snapshot.streamHealth.encoderLoadPct < 70 ? "#34d399" : snapshot.streamHealth.encoderLoadPct < 85 ? "#f0b429" : "#ff5c5c",
    uptime: fmtUptime(snapshot.streamHealth.uptimeSeconds),
  };

  const accent = t.accent;
  const nextSvc = snapshot.serviceOrder.items[Math.min(activeSvc + 1, snapshot.serviceOrder.items.length - 1)];
  const song = {
    presentation: snapshot.slides.presentation,
    arrangement: snapshot.slides.arrangement,
    slides: snapshot.slides.slides,
  };
  const healthLabel = snapshot.streamHealth.state.toUpperCase();
  const healthColor = snapshot.streamHealth.state === "healthy" ? "#34d399" : snapshot.streamHealth.state === "degraded" ? "#f0b429" : "#ff5c5c";

  return (
    <div
      className={"sd-root sd-density-" + t.density + (t.showChat ? "" : " sd-nochat")}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Header now={now} viewers={snapshot.viewerCount} resolution="1080p · 30fps" live={liveData} />

      <main className="sd-grid">
        {/* LEFT */}
        <div className="sd-col sd-col-left">
          <CurrentSlide
            song={song}
            slide={snapshot.slides.slides[snapshot.slides.currentIndex]!}
            idx={snapshot.slides.currentIndex}
            total={total}
            accent={accent}
            live={snapshot.slides.live}
          />
          <NextSlide
            song={song}
            slide={snapshot.slides.slides[snapshot.slides.nextIndex]!}
            idx={snapshot.slides.nextIndex}
            total={total}
            accent={accent}
          />
        </div>

        {/* MIDDLE */}
        <div className="sd-col sd-col-mid">
          <StreamHealth metrics={metrics} healthLabel={healthLabel} healthColor={healthColor} />
          <ServiceOrder items={svcItems} accent={accent} onSelectItem={actions.setServicePosition} />
        </div>

        {/* RIGHT */}
        <div className="sd-col sd-col-right">
          <PcoTimer seconds={snapshot.serviceTiming.remainingSeconds} nextName={nextSvc?.name ?? "End of Service"} accent={accent} />
          <ConnectionStatus rows={snapshot.connections} />
          {t.showChat && (
            <ChatPanel
              messages={snapshot.chatMessages}
              collapsed={chatCollapsed}
              onToggle={() => setChatCollapsed((v) => !v)}
              accent={accent}
            />
          )}
        </div>
      </main>

      <PlaylistStrip items={playlist} activeIdx={activeSvc} accent={accent} />

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v as TweakValues["density"])} />
        <TweakToggle label="Show chat panel" value={t.showChat} onChange={(v) => setTweak("showChat", v)} />
        <TweakSection label="Simulation" />
        <TweakRadio label="Stream health" value={t.health} options={["healthy", "degraded", "critical"]} onChange={(v) => setTweak("health", v as TweakValues["health"])} />
        <TweakToggle label="Live data" value={t.liveData} onChange={(v) => setTweak("liveData", v)} />
        {snapshot.simulation && (
          <TweakToggle
            label="Auto-advance service"
            value={snapshot.simulation.serviceAutoAdvanceEnabled}
            onChange={(v) => v ? actions.enableServiceAutoAdvance() : actions.disableServiceAutoAdvance()}
          />
        )}
      </TweaksPanel>
    </div>
  );
}

export default App;
