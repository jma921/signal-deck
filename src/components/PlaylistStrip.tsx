import React from "react";
import { HdCount } from "./atoms";
import type { ServiceItem } from "../data";

interface PlaylistItem extends ServiceItem {
  slides: number;
}

export function PlaylistStrip({
  items,
  activeIdx,
  accent,
}: {
  items: PlaylistItem[];
  activeIdx: number;
  accent: string;
}) {
  const total = items.length;
  const progress = ((activeIdx + 0.5) / total) * 100;

  return (
    <section className="sd-strip">
      <div className="sd-strip-hd">
        <span className="sd-panel-lbl">Playlist</span>
        <HdCount>
          {activeIdx + 1} of {total} · {items[activeIdx]?.name}
        </HdCount>
      </div>
      <div className="sd-strip-track">
        {items.map((it, i) => {
          const cls =
            i < activeIdx ? "sd-card-done" :
            i === activeIdx ? "sd-card-active" : "sd-card-up";
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <span
                  className={"sd-strip-link" + (i <= activeIdx ? " sd-strip-link-done" : "")}
                />
              )}
              <div
                className={"sd-strip-card " + cls}
                style={i === activeIdx ? ({ "--accent": accent } as React.CSSProperties) : undefined}
              >
                <div className="sd-strip-cardtop">
                  <span className="sd-strip-icon">{it.icon}</span>
                  <span className="sd-strip-slides">{it.slides} slides</span>
                </div>
                <span className="sd-strip-name">{it.name}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="sd-strip-bar">
        <div
          className="sd-strip-bar-fill"
          style={{ width: progress + "%", background: accent }}
        />
      </div>
    </section>
  );
}
