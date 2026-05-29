import React from "react";

export function Dot({ color, size = 7, className = "" }: { color: string; size?: number; className?: string }) {
  return (
    <span
      className={"sd-dot " + className}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 6px 0 ${color}, 0 0 2px 0 ${color}`,
      }}
    />
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClass = "",
  style,
}: {
  title: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClass?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={"sd-panel " + className} style={style}>
      <header className="sd-panel-hd">
        <span className="sd-panel-lbl">{title}</span>
        <div className="sd-panel-right">{right}</div>
      </header>
      <div className={"sd-panel-bd " + bodyClass}>{children}</div>
    </section>
  );
}

export function HdCount({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="sd-hd-count" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}
