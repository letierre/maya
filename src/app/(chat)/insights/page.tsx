"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { Send, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MayaAvatar } from "@/components/MayaAvatar";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
  date: string;
  seen?: boolean;
}

const CHAT_CACHE_KEY = "maya_chat";

function formatTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PT_DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function getDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return PT_DAYS[d.getDay()];
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span
        className="px-3 py-1 rounded-full text-[12px] font-medium select-none"
        style={{ background: "oklch(0.22 0.02 270)", color: "oklch(0.65 0.05 270)", boxShadow: "0 1px 2px rgba(0,0,0,.12)" }}
      >
        {label}
      </span>
    </div>
  );
}

function splitIntoParts(text: string): string[] {
  const parts = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length > 1) return parts;

  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 2) return [text];

  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const group = sentences.slice(i, i + 2).join(" ").trim();
    if (group) groups.push(group);
  }
  return groups.length > 0 ? groups : [text];
}

function typingDelayFor(text: string): number {
  const ms = Math.round(text.length * 55);
  return Math.max(1200, Math.min(4500, ms));
}

function loadProfileCache() {
  try {
    const raw = localStorage.getItem("user_profile");
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return null;
}

// WhatsApp-style SVG ticks
function Ticks({ status }: { status: "sent" | "delivered" | "read" }) {
  const color = status === "read" ? "#A78BFA" : "oklch(0.55 0.03 270)";
  const Tick = (
    <svg width="14" height="11" viewBox="0 0 18 13" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.6 6 11l11-9.5" />
    </svg>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", color }}>
      {Tick}
      {status !== "sent" && <span style={{ marginLeft: -9, display: "inline-flex" }}>{Tick}</span>}
    </span>
  );
}

export default function MayaChatPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => searchParams.get("draft") ?? "");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [userName, setUserName] = useState("");
  const [viewportH, setViewportH] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const fullHeightRef = useRef(0);

  useEffect(() => {
    fullHeightRef.current = window.innerHeight;

    const onViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      window.scrollTo(0, 0);
      const h = vv.height;
      setViewportH(h);
      setKeyboardOpen(fullHeightRef.current - h > 80);
    };

    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);
    onViewportChange();

    return () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("draft")) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [searchParams]);

  useEffect(() => {
    const cache = loadProfileCache();
    if (cache?.name) setUserName(cache.name);

    // Load from server first, fallback to localStorage
    fetch("/api/maya/messages")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const msgs = data.map((m: any) => ({
            role: m.role,
            content: m.content,
            time: new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            date: m.created_at.slice(0, 10),
          }));
          setMessages(msgs);
        } else {
          // Fallback to localStorage
          try {
            const cached = localStorage.getItem(CHAT_CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setMessages(parsed);
              }
            }
          } catch { /* noop */ }
        }
        setHydrated(true);
      })
      .catch(() => {
        // Network error — use localStorage
        try {
          const cached = localStorage.getItem(CHAT_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
          }
        } catch { /* noop */ }
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setUserName(data.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hydrated && messages.length > 0) {
      localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(messages.slice(-50)));
    }
  }, [messages, hydrated]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      });
    });
  }, [messages, typing, viewportH]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
    }
  }, [input]);

  const deliverParts = useCallback(async (parts: string[], baseMessages: Message[]) => {
    sendingRef.current = true;
    let current = [...baseMessages];

    for (let i = 0; i < parts.length; i++) {
      setTyping(true);
      await new Promise((r) => setTimeout(r, typingDelayFor(parts[i])));
      setTyping(false);
      current = [...current, { role: "assistant", content: parts[i], time: formatTime(), date: formatDate() }];
      setMessages(current);
      // Persist assistant message to server
      fetch("/api/maya/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "assistant", content: parts[i] }] }),
      }).catch(() => {});
      if (i < parts.length - 1) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setMessages(prev => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "user") {
          updated[i] = { ...updated[i], seen: true };
          break;
        }
      }
      return updated;
    });

    sendingRef.current = false;
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || sendingRef.current) return;

    const now = formatTime();
    const nowDate = formatDate();
    const userMsg: Message = { role: "user", content: trimmed, time: now, date: nowDate, seen: false };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSending(true);

    // Persist user message to server
    fetch("/api/maya/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: trimmed }] }),
    }).catch(() => {});

    try {
      const contextMsgs = updated.slice(-20).map(({ role, content, date, time }) => ({ role, content, date, time }));
      const res = await fetch("/api/maya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMsgs }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const parts = splitIntoParts(data.reply);
      setSending(false);
      deliverParts(parts, updated);
    } catch {
      setSending(false);
      setMessages([...updated, { role: "assistant", content: t("maya_error"), time: formatTime(), date: formatDate() }]);
    }
  }, [input, sending, messages, t, deliverParts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const welcomeMessage = t("maya_welcome");
  const busy = sending || typing;

  return (
    <div
      className="flex flex-col"
      style={{
        height: viewportH > 0 ? `${viewportH}px` : "100dvh",
        background: "oklch(0.12 0.012 270)",
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-2.5 safe-top"
        style={{
          background: "oklch(0.14 0.012 270)",
          borderBottom: "1px solid oklch(0.28 0.02 270 / 0.5)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="size-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-1"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </button>

        <MayaAvatar state="mini" size={36} />

        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Maya</p>
          <p className="text-[11px] leading-tight" style={{ color: "oklch(0.55 0.03 270)" }}>
            {typing ? t("maya_typing") : t("maya_subtitle")}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-3">
        {hydrated && messages.length === 0 && welcomeMessage && (
          <div className="flex justify-center pt-12">
            <div
              className="rounded-[8px] px-4 py-3 text-sm text-center max-w-sm"
              style={{
                background: "oklch(0.16 0.012 270)",
                color: "#e0d6ff",
                boxShadow: "0 2px 8px oklch(0.3 0.03 270 / 0.3)",
              }}
            >
              <div className="whitespace-pre-line">{welcomeMessage}</div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isAssistant = msg.role === "assistant";
          const status: "sent" | "delivered" | "read" = msg.seen ? "read" : "delivered";
          const prevMsg = i > 0 ? messages[i - 1] : null;

          let separatorLabel: string | null = null;
          if (!msg.date) {
            // undated message (old cache): show "Mensagens anteriores" before first undated cluster
            if (!prevMsg || prevMsg.date != null) separatorLabel = "Mensagens anteriores";
          } else {
            // dated message: show label on date change
            const prevDate = prevMsg?.date ?? null;
            if (msg.date !== prevDate) separatorLabel = getDateLabel(msg.date);
          }

          return (
            <div key={i}>
              {separatorLabel && <DateSeparator label={separatorLabel} />}
            <div
              className={`flex ${isAssistant ? "justify-start" : "justify-end"} mb-1.5`}
            >
              <div
                className="max-w-[80%] rounded-[8px] px-3 pt-1.5 pb-2 text-[14px] leading-[1.32] whitespace-pre-line"
                style={{
                  background: isAssistant ? "oklch(0.16 0.012 270)" : "#7C5CFF",
                  color: isAssistant ? "#e0d6ff" : "#fff",
                  boxShadow: "0 1px 0.5px rgba(11,20,26,.13)",
                }}
              >
                {msg.content}
                <span
                  className="text-[11px] leading-none whitespace-nowrap"
                  style={{
                    float: "right",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    margin: "8px -4px -5px 8px",
                    color: isAssistant ? "oklch(0.55 0.03 270)" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {msg.time}
                  {!isAssistant && <Ticks status={status} />}
                </span>
              </div>
            </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex justify-start mb-1.5">
            <div
              className="rounded-[8px] px-3.5 py-2"
              style={{
                background: "oklch(0.16 0.012 270)",
                boxShadow: "0 1px 0.5px rgba(11,20,26,.13)",
              }}
            >
              <div className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#A78BFA]/60 animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-[#A78BFA]/60 animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-[#A78BFA]/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 px-3 pt-2.5"
        style={{
          background: "oklch(0.14 0.012 270)",
          borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)",
          paddingBottom: keyboardOpen
            ? "calc(8px + env(safe-area-inset-bottom, 0px))"
            : "calc(80px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setViewportH(0);
                setKeyboardOpen(false);
              }, 150);
            }}
            placeholder="Falar com Maya..."
            disabled={busy}
            rows={1}
            className="flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              background: "oklch(0.12 0.012 270)",
              borderColor: "oklch(0.28 0.02 270 / 0.5)",
              color: "#e0d6ff",
            }}
          />
          <Button
            size="icon"
            className="rounded-full size-10 shrink-0"
            style={{ background: "#7C5CFF" }}
            onClick={sendMessage}
            disabled={!input.trim() || busy}
          >
            <Send className="size-4" color="#fff" />
          </Button>
        </div>
      </div>
    </div>
  );
}
