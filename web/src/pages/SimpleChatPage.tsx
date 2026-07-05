/**
 * SimpleChatPage — a clean, mobile-first bubble chat (ChatGPT / Codex style).
 *
 * Talks to the JSON-RPC gateway (/api/ws) directly — the same protocol the
 * desktop assistant-ui chat uses:
 *   session.create → { session_id }
 *   prompt.submit { session_id, text }
 *   message.delta  (streamed assistant text)   /   message.complete
 *
 * Styled to match the "Ocean" blue-on-white theme: white assistant cards, a
 * blue gradient for the user's bubbles + send button, big soft corners.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { GatewayClient, type GatewayEvent } from "@/lib/gatewayClient";
import { useI18n } from "@/i18n";

const ACCENT_GRADIENT = "linear-gradient(135deg, #2f6bff, #5b8bff)";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}

export default function SimpleChatPage() {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");

  const gwRef = useRef<GatewayClient | null>(null);
  const sessionRef = useRef<string>("");
  const idRef = useRef(0);
  const streamingIdRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [connError, setConnError] = useState(false);

  // ---- streaming helpers -------------------------------------------------
  const appendDelta = useCallback((text: string) => {
    if (!text) return;
    setStatus("");
    setMessages((prev) => {
      const next = [...prev];
      if (streamingIdRef.current == null) {
        idRef.current += 1;
        streamingIdRef.current = idRef.current;
        next.push({ id: idRef.current, role: "assistant", text, pending: true });
      } else {
        const i = next.findIndex((m) => m.id === streamingIdRef.current);
        if (i >= 0) next[i] = { ...next[i], text: next[i].text + text };
      }
      return next;
    });
  }, []);

  const finishTurn = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamingIdRef.current ? { ...m, pending: false } : m,
      ),
    );
    streamingIdRef.current = null;
    setBusy(false);
    setStatus("");
  }, []);

  // ---- connect + session on mount ---------------------------------------
  useEffect(() => {
    const gw = new GatewayClient();
    gwRef.current = gw;
    let cancelled = false;
    const offs: Array<() => void> = [];

    offs.push(
      gw.on("message.delta", (e: GatewayEvent) => {
        const t = (e.payload as { text?: string } | undefined)?.text ?? "";
        appendDelta(t);
      }),
    );
    offs.push(
      gw.on("message.complete", (e: GatewayEvent) => {
        const full = (e.payload as { text?: string } | undefined)?.text;
        if (streamingIdRef.current == null && full) appendDelta(full);
        finishTurn();
      }),
    );
    offs.push(gw.on("reasoning.delta", () => setStatus(zh ? "思考中…" : "Thinking…")));
    offs.push(gw.on("thinking.delta", () => setStatus(zh ? "思考中…" : "Thinking…")));
    offs.push(
      gw.on("tool.start", (e: GatewayEvent) => {
        const name = (e.payload as { name?: string } | undefined)?.name;
        setStatus(
          zh
            ? `正在使用工具${name ? ` ${name}` : ""}…`
            : `Using tool${name ? ` ${name}` : ""}…`,
        );
      }),
    );
    offs.push(
      gw.on("error", (e: GatewayEvent) => {
        const msg =
          (e.payload as { message?: string } | undefined)?.message ??
          (zh ? "出错了" : "Something went wrong");
        appendDelta(`\n\n⚠️ ${msg}`);
        finishTurn();
      }),
    );

    (async () => {
      try {
        await gw.connect();
        const res = await gw.request<{ session_id: string }>(
          "session.create",
          {},
        );
        if (cancelled) return;
        sessionRef.current = res.session_id;
        setReady(true);
      } catch {
        if (!cancelled) setConnError(true);
      }
    })();

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      gw.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-scroll to newest
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = useCallback(async () => {
    const text = input.trim();
    const gw = gwRef.current;
    if (!text || busy || !gw || !sessionRef.current) return;
    idRef.current += 1;
    setMessages((prev) => [...prev, { id: idRef.current, role: "user", text }]);
    setInput("");
    setBusy(true);
    setStatus(zh ? "思考中…" : "Thinking…");
    try {
      await gw.request("prompt.submit", {
        session_id: sessionRef.current,
        text,
      });
    } catch {
      appendDelta(zh ? "\n\n⚠️ 发送失败,请重试。" : "\n\n⚠️ Failed to send.");
      finishTurn();
    }
  }, [input, busy, zh, appendDelta, finishTurn]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const avatar = (
    <div
      className="grid h-8 w-8 flex-none place-items-center rounded-xl text-[15px] font-bold text-white shadow"
      style={{ background: ACCENT_GRADIENT }}
    >
      ☤
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <div
              className="grid h-16 w-16 place-items-center rounded-3xl text-3xl text-white shadow-lg"
              style={{ background: ACCENT_GRADIENT }}
            >
              ☤
            </div>
            <div className="text-lg font-semibold">Hermes</div>
            <div className="text-sm opacity-60">
              {connError
                ? zh
                  ? "连接失败,请确认后端在运行,然后刷新页面。"
                  : "Connection failed — reload the page."
                : ready
                  ? zh
                    ? "有什么可以帮你的?在下面输入开始对话吧。"
                    : "How can I help? Type below to start."
                  : zh
                    ? "正在连接…"
                    : "Connecting…"}
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5">
          {messages.map((m) =>
            m.role === "assistant" ? (
              <div key={m.id} className="flex items-end gap-2.5">
                {avatar}
                <div
                  className="max-w-[82%] whitespace-pre-wrap break-words rounded-[22px] rounded-bl-md px-4 py-2.5 text-[0.95rem] leading-relaxed shadow-sm"
                  style={{
                    background: "var(--color-card, #ffffff)",
                    border: "1px solid var(--color-border, #e1e8f6)",
                  }}
                >
                  {m.text || (m.pending ? "…" : "")}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-row-reverse">
                <div
                  className="max-w-[82%] whitespace-pre-wrap break-words rounded-[22px] rounded-br-md px-4 py-2.5 text-[0.95rem] leading-relaxed text-white shadow-sm"
                  style={{ background: ACCENT_GRADIENT }}
                >
                  {m.text}
                </div>
              </div>
            ),
          )}

          {status && (
            <div className="flex items-end gap-2.5">
              {avatar}
              <div
                className="flex items-center gap-2 rounded-[22px] rounded-bl-md px-4 py-3 text-sm shadow-sm"
                style={{
                  background: "var(--color-card, #ffffff)",
                  border: "1px solid var(--color-border, #e1e8f6)",
                }}
              >
                <span className="inline-flex gap-1">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
                <span className="opacity-60">{status}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={
              ready
                ? zh
                  ? "给 Hermes 发消息…"
                  : "Message Hermes…"
                : zh
                  ? "正在连接…"
                  : "Connecting…"
            }
            disabled={!ready}
            className="max-h-40 flex-1 resize-none rounded-3xl px-4 py-3 text-[0.95rem] shadow-sm outline-none disabled:opacity-60"
            style={{
              background: "var(--color-card, #ffffff)",
              border: "1px solid var(--color-border, #e1e8f6)",
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!ready || busy || !input.trim()}
            aria-label={zh ? "发送" : "Send"}
            className="grid h-12 w-12 flex-none place-items-center rounded-full text-xl text-white shadow-md transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: ACCENT_GRADIENT }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: "currentColor",
        opacity: 0.5,
        animation: "hermesBounce 1s infinite ease-in-out",
        animationDelay: delay,
      }}
    />
  );
}
