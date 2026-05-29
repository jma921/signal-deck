import { Dot, HdCount, Panel } from "./atoms";
import type { Connection } from "../production/types";

const STATE_COLOR: Record<string, string | undefined> = {
  ok: "#34d399",
  warn: "#f0b429",
  err: "#ff5c5c",
};

export function ConnectionStatus({ rows }: { rows: Connection[] }) {
  const allOk = rows.every((r) => r.state === "ok");
  return (
    <Panel
      title="Connections"
      right={
        <HdCount color={allOk ? "#34d399" : "#f0b429"}>
          {rows.filter((r) => r.state === "ok").length}/{rows.length} up
        </HdCount>
      }
      bodyClass="sd-conn-body"
    >
      {rows.map((r) => (
        <div key={r.id} className="sd-conn-row">
          <span className="sd-conn-name">{r.name}</span>
          <span className="sd-conn-status" style={{ color: STATE_COLOR[r.state] ?? "#34d399" }}>
            {r.status}
            <Dot color={STATE_COLOR[r.state] ?? "#34d399"} className={r.state !== "ok" ? "sd-pulse" : ""} />
          </span>
        </div>
      ))}
    </Panel>
  );
}
