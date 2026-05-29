import { useState, useEffect } from "react";
import "./index.css";

import { clamp, fmtUptime } from "./utils";
import {
  SONG, SERVICE, CONNECTIONS, CHAT_SEED, CHAT_SCRIPT, HEALTH, SLIDE_COUNTS,
  type ServiceItem, type ConnectionRow, type ChatMsg,
} from "./data";

import { Header } from "./components/Header";
import { CurrentSlide, NextSlide } from "./components/SlidePanels";
import { StreamHealth } from "./components/StreamHealth";
import { ServiceOrder } from "./components/ServiceOrder";
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

function connRows(state: string): ConnectionRow[] {
  const base = CONNECTIONS.map((r) => ({ ...r }));
  if (state === "degraded") {
    base[2] = { name: "YouTube Live", status: "Buffering", state: "warn" };
  } else if (state === "critical") {
    base[2] = { name: "YouTube Live", status: "Frames dropped", state: "err" };
    base[3] = { name: "Facebook Live", status: "Reconnecting", state: "err" };
  }
  return base;
}

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [now, setNow] = useState(new Date());
  const [slideIdx, setSlideIdx] = useState(2);
  const [activeSvc, setActiveSvc] = useState(3);
  const [pco, setPco] = useState(72);
  const [uptime, setUptime] = useState(5050);
  const [bitrate, setBitrate] = useState(HEALTH.healthy.bitrate);
  const [dropped, setDropped] = useState(HEALTH.healthy.dropped);
  const [cpu, setCpu] = useState(HEALTH.healthy.cpu);
  const [viewers, setViewers] = useState(842);
  const [chat, setChat] = useState<ChatMsg[]>(CHAT_SEED);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const liveData = t.liveData;
  const hcfg = (HEALTH[t.health] ?? HEALTH.healthy)!;
  const total = SONG.slides.length;

  useEffect(() => {
    const cfg = HEALTH[t.health] ?? HEALTH.healthy;
    setBitrate(cfg.bitrate);
    setDropped(cfg.dropped);
    setCpu(cfg.cpu);
  }, [t.health]);

  // clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // uptime + viewers
  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => {
      setUptime((u) => u + 1);
      setViewers((v) => clamp(v + Math.round((Math.random() - 0.45) * 6), 600, 1500));
    }, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  // metric jitter
  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => {
      setBitrate((b) => clamp(Math.round(hcfg.bitrate + (Math.random() - 0.5) * hcfg.jit), 400, 6800));
      setDropped((d) => clamp(+(hcfg.dropped + (Math.random() - 0.5) * (hcfg.dropped * 0.6 + 0.02)).toFixed(2), 0, 12));
      setCpu((c) => clamp(Math.round(hcfg.cpu + (Math.random() - 0.5) * 7), 5, 100));
    }, 1200);
    return () => clearInterval(id);
  }, [liveData, t.health]);

  // slide auto-advance
  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % total), 8500);
    return () => clearInterval(id);
  }, [liveData, total]);

  // PCO countdown + service advance
  useEffect(() => {
    if (!liveData) return;
    const id = setInterval(() => {
      setPco((s) => {
        if (s <= 1) {
          setActiveSvc((a) => Math.min(a + 1, SERVICE.length - 1));
          return 96;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  // scripted incoming chat
  useEffect(() => {
    if (!liveData) return;
    let n = 0;
    const id = setInterval(() => {
      const src = CHAT_SCRIPT[n % CHAT_SCRIPT.length];
      n++;
      const d = new Date();
      const time = `${String(d.getHours() % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (!src) return;
      setChat((c) => [...c.slice(-40), { plat: src.plat!, author: src.author!, text: src.text!, time }]);
    }, 6500);
    return () => clearInterval(id);
  }, [liveData]);

  const svcItems: ServiceItem[] = SERVICE.map((it, i) => ({
    ...it,
    status: i < activeSvc ? "done" : i === activeSvc ? "active" : i === activeSvc + 1 ? "next" : "upcoming",
  }));

  const playlist = svcItems.map((it, i) => ({ ...it, slides: SLIDE_COUNTS[i] ?? 1 }));

  const bitratePct = Math.round((bitrate / 6500) * 100);
  const metrics = {
    bitrate: bitrate.toLocaleString(),
    bitratePct,
    bitrateTone: tone(bitratePct, 85, 55) as string,
    dropped: dropped.toFixed(2),
    droppedTone: tone(dropped, 0.5, 2.0, true) as string,
    droppedCount: Math.round(dropped * 184.2),
    totalFrames: "18,420",
    cpu,
    cpuTone: cpu < 70 ? "#34d399" : cpu < 85 ? "#f0b429" : "#ff5c5c",
    uptime: fmtUptime(uptime),
  };

  const accent = t.accent;
  const nextSvc = SERVICE[Math.min(activeSvc + 1, SERVICE.length - 1)]!;

  return (
    <div
      className={"sd-root sd-density-" + t.density + (t.showChat ? "" : " sd-nochat")}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Header now={now} viewers={viewers} resolution="1080p · 30fps" live={liveData} />

      <main className="sd-grid">
        {/* LEFT */}
        <div className="sd-col sd-col-left">
          <CurrentSlide
            song={SONG}
            slide={SONG.slides[slideIdx]!}
            idx={slideIdx}
            total={total}
            accent={accent}
            live={liveData}
          />
          <NextSlide
            song={SONG}
            slide={SONG.slides[(slideIdx + 1) % total]!}
            idx={(slideIdx + 1) % total}
            total={total}
            accent={accent}
          />
        </div>

        {/* MIDDLE */}
        <div className="sd-col sd-col-mid">
          <StreamHealth metrics={metrics} healthLabel={hcfg.label} healthColor={hcfg.color} />
          <ServiceOrder items={svcItems} accent={accent} />
        </div>

        {/* RIGHT */}
        <div className="sd-col sd-col-right">
          <PcoTimer seconds={pco} nextName={nextSvc.name} accent={accent} />
          <ConnectionStatus rows={connRows(t.health)} />
          {t.showChat && (
            <ChatPanel
              messages={chat}
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
      </TweaksPanel>
    </div>
  );
}

export default App;
