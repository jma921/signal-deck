import { useEffect, useRef } from "react";
import { Dot, Panel } from "./atoms";
import type { ChatMsg } from "../data";

const PLAT: Record<string, { label: string; bg: string }> = {
  YT: { label: "YT", bg: "#ff3d3d" },
  FB: { label: "FB", bg: "#2d7ff0" },
};

function ChatMessage({ m }: { m: ChatMsg }) {
  const p = PLAT[m.plat]!;
  return (
    <div className="sd-chat-msg">
      <span className="sd-chat-badge" style={{ background: p.bg }}>
        {p.label}
      </span>
      <div className="sd-chat-body">
        <div className="sd-chat-meta">
          <span className="sd-chat-author">{m.author}</span>
          <span className="sd-chat-time">{m.time}</span>
        </div>
        <div className="sd-chat-text">{m.text}</div>
      </div>
      <div className="sd-chat-actions">
        <button className="sd-chat-act" title="Reply">↩</button>
        <button className="sd-chat-act" title="Pin to stage">📌</button>
        <button className="sd-chat-act" title="Flag">⚑</button>
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  collapsed,
  onToggle,
  accent,
}: {
  messages: ChatMsg[];
  collapsed: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section className={"sd-panel sd-chat-panel" + (collapsed ? " sd-chat-collapsed" : "")}>
      <header className="sd-panel-hd sd-chat-hd" onClick={onToggle}>
        <span className="sd-panel-lbl">
          Chat <span className="sd-chat-count">{messages.length}</span>
        </span>
        <div className="sd-panel-right sd-hd-live">
          <Dot color="#34d399" />
          <span style={{ color: "#7b8395" }}>YT · FB</span>
          <span className="sd-chat-caret">{collapsed ? "▸" : "▾"}</span>
        </div>
      </header>
      {!collapsed && (
        <>
          <div className="sd-chat-feed" ref={scrollRef}>
            {messages.map((m, i) => (
              <ChatMessage key={i} m={m} />
            ))}
          </div>
          <div className="sd-chat-compose">
            <input className="sd-chat-input" placeholder="Message all platforms…" />
            <button className="sd-chat-send" style={{ background: accent }}>
              ➤
            </button>
          </div>
        </>
      )}
    </section>
  );
}
