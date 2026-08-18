"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { Send, ArrowLeft, Plus, Camera, X, Image as ImageIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { MayaAvatar } from "@/components/MayaAvatar";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useChatScroll } from "@/hooks/useChatScroll";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  time: string;
  date: string;
  seen?: boolean;
  synced?: boolean;
  action?: { label: string; href: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function persistWithRetry(
  messages: Array<{ role: string; content: string; image_urls?: string[] }>,
  retries = 3,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("/api/maya/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return false;
}

const CHAT_CACHE_KEY = "maya_chat";

function formatTime(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Converts a server timestamp (UTC) to the user's LOCAL date "YYYY-MM-DD",
// matching the format produced by formatDate() so date separators stay consistent.
function localDateFromTimestamp(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PT_DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

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

// ── Sub-components ────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span
        className="px-3 py-1 rounded-full text-[12px] font-medium select-none"
        style={{
          background: "var(--muted)",
          color: "var(--muted-foreground)",
          boxShadow: "0 1px 2px rgba(0,0,0,.12)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function AttachMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 text-left w-full border-0 cursor-pointer"
      style={{ background: "transparent", color: "#D8D2E7", fontSize: 14 }}
    >
      <span style={{ color: "#A78BFA", display: "inline-flex" }}>{icon}</span>
      {label}
    </button>
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
  } catch {
    /* noop */
  }
  return null;
}

function Ticks({ status }: { status: "sent" | "delivered" | "read" }) {
  // White tones on the purple bubble — good contrast like WhatsApp
  const color =
    status === "read"
      ? "rgba(255,255,255,0.9)"
      : status === "delivered"
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.35)";
  const Tick = (
    <svg
      width="14" height="11" viewBox="0 0 18 13"
      fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M1.5 6.6 6 11l11-9.5" />
    </svg>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", color }}>
      {Tick}
      {status !== "sent" && (
        <span style={{ marginLeft: -9, display: "inline-flex" }}>{Tick}</span>
      )}
    </span>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start mb-2 maya-chat-msg">
      <div
        className="rounded-[10px] px-3.5 py-2.5"
        style={{ background: "#0D0E14" }}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--maya-secondary)" }}>✦</span>
          <span style={{ color: "#D8D2E7", fontSize: 13 }}>{label}</span>
          <span className="flex items-center gap-1 ml-0.5">
            <span className="size-1.5 rounded-full bg-[var(--maya-secondary)]/80 animate-bounce [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-[var(--maya-secondary)]/80 animate-bounce [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-[var(--maya-secondary)]/80 animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function MayaChatPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Hooks ──
  const { viewportH, keyboardOpen } = useViewportHeight();
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── State ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => searchParams.get("draft") ?? "");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [userName, setUserName] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]); // base64 previews
  const [uploadingImages, setUploadingImages] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  // ── Refs ──
  const sentinelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const nudgeActionRef = useRef<{ label: string; href: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── Chat scroll management ──
  const { handleScroll } = useChatScroll({
    containerRef: messagesRef,
    bottomRef,
    messageCount: messages.length,
    typing,
    hydrated,
  });

  // ── Textarea auto-resize (also scrolls messages on growth) ──
  useAutoResizeTextarea(textareaRef, input, messagesRef);

  // ── Keep messages visible when typing or keyboard changes viewport ──
  // Direct scrollTop — no ResizeObserver, no rAF timing issues.
  // Fires on every keystroke AND viewport change (keyboard open/close).
  useEffect(() => {
    const mc = messagesRef.current;
    if (!mc) return;
    mc.scrollTop = mc.scrollHeight;
  }, [input, viewportH]);

  // ── Focus textarea if draft param ──
  useEffect(() => {
    if (searchParams.get("draft")) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [searchParams]);

  // ── Load messages + profile (unified) ──
  useEffect(() => {
    // Profile from localStorage (instant, for greeting)
    const cache = loadProfileCache();
    if (cache?.name) setUserName(cache.name);

    // Load messages from server
    fetch("/api/maya/messages", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const serverMsgs: Message[] = Array.isArray(data)
          ? data
              .sort((a: Message, b: Message) =>
                (a as unknown as { created_at: string }).created_at?.localeCompare?.(
                  (b as unknown as { created_at: string }).created_at,
                ) ?? 0,
              )
              .map((m: unknown) => {
                const msg = m as { role: string; content: string; image_urls?: string[]; created_at: string };
                return {
                  role: msg.role as "user" | "assistant",
                  content: msg.content,
                  imageUrls: msg.image_urls || [],
                  time: new Date(msg.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  date: localDateFromTimestamp(msg.created_at),
                };
              })
          : [];

        // If arriving from Maya home nudge, inject context message
        const contextMsg = searchParams.get("context");
        let initialMessages = serverMsgs;
        if (contextMsg) {
          const contextAlreadyPresent = serverMsgs.some(
            (m: Message) => m.role === "assistant" && m.content === contextMsg
          );
          if (!contextAlreadyPresent) {
            const contextEntry: Message = {
              role: "assistant",
              content: contextMsg,
              time: formatTime(),
              date: formatDate(),
              synced: false, // will be saved below
            };
            initialMessages = [...serverMsgs, contextEntry];
            // Persist the context message
            persistWithRetry([{ role: "assistant", content: contextMsg }]);
          }
        }

        setMessages(initialMessages);
        if (initialMessages.length > 0) {
          localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(serverMsgs.slice(-50)));
        }
        setHydrated(true);
      })
      .catch(() => {
        // Server unreachable — use localStorage as fallback
        try {
          const cached = localStorage.getItem(CHAT_CACHE_KEY);
          if (cached) setMessages(JSON.parse(cached));
        } catch {
          /* noop */
        }
        setHydrated(true);
      });

    // Also fetch fresh profile from API
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setUserName(data.name);
      })
      .catch(() => {});
  }, []);

  // ── Load proactive nudge ──
  useEffect(() => {
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((data) => {
        if (data.nudges?.length > 0) {
          const nudge = data.nudges[0];
          if (nudge.action) nudgeActionRef.current = nudge.action;
          fetch("/api/maya/nudge", { method: "POST" })
            .then(() => {
              const now = formatTime();
              const today = formatDate();
              setMessages((prev) => {
                if (prev.some((m) => m.content === nudge.message)) return prev;
                return [
                  ...prev,
                  {
                    role: "assistant",
                    content: nudge.message,
                    time: now,
                    date: today,
                    action: nudge.action,
                  },
                ];
              });
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // ── Save to localStorage on changes + page hide ──
  useEffect(() => {
    if (!hydrated || messages.length === 0) return;
    const save = () =>
      localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(messages.slice(-50)));
    save();
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) save();
    });
    return () => {
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [messages, hydrated]);

  // ── Deliver AI response in parts (simulated streaming) ──
  const deliverParts = useCallback(
    async (parts: string[], baseMessages: Message[]) => {
      sendingRef.current = true;
      let current = [...baseMessages];

      for (let i = 0; i < parts.length; i++) {
        setTyping(true);
        await new Promise((r) => setTimeout(r, typingDelayFor(parts[i])));
        setTyping(false);
        current = [
          ...current,
          {
            role: "assistant" as const,
            content: parts[i],
            time: formatTime(),
            date: formatDate(),
          },
        ];
        setMessages(current);
        // Fire-and-forget persist
        persistWithRetry([{ role: "assistant", content: parts[i] }]);
        if (i < parts.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      // Mark last user message as seen
      setMessages((prev) => {
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
    },
    [],
  );

  // ── Load older messages ──
  const loadOlder = async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.date) return;
    const res = await fetch(
      `/api/maya/messages?before=${oldest.date}T${oldest.time}:00`,
    );
    if (res.ok) {
      const older: Message[] = (await res.json())
        .sort((a: { created_at: string }, b: { created_at: string }) =>
          a.created_at.localeCompare(b.created_at),
        )
        .map((m: { role: string; content: string; image_urls?: string[]; created_at: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          imageUrls: m.image_urls || [],
          time: new Date(m.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          date: localDateFromTimestamp(m.created_at),
        }));
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
      }
      setShowLoadMore(older.length >= 200);
    }
  };

  // ── IntersectionObserver for "load older" sentinel ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hydrated && messages.length >= 200) {
        setShowLoadMore(true);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hydrated, messages.length]);

  // ── Image picker handlers ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = 3 - selectedImages.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      try {
        const base64 = await compressImage(file);
        setSelectedImages((prev) => [...prev, base64]);
      } catch {
        // skip corrupted files
      }
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    const hasImages = selectedImages.length > 0;
    if ((!trimmed && !hasImages) || sending || sendingRef.current) return;

    // 1. Upload images to Supabase Storage (before creating the message)
    let uploadedPaths: string[] = [];
    if (hasImages) {
      setUploadingImages(true);
      try {
        uploadedPaths = await Promise.all(
          selectedImages.map((img) => uploadToCloud(img, "chat")),
        );
      } catch {
        setUploadingImages(false);
        // TODO: show toast/error to user
        return;
      }
    }

    const now = formatTime();
    const nowDate = formatDate();
    const userMsg: Message = {
      role: "user",
      content: trimmed || "📷",
      imageUrls: uploadedPaths,
      time: now,
      date: nowDate,
      seen: false,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setSelectedImages([]);
    setUploadingImages(false);
    setSending(true);
    sendingRef.current = true;

    // Safety net: keep keyboard open after send
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    // Persist user message first so DB order is correct
    await persistWithRetry([{ role: "user", content: userMsg.content, image_urls: uploadedPaths }]);

    // Mark as "read" immediately — Maya received the message
    setMessages((prev) => {
      const updated2 = [...prev];
      for (let i = updated2.length - 1; i >= 0; i--) {
        if (updated2[i].role === "user") {
          updated2[i] = { ...updated2[i], seen: true };
          break;
        }
      }
      return updated2;
    });

    try {
      const contextMsgs = updated.slice(-40).map(({ role, content, imageUrls, date, time }) => ({
        role,
        content,
        image_urls: imageUrls,
        date,
        time,
      }));
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localHour = new Date().getHours();
      const localDate = formatDate();
      const res = await fetch("/api/maya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: contextMsgs,
          timezone: tz,
          localHour,
          localDate,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const parts = splitIntoParts(data.reply);
      setSending(false);
      sendingRef.current = false;
      deliverParts(parts, updated);
    } catch {
      setSending(false);
      sendingRef.current = false;
      setMessages([
        ...updated,
        {
          role: "assistant",
          content: t("maya_error"),
          time: formatTime(),
          date: formatDate(),
        },
      ]);
    }
  }, [input, sending, messages, selectedImages, t, deliverParts]);

  // ── Keyboard handler ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Derived ──
  const welcomeMessage = t("maya_welcome");
  const busy = sending || typing || uploadingImages;
  const containerHeight =
    viewportH > 200 ? `${viewportH}px` : "100dvh";

  // ── Render ──
  return (
    <div
      className="flex flex-col"
      style={{
        height: containerHeight,
        background: "linear-gradient(180deg, #090A10 0%, #06070B 100%)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4"
        style={{
          minHeight: 58,
          background: "rgba(13,14,20,0.6)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="size-9 flex items-center justify-center rounded-full transition-colors -ml-1"
          style={{ color: "#D8D2E7" }}
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </button>

        <MayaAvatar state="mini" size={38} />

        <div className="min-w-0">
          <p
            className="leading-tight"
            style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF" }}
          >
            Maya
          </p>
          <p
            className="leading-tight flex items-center gap-1.5"
            style={{ fontSize: 11.5, color: "#8A8794" }}
          >
            {hydrated ? (
              <>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22C55E",
                    display: "inline-block",
                  }}
                />
                Online
              </>
            ) : (
              "carregando..."
            )}
          </p>
        </div>
      </div>

      {/* ── Messages ── */}
      {/* Absolutely positioned to the bottom of the flex area.
           This is the key: when the textarea grows, the flex area shrinks,
           but the messages stay anchored to the BOTTOM via CSS positioning.
           No JavaScript scroll manipulation needed. */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          className="absolute bottom-0 left-0 right-0 overflow-y-auto px-3 pt-3 pb-1"
          style={{
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            overflowAnchor: "none",
          }}
        >
        {/* Sentinel for loading older messages */}
        <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />

        {/* "Load older" button */}
        {showLoadMore && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <button
              type="button"
              onClick={loadOlder}
              style={{
                padding: "6px 14px",
                borderRadius: 9999,
                border: "1px solid rgba(167,139,250,0.2)",
                background: "transparent",
                color: "var(--maya-secondary)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↑ Mensagens anteriores
            </button>
          </div>
        )}

        {/* Welcome message (empty state) */}
        {hydrated && messages.length === 0 && welcomeMessage && (
          <div className="flex justify-start pt-12 maya-chat-msg">
            <div
              className="px-4 py-3 text-center"
              style={{
                background: "#0D0E14",
                color: "#D8D2E7",
                borderRadius: "10px",
                fontSize: 15,
                lineHeight: 1.4,
                maxWidth: "88%",
              }}
            >
              <div className="whitespace-pre-line">{welcomeMessage}</div>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isAssistant = msg.role === "assistant";
          const status: "sent" | "delivered" | "read" = msg.seen
            ? "read"
            : "delivered";
          const prevMsg = i > 0 ? messages[i - 1] : null;

          let separatorLabel: string | null = null;
          if (!msg.date) {
            if (!prevMsg || prevMsg.date != null) {
              separatorLabel = "Mensagens anteriores";
            }
          } else {
            const prevDate = prevMsg?.date ?? null;
            if (msg.date !== prevDate)
              separatorLabel = getDateLabel(msg.date);
          }

          // Spacing: tighter within the same author's sequence, looser on
          // context change (author switch or date break).
          const sameAuthor = prevMsg && prevMsg.role === msg.role && !separatorLabel;
          const gap = separatorLabel ? 16 : sameAuthor ? 12 : 22;

          return (
            <div key={i} className="maya-chat-msg">
              {separatorLabel && <DateSeparator label={separatorLabel} />}
              <div
                className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                style={{ marginBottom: gap }}
              >
                <div
                  className="whitespace-pre-line"
                  style={{
                    maxWidth: isAssistant ? "88%" : "78%",
                    background: isAssistant ? "#0D0E14" : "var(--maya-primary)",
                    color: isAssistant ? "#D8D2E7" : "#FFFFFF",
                    borderRadius: isAssistant
                      ? "10px"
                      : "16px 16px 5px 16px",
                    padding: "10px 13px",
                    fontSize: 15,
                    fontWeight: 400,
                    lineHeight: 1.4,
                  }}
                >
                  {msg.content}
                  {/* Images attached to the message */}
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div
                      className={`grid gap-1 mt-1.5 ${
                        msg.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                      }`}
                    >
                      {msg.imageUrls.map((path, idx) => (
                        <img
                          key={idx}
                          src={photoUrl(path)!}
                          alt={`Foto ${idx + 1}`}
                          className="w-full object-cover rounded-md cursor-pointer"
                          style={{
                            maxHeight: msg.imageUrls!.length === 1 ? 200 : 120,
                          }}
                          onClick={() => window.open(photoUrl(path)!, "_blank")}
                        />
                      ))}
                    </div>
                  )}
                  {msg.action && (
                    <a
                      href={msg.action.href}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(msg.action!.href);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 8,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "var(--maya-primary)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {msg.action.label} →
                    </a>
                  )}
                  {/* Time + ticks for user messages only */}
                  {!isAssistant && (
                    <span
                      className="whitespace-nowrap"
                      style={{
                        float: "right",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        margin: "8px -4px -6px 8px",
                        fontSize: 10.5,
                        fontWeight: 400,
                        lineHeight: 1,
                        color: "rgba(255,255,255,0.72)",
                      }}
                    >
                      {msg.time}
                      <Ticks status={status} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && <TypingIndicator label={t("maya_pensando")} />}

        {/* Bottom sentinel — ResizeObserver uses this to scroll to bottom */}
        <div ref={bottomRef} style={{ flexShrink: 0 }} />
      </div>
      </div>

      {/* ── Composer ── */}
      <div
        className="shrink-0 px-3 pt-2"
        style={{
          background: "rgba(13,14,20,0.7)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: keyboardOpen
            ? "calc(8px + env(safe-area-inset-bottom, 0px))"
            : "calc(28px + env(safe-area-inset-bottom, 16px))",
        }}
      >
        {/* Contextual suggestion chips — vanish once the user types */}
        {hydrated &&
          !input.trim() &&
          !typing &&
          !sending &&
          selectedImages.length === 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 maya-chat-msg">
              {(messages.length === 0
                ? [
                    t("maya_sugg_financas"),
                    t("maya_sugg_rotina"),
                    t("maya_sugg_dia_dificil"),
                  ]
                : [
                    t("maya_sugg_entender"),
                    t("maya_sugg_agora"),
                    t("maya_sugg_conversar"),
                  ]
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setInput(chip);
                    textareaRef.current?.focus();
                  }}
                  className="shrink-0 px-3.5 py-1.5 rounded-full whitespace-nowrap border-0 cursor-pointer"
                  style={{
                    background: "rgba(124,92,255,0.12)",
                    border: "1px solid rgba(167,139,250,0.25)",
                    color: "#D8D2E7",
                    fontSize: 13,
                    fontWeight: 400,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

        {/* Image previews */}
        {selectedImages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {selectedImages.map((img, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={img}
                  alt={`Foto ${i + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedImage(i)}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full flex items-center justify-center text-white border-0 cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                  aria-label="Remover foto"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        {/* Attach menu */}
        {attachOpen && (
          <div
            className="mb-2 flex flex-col rounded-xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <AttachMenuItem
              icon={<Camera className="size-4" />}
              label={t("maya_attach_photo")}
              onClick={() => {
                setAttachOpen(false);
                cameraInputRef.current?.click();
              }}
            />
            <AttachMenuItem
              icon={<ImageIcon className="size-4" />}
              label={t("maya_attach_gallery")}
              onClick={() => {
                setAttachOpen(false);
                fileInputRef.current?.click();
              }}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => setAttachOpen((v) => !v)}
            disabled={busy}
            className="size-10 shrink-0 inline-flex items-center justify-center rounded-full border-0 cursor-pointer transition-transform active:scale-90 disabled:opacity-40"
            style={{ background: "rgba(124,92,255,0.14)", color: "#A78BFA" }}
            aria-label="Anexar"
          >
            <Plus className="size-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("maya_placeholder")}
            disabled={busy}
            rows={1}
            className="maya-chat-input flex-1 resize-none rounded-[20px] border px-4 py-2.5 focus:outline-none disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.08)",
              color: "#D8D2E7",
              fontSize: 14,
              fontWeight: 400,
            }}
          />

          {/* Send */}
          <button
            type="button"
            tabIndex={-1}
            className="size-[42px] shrink-0 inline-flex items-center justify-center rounded-full border-0 cursor-pointer disabled:opacity-50 disabled:cursor-default"
            style={{
              background: "var(--maya-primary)",
              boxShadow: "0 4px 14px rgba(124,92,255,0.35)",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              // Synchronously refocus textarea — keyboard never leaves on iOS
              textareaRef.current?.focus();
              sendMessage();
            }}
            disabled={busy}
            aria-label="Enviar"
          >
            <Send className="size-[18px]" color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
