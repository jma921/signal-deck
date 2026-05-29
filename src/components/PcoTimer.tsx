import { Dot, Panel } from "./atoms";
import { fmtCountdown } from "../utils";

export function PcoTimer({
  seconds,
  nextName,
  accent,
}: {
  seconds: number | null;
  nextName: string;
  accent: string;
}) {
  const urgent = seconds != null && seconds <= 60;
  const overtime = seconds != null && seconds < 0;
  const color = urgent ? "#ff5c5c" : "#f0b429";
  return (
    <Panel
      title="PCO Timer"
      right={
        <span className="sd-hd-live">
          <Dot color={color} className={urgent ? "sd-pulse" : ""} />
          <span style={{ color }}>{urgent ? "WRAP UP" : "RUNNING"}</span>
        </span>
      }
      bodyClass="sd-timer-body"
    >
      <div className="sd-timer-num" style={{ color }}>
        {seconds == null ? "--:--" : fmtCountdown(seconds)}
      </div>
      <div className="sd-timer-sub">{overtime ? "overtime on current item" : "time left on current item"}</div>
      <div className="sd-timer-next">
        <span className="sd-timer-arrow" style={{ color: accent }}>
          →
        </span>
        <span className="sd-timer-nextname">{nextName}</span>
      </div>
    </Panel>
  );
}
