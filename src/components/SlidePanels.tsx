import { Dot, HdCount, Panel } from "./atoms";
import type { Slide, Song } from "../data";

function Stage({
  slide,
  song,
  pos,
  total,
  dim = false,
  accent,
}: {
  slide: Slide | undefined;
  song: string;
  pos: number;
  total: number;
  dim?: boolean;
  accent: string;
}) {
  const blank = !slide || slide.lines.length === 0;
  return (
    <div className={"sd-stage" + (dim ? " sd-stage--dim" : "")}>
      <div className="sd-stage-bg" />
      <div className="sd-stage-grain" />

      <div className="sd-stage-top">
        <span className="sd-chip" style={{ borderColor: accent + "66", color: "#dfe6f5" }}>
          {slide ? slide.label : "—"}
        </span>
        <span className="sd-chip sd-chip--pos">
          {pos} / {total}
        </span>
      </div>

      <div className="sd-stage-song">{song}</div>

      <div className="sd-stage-lyric">
        {blank ? (
          <span className="sd-stage-blank">{slide ? "— instrumental —" : ""}</span>
        ) : (
          slide!.lines.map((l, i) => (
            <div key={i} className="sd-lyric-line">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function CurrentSlide({
  song,
  slide,
  idx,
  total,
  accent,
  live,
}: {
  song: Song;
  slide: Slide;
  idx: number;
  total: number;
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
      <Stage slide={slide} song={song.presentation} pos={idx + 1} total={total} accent={accent} />
      <div className="sd-stage-foot">
        <div className="sd-stage-foot-l">
          <div className="sd-foot-pres">{song.presentation}</div>
          <div className="sd-foot-arr">{song.arrangement}</div>
        </div>
        <div className="sd-stage-foot-r">{slide ? slide.label : "—"}</div>
      </div>
    </Panel>
  );
}

export function NextSlide({
  song,
  slide,
  idx,
  total,
  accent,
}: {
  song: Song;
  slide: Slide;
  idx: number;
  total: number;
  accent: string;
}) {
  return (
    <Panel
      title="Next Slide"
      right={
        <HdCount>
          {idx + 1} / {total}
        </HdCount>
      }
      bodyClass="sd-slidebody"
    >
      <Stage slide={slide} song={song.presentation} pos={idx + 1} total={total} accent={accent} dim />
    </Panel>
  );
}
