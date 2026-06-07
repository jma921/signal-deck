import { Dot, Panel } from "./atoms";

function Stage({
  text,
  label,
  presentation,
  dim = false,
  accent,
  blankLabel = "",
}: {
  text: string;
  label: string;
  presentation: string;
  dim?: boolean;
  accent: string;
  blankLabel?: string;
}) {
  const lines = text.split("\n").filter((line) => line.length > 0);
  const blank = lines.length === 0;
  return (
    <div className={"sd-stage" + (dim ? " sd-stage--dim" : "")}>
      <div className="sd-stage-bg" />
      <div className="sd-stage-grain" />

      <div className="sd-stage-top">
        <span className="sd-chip" style={{ borderColor: accent + "66", color: "#dfe6f5" }}>
          {label || "—"}
        </span>
      </div>

      <div className="sd-stage-song">{presentation}</div>

      <div className="sd-stage-lyric">
        {blank ? (
          <span className="sd-stage-blank">{blankLabel}</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="sd-lyric-line">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CurrentSlide({
  presentation,
  text,
  label,
  accent,
  live,
}: {
  presentation: string;
  text: string;
  label: string;
  accent: string;
  live: boolean;
}) {
  return (
    <Panel
      title="Current Slide"
      className="sd-flex-grow"
      right={
        <span className="sd-hd-live">
          <Dot color={live ? "#ff4d4d" : "#5a6072"} className={live ? "sd-pulse" : ""} />
          <span style={{ color: live ? "#ff6b6b" : "#5a6072" }}>{live ? "ON STAGE" : "BLANK"}</span>
        </span>
      }
      bodyClass="sd-slidebody"
    >
      <Stage text={text} label={label} presentation={presentation} accent={accent} blankLabel={live ? "— instrumental —" : ""} />
      <div className="sd-stage-foot">
        <div className="sd-stage-foot-l">
          <div className="sd-foot-pres">{presentation || "—"}</div>
        </div>
      </div>
    </Panel>
  );
}

export function NextSlide({
  presentation,
  text,
  label,
  accent,
}: {
  presentation: string;
  text: string;
  label: string;
  accent: string;
}) {
  return (
    <Panel title="Next Slide" bodyClass="sd-slidebody">
      <Stage text={text} label={label} presentation={presentation} accent={accent} dim />
    </Panel>
  );
}
