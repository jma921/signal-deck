import { HdCount, Panel } from "./atoms";
import type { ServiceItem } from "../data";

function ServiceRow({ item, n, accent }: { item: ServiceItem; n: number; accent: string }) {
  const cls =
    item.status === "done" ? "sd-svc-done" :
    item.status === "active" ? "sd-svc-active" :
    item.status === "next" ? "sd-svc-next" : "sd-svc-up";

  return (
    <div
      className={"sd-svc-row " + cls}
      style={item.status === "active" ? { "--accent": accent } as React.CSSProperties : undefined}
    >
      <span className="sd-svc-n">{String(n).padStart(2, "0")}</span>
      <span className="sd-svc-icon">{item.icon}</span>
      <span className="sd-svc-name">{item.name}</span>
      {item.status === "active" && <span className="sd-svc-onair">ON</span>}
      {item.status === "next" && <span className="sd-svc-up-tag">NEXT</span>}
      <span className="sd-svc-dur">{item.dur}</span>
    </div>
  );
}

export function ServiceOrder({ items, accent }: { items: ServiceItem[]; accent: string }) {
  const done = items.filter((i) => i.status === "done").length;
  return (
    <Panel
      title="Service Order"
      className="sd-flex-grow"
      right={
        <HdCount>
          {done} / {items.length} done
        </HdCount>
      }
      bodyClass="sd-svc-body"
    >
      {items.map((it, i) => (
        <ServiceRow key={i} item={it} n={i + 1} accent={accent} />
      ))}
    </Panel>
  );
}
