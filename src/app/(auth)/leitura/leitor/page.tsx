"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, X, Timer } from "lucide-react";
import { toast } from "sonner";
import type { ReadingBook } from "@/types";
import { getLocalDate } from "@/lib/utils";
import { emitCareDataChanged } from "@/lib/care-events";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const CARD_BG = "oklch(.17 .015 270 / .6)";

const STORAGE_KEY = "leitura_timer_active";

interface ActiveTimer {
  book_id: string | null;
  book_title: string;
  book_emoji: string;
  started_at: number; // epoch ms
}

function loadActiveTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.started_at) return parsed as ActiveTimer;
  } catch { /* ignore */ }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

export default function LeituraTimerPage() {
  const router = useRouter();
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pages, setPages] = useState("");
  const [saving, setSaving] = useState(false);

  // Carrega livros ativos (lendo / quero ler)
  useEffect(() => {
    fetch("/api/leitura/books")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          const activeBooks = d.filter((b) => b.status === "lendo" || b.status === "quero_ler");
          setBooks(activeBooks);
        }
      })
      .catch(() => {});
  }, []);

  // Retoma cronômetro ativo (sobrevive a fechar/sair do app)
  useEffect(() => {
    const existing = loadActiveTimer();
    if (existing) setActive(existing);
  }, []);

  // Tick a cada segundo + atualização imediata ao voltar para a aba
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [active]);

  const elapsedMs = active ? now - active.started_at : 0;

  // Indicador "segundo plano": título da aba mostra o cronômetro rodando ao vivo.
  const titleRef = useRef<string>("");
  useEffect(() => {
    titleRef.current = document.title;
    return () => {
      if (titleRef.current) document.title = titleRef.current;
    };
  }, []);
  useEffect(() => {
    if (active) {
      document.title = `⏱ ${formatElapsed(elapsedMs)} · ${active.book_emoji} ${active.book_title}`;
    }
  }, [elapsedMs, active]);

  // Notificação de sistema (estática — não "tique-taqueia"; ao tocar, volta ao app).
  const notifRef = useRef<Notification | null>(null);

  const closeTimerNotification = () => {
    if (notifRef.current) {
      try { notifRef.current.close(); } catch { /* ignore */ }
      notifRef.current = null;
    }
  };

  const notifyStart = async (timer: ActiveTimer) => {
    try {
      if (!("Notification" in window)) return;
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      closeTimerNotification();
      const notif = new Notification("Cronômetro de leitura em andamento", {
        body: `${timer.book_emoji} ${timer.book_title} · Toque para voltar ao cronômetro`,
        tag: "leitura-timer",
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
        notifRef.current = null;
      };
      notifRef.current = notif;
    } catch { /* ignore */ }
  };

  const start = () => {
    if (books.length === 0) {
      toast.error("Adicione um livro primeiro");
      return;
    }
    const book = books.find((b) => b.id === selectedBookId) || books[0];
    const timer: ActiveTimer = {
      book_id: book?.id || null,
      book_title: book?.title || "Leitura",
      book_emoji: book?.emoji || "📖",
      started_at: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    setActive(timer);
    setNow(Date.now());
    setPages("");
    void notifyStart(timer);
  };

  const finalize = async () => {
    if (!active || saving) return;
    setSaving(true);
    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    const pagesNum = Math.max(0, Number(pages) || 0);
    try {
      const res = await fetch("/api/leitura/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: active.book_id || null,
          book_title: active.book_title,
          date: getLocalDate(),
          minutes_read: minutes,
          pages_read: pagesNum,
        }),
      });
      if (res.ok) {
        emitCareDataChanged();
        localStorage.removeItem(STORAGE_KEY);
        closeTimerNotification();
        toast.success(`Leitura registrada: ${minutes} min 🔥`);
        router.push("/leitura");
      } else {
        toast.error("Erro ao salvar leitura");
      }
    } catch {
      toast.error("Erro ao salvar leitura");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    localStorage.removeItem(STORAGE_KEY);
    closeTimerNotification();
    router.push("/leitura");
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      background: `
        radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.55 .18 270 / .14) 0%, transparent 60%),
        linear-gradient(180deg, oklch(.11 .012 270) 0%, oklch(.14 .015 270) 100%)
      `,
      fontFamily: "var(--font-sans)", color: FOREGROUND,
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
        <button type="button" onClick={() => router.push("/leitura")}
          style={{
            width: 36, height: 36, borderRadius: "50%", background: CARD_BG,
            border: `1px solid ${BORDER}`, cursor: "pointer", color: MUTED,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <X style={{ width: 18, height: 18 }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
          <Timer style={{ width: 15, height: 15 }} /> Modo foco
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px 40px" }}>
        {!active ? (
          <>
            <span style={{ fontSize: 56 }}>📖</span>
            <h1 style={{ margin: "14px 0 4px", fontSize: 22, fontWeight: 800, textAlign: "center" }}>
              Cronômetro de leitura
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: 13, color: MUTED, textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
              Inicie e mergulhe na leitura. O tempo continua contando mesmo se você sair do app.
            </p>

            {books.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13, textAlign: "center" }}>
                Você ainda não tem livros na estante.{" "}
                <button type="button" onClick={() => router.push("/leitura")}
                  style={{ background: "none", border: 0, color: "#A78BFA", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                  Adicionar livro
                </button>
              </p>
            ) : (
              <select value={selectedBookId || books[0]?.id || ""} onChange={(e) => setSelectedBookId(e.target.value)}
                style={{
                  width: "100%", maxWidth: 340, padding: "13px 14px", borderRadius: 12,
                  background: CARD_BG, border: `1px solid ${BORDER}`, color: FOREGROUND,
                  fontSize: 15, fontFamily: "inherit", outline: "none", marginBottom: 16,
                }}>
                {books.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: "#1a1a28" }}>
                    {b.emoji || "📖"} {b.title}
                  </option>
                ))}
              </select>
            )}

            {books.length > 0 && (
              <button type="button" onClick={start}
                style={{
                  width: "100%", maxWidth: 340, padding: "16px", borderRadius: 14,
                  background: PURPLE_HEX, color: "#fff", border: 0, cursor: "pointer",
                  fontSize: 16, fontWeight: 700, fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <Play style={{ width: 20, height: 20 }} /> Iniciar leitura
              </button>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: 48 }}>{active.book_emoji || "📖"}</span>
            <h2 style={{
              margin: "12px 0 4px", fontSize: 17, fontWeight: 700, textAlign: "center",
              maxWidth: 340, overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {active.book_title}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>lendo agora…</p>

            <div style={{
              fontSize: 72, fontWeight: 800, color: "#fff", margin: "24px 0 8px",
              fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", lineHeight: 1,
            }}>
              {formatElapsed(elapsedMs)}
            </div>

            <input
              value={pages}
              onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Páginas lidas (opcional)"
              style={{
                width: "100%", maxWidth: 300, padding: "12px 14px", borderRadius: 12,
                background: CARD_BG, border: `1px solid ${BORDER}`, color: FOREGROUND,
                fontSize: 14, fontFamily: "inherit", outline: "none", textAlign: "center",
                marginTop: 16, marginBottom: 24,
              }}
            />

            <button type="button" onClick={finalize} disabled={saving}
              style={{
                width: "100%", maxWidth: 340, padding: "15px", borderRadius: 14,
                background: "oklch(0.55 0.15 160)", color: "#fff", border: 0, cursor: "pointer",
                fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: saving ? 0.6 : 1,
              }}>
              <Square style={{ width: 16, height: 16 }} /> {saving ? "Salvando…" : "Finalizar"}
            </button>

            <button type="button" onClick={cancel}
              style={{
                marginTop: 14, background: "none", border: 0, cursor: "pointer",
                color: MUTED, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              }}>
              Descartar e cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
