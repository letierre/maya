"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { useRouter } from "next/navigation";
import {
  BookOpen, Plus, Flame, Target, Library, BarChart3, Clock, FileText, Timer,
} from "lucide-react";
import { toast } from "sonner";
import type { ReadingBook, ReadingSession, ReadingSettings } from "@/types";
import { ReadingBookCard } from "@/components/ReadingBookCard";
import { ReadingAddBookModal, type BookFormValues } from "@/components/ReadingAddBookModal";
import { ReadingLogSessionModal, type SessionFormValues } from "@/components/ReadingLogSessionModal";
import {
  getLocalDate, getWeekMondayDate, getWeekSundayDate, calculateStreak,
} from "@/lib/utils";
import { emitCareDataChanged } from "@/lib/care-events";

// ── Design tokens ──────────────────────────────────────────────
const BG_GRADIENT: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 55% at 80% 0%, oklch(.58 .18 270 / .15) 0%, transparent 55%),
    radial-gradient(ellipse 70% 40% at 0% 100%, oklch(.58 .18 270 / .1) 0%, transparent 50%),
    linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
  `,
  fontFamily: "var(--font-sans)",
  color: "#e0d6ff",
  minHeight: "100dvh",
};

const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const CARD_BG = "oklch(.17 .015 270 / .6)";

// ── Page ────────────────────────────────────────────────────────

export default function LeituraPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<"estante" | "stats">("estante");
  const [hasActiveTimer, setHasActiveTimer] = useState(false);
  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [settings, setSettings] = useState<ReadingSettings>({ daily_goal_type: "minutes", daily_goal_value: 15 });
  const [loading, setLoading] = useState(true);

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<ReadingBook | null>(null);
  const [logModal, setLogModal] = useState(false);
  const [logBookId, setLogBookId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [b, s, st] = await Promise.all([
        fetch("/api/leitura/books").then((r) => r.json()),
        fetch("/api/leitura/sessions").then((r) => r.json()),
        fetch("/api/leitura/settings").then((r) => r.json()),
      ]);
      if (Array.isArray(b)) setBooks(b);
      if (Array.isArray(s)) setSessions(s);
      if (st && typeof st === "object") setSettings(st);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Detecta cronômetro ativo (para oferecer retomada ao voltar ao app)
  useEffect(() => {
    const check = () => {
      try { setHasActiveTimer(Boolean(localStorage.getItem("leitura_timer_active"))); }
      catch { setHasActiveTimer(false); }
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const activeBooks = useMemo(
    () => books.filter((b) => b.status === "lendo" || b.status === "quero_ler"),
    [books]
  );

  // ── Stats ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const dates = Array.from(new Set(sessions.map((s) => s.date))).sort((a, b) => b.localeCompare(a));
    const streak = calculateStreak(dates);
    const today = getLocalDate();

    const todaySessions = sessions.filter((s) => s.date === today);
    const todayPages = todaySessions.reduce((a, s) => a + s.pages_read, 0);
    const todayMinutes = todaySessions.reduce((a, s) => a + s.minutes_read, 0);

    const goalType = settings.daily_goal_type;
    const goalValue = settings.daily_goal_value;
    const todayProgress = goalType === "pages" ? todayPages : todayMinutes;
    const goalReached = goalValue > 0 && todayProgress >= goalValue;

    const monday = getWeekMondayDate();
    const sunday = getWeekSundayDate();
    const weekSessions = sessions.filter((s) => s.date >= monday && s.date <= sunday);
    const weekPages = weekSessions.reduce((a, s) => a + s.pages_read, 0);
    const weekMinutes = weekSessions.reduce((a, s) => a + s.minutes_read, 0);
    const weekDays = new Set(weekSessions.map((s) => s.date)).size;

    const monthPrefix = today.slice(0, 7);
    const monthSessions = sessions.filter((s) => s.date.startsWith(monthPrefix));
    const monthPages = monthSessions.reduce((a, s) => a + s.pages_read, 0);
    const monthMinutes = monthSessions.reduce((a, s) => a + s.minutes_read, 0);
    const monthDays = new Set(monthSessions.map((s) => s.date)).size;

    return {
      streak,
      todayPages,
      todayMinutes,
      todayProgress,
      goalType,
      goalValue,
      goalReached,
      weekPages,
      weekMinutes,
      weekDays,
      monthPages,
      monthMinutes,
      monthDays,
      booksReading: books.filter((b) => b.status === "lendo").length,
      booksCompleted: books.filter((b) => b.status === "concluido").length,
    };
  }, [sessions, settings, books]);

  // ── Actions ───────────────────────────────────────────────────

  const openAdd = () => { setEditingBook(null); setAddModal(true); };
  const openEdit = (book: ReadingBook) => { setEditingBook(book); setAddModal(true); };
  const openLog = (book: ReadingBook | null) => {
    setLogBookId(book?.id || null);
    setLogModal(true);
  };

  const saveBook = async (values: BookFormValues) => {
    try {
      const payload = {
        title: values.title,
        author: values.author || null,
        emoji: values.emoji,
        genre: values.genre || null,
        total_pages: values.total_pages ? Number(values.total_pages) : null,
        current_page: values.current_page ? Number(values.current_page) : 0,
        status: values.status,
      };
      const res = editingBook
        ? await fetch("/api/leitura/books", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, id: editingBook.id }) })
        : await fetch("/api/leitura/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        toast.success(editingBook ? "Livro atualizado!" : "Livro adicionado à estante 📚");
        setAddModal(false);
        setEditingBook(null);
        await loadAll();
      } else {
        toast.error("Erro ao salvar livro");
      }
    } catch {
      toast.error("Erro ao salvar livro");
    }
  };

  const deleteBook = async (book: ReadingBook) => {
    if (!window.confirm(`Remover "${book.title}" da sua estante?`)) return;
    try {
      const res = await fetch(`/api/leitura/books?id=${book.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Livro removido");
        await loadAll();
      }
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const completeBook = async (book: ReadingBook) => {
    try {
      const res = await fetch("/api/leitura/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: book.id, status: "concluido", total_pages: book.total_pages }),
      });
      if (res.ok) {
        toast.success("Leitura concluída! 🎉");
        await loadAll();
      }
    } catch {
      toast.error("Erro ao concluir");
    }
  };

  const reopenBook = async (book: ReadingBook) => {
    try {
      const res = await fetch("/api/leitura/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: book.id, status: "lendo" }),
      });
      if (res.ok) {
        toast.success("Livro reaberto");
        await loadAll();
      }
    } catch {
      toast.error("Erro ao reabrir");
    }
  };

  const saveSession = async (values: SessionFormValues) => {
    try {
      const res = await fetch("/api/leitura/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: values.book_id || null,
          book_title: values.book_title,
          date: values.date,
          pages_read: Number(values.pages_read) || 0,
          minutes_read: Number(values.minutes_read) || 0,
        }),
      });
      if (res.ok) {
        emitCareDataChanged();
        toast.success("Leitura registrada! 🔥");
        setLogModal(false);
        await loadAll();
      } else {
        toast.error("Erro ao registrar leitura");
      }
    } catch {
      toast.error("Erro ao registrar leitura");
    }
  };

  const deleteSession = async (session: ReadingSession) => {
    try {
      const res = await fetch(`/api/leitura/sessions?id=${session.id}`, { method: "DELETE" });
      if (res.ok) {
        emitCareDataChanged();
        await loadAll();
      }
    } catch {
      /* silent */
    }
  };

  const saveSettings = async (goalType: "pages" | "minutes", goalValue: number) => {
    try {
      const res = await fetch("/api/leitura/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_goal_type: goalType, daily_goal_value: goalValue }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        toast.success("Meta salva!");
      }
    } catch {
      toast.error("Erro ao salvar meta");
    }
  };

  // ── Grouping ──────────────────────────────────────────────────

  const lendo = books.filter((b) => b.status === "lendo");
  const queroLer = books.filter((b) => b.status === "quero_ler");
  const concluidos = books.filter((b) => b.status === "concluido");
  const abandonados = books.filter((b) => b.status === "abandonado");

  const recentSessions = useMemo(() => sessions.slice(0, 10), [sessions]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ ...BG_GRADIENT, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "22px 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BookOpen size={24} color="#A78BFA" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: FOREGROUND }}>
              {t("leitura")}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => router.push("/leitura/leitor")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 14px", borderRadius: 9999, border: 0, cursor: "pointer",
                background: PURPLE_HEX, color: "#fff", fontSize: 13, fontWeight: 700,
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
              <Timer style={{ width: 16, height: 16 }} /> Cronômetro
            </button>
            <button type="button" onClick={() => openLog(activeBooks[0] || null)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "9px 12px", borderRadius: 9999, border: `1px solid ${BORDER}`, cursor: "pointer",
                background: CARD_BG, color: "#A78BFA", fontSize: 13, fontWeight: 700,
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
              <Plus style={{ width: 15, height: 15 }} /> Registrar
            </button>
          </div>
        </div>
      </div>

      {/* Cronômetro ativo */}
      {hasActiveTimer && (
        <div style={{ padding: "0 20px 12px" }}>
          <button type="button" onClick={() => router.push("/leitura/leitor")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 14, cursor: "pointer",
              background: `${PURPLE_HEX}18`, border: `1px solid ${PURPLE_HEX}40`,
              color: FOREGROUND, fontFamily: "inherit",
            }}>
            <Timer style={{ width: 18, height: 18, color: "#A78BFA" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cronômetro de leitura ativo</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>Retomar →</span>
          </button>
        </div>
      )}

      {/* Resumo de hoje */}
      <div style={{ padding: "0 20px 12px" }}>
        <div style={{
          display: "flex", gap: 10, padding: 14, borderRadius: 16,
          background: CARD_BG, border: `1px solid ${BORDER}`,
        }}>
          <StatPill icon={<Flame style={{ width: 18, height: 18 }} />} value={stats.streak} label="dias" color="#FF9A5C" />
          <div style={{ width: 1, background: BORDER, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <Target style={{ width: 13, height: 13 }} />
                Meta de hoje
              </span>
              <span style={{ fontSize: 11, color: stats.goalReached ? "oklch(0.55 0.15 160)" : MUTED, fontWeight: 700 }}>
                {stats.todayProgress}/{stats.goalValue} {stats.goalType === "pages" ? "pág" : "min"}
              </span>
            </div>
            <div style={{
              height: 6, borderRadius: 9999, marginTop: 8,
              background: "oklch(.22 .015 270 / .5)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 9999,
                background: stats.goalReached ? "oklch(0.55 0.15 160)" : PURPLE_HEX,
                width: `${Math.min(100, (stats.todayProgress / Math.max(1, stats.goalValue)) * 100)}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>
              {stats.todayPages} páginas · {stats.todayMinutes} min hoje
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 20px 12px", display: "flex", gap: 6 }}>
        {([{ key: "estante", label: "Estante", icon: <Library style={{ width: 14, height: 14 }} /> },
           { key: "stats", label: "Estatísticas", icon: <BarChart3 style={{ width: 14, height: 14 }} /> }] as const).map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
            style={{
              padding: "8px 16px", borderRadius: 9999, border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              background: tab === tb.key ? PURPLE_HEX : CARD_BG,
              color: tab === tb.key ? "#fff" : MUTED,
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {tb.icon}{tb.label}
          </button>
        ))}
      </div>

      {/* ── Estante ──────────────────────────────────────────────── */}
      {tab === "estante" && (
        <div style={{ padding: "0 20px" }}>
          <button type="button" onClick={openAdd}
            style={{
              width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
              background: "transparent", border: `1px dashed ${PURPLE_HEX}50`,
              color: "#A78BFA", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginBottom: 16,
            }}>
            <Plus style={{ width: 15, height: 15 }} /> Adicionar livro
          </button>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 120, borderRadius: 14, background: CARD_BG, border: `1px solid ${BORDER}` }} />
              ))}
            </div>
          ) : books.length === 0 ? (
            <EmptyState
              emoji="📚"
              title="Sua estante está vazia"
              subtitle="Adicione o livro que você está lendo (ou quer ler) e comece a acompanhar seu hábito de leitura."
              cta="Adicionar primeiro livro"
              onCta={openAdd}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <BookGroup title="Lendo" count={lendo.length} color="#A78BFA">
                {lendo.map((b) => (
                  <ReadingBookCard key={b.id} book={b}
                    onLogSession={openLog} onComplete={completeBook}
                    onReopen={reopenBook} onEdit={openEdit} onDelete={deleteBook} />
                ))}
              </BookGroup>

              <BookGroup title="Quero ler" count={queroLer.length} color={MUTED}>
                {queroLer.map((b) => (
                  <ReadingBookCard key={b.id} book={b}
                    onLogSession={openLog} onComplete={completeBook}
                    onReopen={reopenBook} onEdit={openEdit} onDelete={deleteBook} />
                ))}
              </BookGroup>

              <BookGroup title="Concluídos" count={concluidos.length} color="oklch(0.55 0.15 160)">
                {concluidos.map((b) => (
                  <ReadingBookCard key={b.id} book={b}
                    onLogSession={openLog} onComplete={completeBook}
                    onReopen={reopenBook} onEdit={openEdit} onDelete={deleteBook} />
                ))}
              </BookGroup>

              <BookGroup title="Abandonados" count={abandonados.length} color="oklch(0.6 0.12 20)">
                {abandonados.map((b) => (
                  <ReadingBookCard key={b.id} book={b}
                    onLogSession={openLog} onComplete={completeBook}
                    onReopen={reopenBook} onEdit={openEdit} onDelete={deleteBook} />
                ))}
              </BookGroup>
            </div>
          )}
        </div>
      )}

      {/* ── Estatísticas ─────────────────────────────────────────── */}
      {tab === "stats" && (
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Contadores */}
          <div style={{ display: "flex", gap: 10 }}>
            <MiniStat icon="📖" value={stats.booksReading} label="Lendo" />
            <MiniStat icon="✅" value={stats.booksCompleted} label="Concluídos" />
            <MiniStat icon="🔥" value={stats.streak} label="Sequência" />
          </div>

          {/* Semana / Mês */}
          <SummaryCard icon={<Clock style={{ width: 16, height: 16 }} />} title="Esta semana">
            <SummaryRow label="Páginas" value={stats.weekPages} />
            <SummaryRow label="Minutos" value={stats.weekMinutes} />
            <SummaryRow label="Dias lendo" value={`${stats.weekDays} de 7`} />
          </SummaryCard>

          <SummaryCard icon={<FileText style={{ width: 16, height: 16 }} />} title="Este mês">
            <SummaryRow label="Páginas" value={stats.monthPages} />
            <SummaryRow label="Minutos" value={stats.monthMinutes} />
            <SummaryRow label="Dias lendo" value={stats.monthDays} />
          </SummaryCard>

          {/* Meta */}
          <GoalCard
            goalType={settings.daily_goal_type}
            goalValue={settings.daily_goal_value}
            onSave={saveSettings}
          />

          {/* Histórico recente */}
          {recentSessions.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: FOREGROUND, margin: "0 0 8px" }}>
                Últimos registros
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentSessions.map((s) => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 12, background: CARD_BG, border: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: FOREGROUND, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.book_title}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED }}>
                        {formatDate(s.date)} · {s.pages_read} pág · {s.minutes_read} min
                      </p>
                    </div>
                    <button type="button" onClick={() => deleteSession(s)}
                      style={{ background: "none", border: 0, color: MUTED, cursor: "pointer", fontSize: 14 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {addModal && (
        <ReadingAddBookModal
          initial={editingBook}
          onClose={() => { setAddModal(false); setEditingBook(null); }}
          onSave={saveBook}
        />
      )}
      {logModal && (
        <ReadingLogSessionModal
          books={activeBooks}
          initialBookId={logBookId}
          onClose={() => setLogModal(false)}
          onSave={saveSession}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatPill({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0 }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 10, color: MUTED }}>{label}</span>
    </div>
  );
}

function MiniStat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div style={{
      flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center",
      background: CARD_BG, border: `1px solid ${BORDER}`,
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
    </div>
  );
}

function SummaryCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#A78BFA", display: "flex", alignItems: "center", gap: 6 }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: FOREGROUND }}>{value}</span>
    </div>
  );
}

function GoalCard({ goalType, goalValue, onSave }: {
  goalType: "pages" | "minutes";
  goalValue: number;
  onSave: (type: "pages" | "minutes", value: number) => void;
}) {
  const [type, setType] = useState<"pages" | "minutes">(goalType);
  const [value, setValue] = useState(String(goalValue));

  useEffect(() => {
    setType(goalType);
    setValue(String(goalValue));
  }, [goalType, goalValue]);

  return (
    <div style={{ padding: 14, borderRadius: 16, background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#A78BFA", display: "flex", alignItems: "center", gap: 6 }}>
        <Target style={{ width: 15, height: 15 }} /> Meta diária
      </h3>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([{ v: "pages", label: "Páginas" }, { v: "minutes", label: "Minutos" }] as const).map((o) => (
          <button key={o.v} type="button" onClick={() => setType(o.v)}
            style={{
              flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: type === o.v ? `${PURPLE_HEX}30` : "oklch(.20 .015 270 / .4)",
              color: type === o.v ? "#A78BFA" : MUTED,
              border: type === o.v ? `1px solid ${PURPLE_HEX}50` : "1px solid transparent",
            }}>
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, background: "oklch(.20 .015 270 / .5)",
            border: `1px solid ${BORDER}`, color: FOREGROUND, fontSize: 14, fontFamily: "inherit", outline: "none",
          }} />
        <button type="button" onClick={() => onSave(type, Math.max(1, Number(value) || 1))}
          style={{
            padding: "10px 16px", borderRadius: 10, border: 0, cursor: "pointer",
            background: PURPLE_HEX, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

function EmptyState({ emoji, title, subtitle, cta, onCta }: {
  emoji: string; title: string; subtitle: string; cta: string; onCta: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "40px 16px" }}>
      <span style={{ fontSize: 48 }}>{emoji}</span>
      <p style={{ color: FOREGROUND, fontSize: 15, fontWeight: 600, margin: "12px 0 4px" }}>{title}</p>
      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5, maxWidth: 300, margin: "0 auto 16px" }}>{subtitle}</p>
      <button type="button" onClick={onCta}
        style={{
          padding: "10px 20px", borderRadius: 9999, border: 0, cursor: "pointer",
          background: PURPLE_HEX, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
        }}>
        {cta}
      </button>
    </div>
  );
}

function BookGroup({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color, margin: "0 0 8px" }}>
        {title} ({count})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
