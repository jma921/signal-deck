import { HdCount, Panel } from "./atoms";

export interface ServiceOrderRow {
  id: string;
  icon: string;
  name: string;
  dur: string;
  status: "done" | "active" | "next" | "upcoming";
}

function ServiceRow({ item, n, accent, onSelect }: { item: ServiceOrderRow; n: number; accent: string; onSelect?: (id: string) => void }) {
  const cls =
    item.status === "done" ? "sd-svc-done" :
    item.status === "active" ? "sd-svc-active" :
    item.status === "next" ? "sd-svc-next" : "sd-svc-up";

  const select = () => onSelect?.(item.id);

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      className={"sd-svc-row " + cls}
      style={item.status === "active" ? { "--accent": accent } as React.CSSProperties : undefined}
      onClick={select}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      }}
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

export function ServiceOrder({ items, accent, onSelectItem }: { items: ServiceOrderRow[]; accent: string; onSelectItem?: (id: string) => void }) {
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
        <ServiceRow key={it.id} item={it} n={i + 1} accent={accent} onSelect={onSelectItem} />
      ))}
    </Panel>
  );
}
