import { Dot, Panel } from "./atoms";

interface Metrics {
  bitrate: string;
  bitratePct: number;
  bitrateTone: string;
  dropped: string;
  droppedTone: string;
  droppedCount: number;
  totalFrames: string;
  cpu: number;
  cpuTone: string;
  uptime: string;
}

function MetricTile({
  label,
  value,
  unit,
  sub,
  tone,
  bar,
  pulse,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub: string;
  tone: string;
  bar?: number;
  pulse?: boolean;
}) {
  return (
    <div className="sd-tile">
      <div className="sd-tile-lbl">{label}</div>
      <div className="sd-tile-val" style={{ color: tone }}>
        <span className={"sd-tile-num" + (pulse ? " sd-livepulse" : "")}>{value}</span>
        {unit && <span className="sd-tile-unit">{unit}</span>}
      </div>
      {bar != null && (
        <div className="sd-tile-bar">
          <div className="sd-tile-bar-fill" style={{ width: bar + "%", background: tone }} />
        </div>
      )}
      <div className="sd-tile-sub">{sub}</div>
    </div>
  );
}

export function StreamHealth({
  metrics,
  healthLabel,
  healthColor,
}: {
  metrics: Metrics;
  healthLabel: string;
  healthColor: string;
}) {
  return (
    <Panel
      title="Stream Health"
      right={
        <span className="sd-hd-live">
          <Dot color={healthColor} className="sd-pulse" />
          <span style={{ color: healthColor }}>{healthLabel}</span>
        </span>
      }
      bodyClass="sd-health"
    >
      <MetricTile
        label="BITRATE"
        value={metrics.bitrate}
        unit="kbps"
        sub={`target 6500 · ${metrics.bitratePct}%`}
        tone={metrics.bitrateTone}
        bar={metrics.bitratePct}
        pulse
      />
      <MetricTile
        label="DROPPED FRAMES"
        value={metrics.dropped}
        unit="%"
        sub={`${metrics.droppedCount} of ${metrics.totalFrames} frames`}
        tone={metrics.droppedTone}
        pulse
      />
      <MetricTile
        label="CPU ENCODE"
        value={metrics.cpu}
        unit="%"
        sub="x264 · veryfast"
        tone={metrics.cpuTone}
        bar={metrics.cpu}
        pulse
      />
      <MetricTile
        label="UPTIME"
        value={metrics.uptime}
        sub="since 09:00:12 AM"
        tone="#e6e9f0"
      />
    </Panel>
  );
}
