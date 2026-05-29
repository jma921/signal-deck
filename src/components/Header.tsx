import { Dot } from "./atoms";
import { fmtClock } from "../utils";

export function Header({
  now,
  viewers,
  resolution,
  live,
}: {
  now: Date;
  viewers: number;
  resolution: string;
  live: boolean;
}) {
  return (
    <header className="sd-header">
      <div className="sd-brand">
        <span className="sd-brand-mark" aria-hidden="true">
          <span className="sd-brand-arc" />
          <span className="sd-brand-arc" />
          <span className="sd-brand-arc" />
        </span>
        <span className="sd-brand-name">
          Signal<span className="sd-brand-name-b">Deck</span>
        </span>
        <span className="sd-brand-sub">PRODUCTION</span>
      </div>

      <div className="sd-header-mid">
        <span className="sd-hmeta">
          <span className="sd-hmeta-k">SVC</span> Sunday · 11:00 AM
        </span>
        <span className="sd-hmeta">
          <span className="sd-hmeta-k">RES</span> {resolution}
        </span>
        <span className="sd-hmeta">
          <span className="sd-hmeta-k">VIEWERS</span> {viewers.toLocaleString()}
        </span>
      </div>

      <div className="sd-header-right">
        <span className={"sd-live-badge" + (live ? "" : " sd-live-off")}>
          <Dot color={live ? "#ff3d3d" : "#5a6072"} className={live ? "sd-pulse" : ""} />
          {live ? "LIVE" : "OFFLINE"}
        </span>
        <span className="sd-clock">{fmtClock(now)}</span>
      </div>
    </header>
  );
}
