"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Calendar, Sun, List,
  CheckCircle2, GripVertical, Plus, Clock, Star, Zap, Leaf,
} from "lucide-react";
import { getLocalDate } from "@/lib/utils";
import type { AgendaItem, EisenhowerPriority } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${d.toLocaleDateString("pt-BR", { month: "long" })}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITY_CONFIG: Record<EisenhowerPriority, { icon: typeof Alert; color: string; label: string; shortLabel: string }> = {
  importante_urgente:          { icon: Alert, color: "#FF4D4D", label: "Importante e urgente", shortLabel: "Urgente" },
  importante_nao_urgente:      { icon: Star, color: "#FF9F43", label: "Importante não urgente", shortLabel: "Importante" },
  nao_importante_urgente:      { icon: Zap,  color: "#FFD43B", label: "Não importante mas urgente", shortLabel: "Urgente NP" },
  nao_importante_nao_urgente:  { icon: Leaf, color: "#4CD97B", label: "Não importante e não urgente", shortLabel: "Baixa" },
};

// ── PriorityBadge ────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: EisenhowerPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      <Icon size={10} /> {cfg.shortLabel}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────

type ViewMode = "dia" | "semana" | "lista";
type FilterType = "todos" | "compromisso" | "tarefa";

export default function AgendaPage() {
  const router = useRouter();
  const today = getLocalDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const [filterType, setFilterType] = useState<FilterType>("todos");
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemType, setNewItemType] = useState<"compromisso" | "tarefa">("tarefa");

  const fetchItems = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agenda?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(selectedDate); }, [selectedDate, fetchItems]);

  const compromissos = useMemo(() =>
    items.filter(i => i.item_type === "compromisso").sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
  [items]);

  const tarefas = useMemo(() =>
    items.filter(i => i.item_type === "tarefa"),
  [items]);

  const filteredCompromissos = filterType === "tarefa" ? [] : compromissos;
  const filteredTarefas = filterType === "compromisso" ? [] : tarefas;

  const pendingTarefas = filteredTarefas.filter(t => t.status !== "concluida");
  const completedTarefas = filteredTarefas.filter(t => t.status === "concluida");

  const toggleTask = async (item: AgendaItem) => {
    const newStatus = item.status === "concluida" ? "pendente" : "concluida";
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    await fetch("/api/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status: newStatus }),
    });
  };

  // ── Timeline calculations ──────────────────────────────────────
  const TIMELINE_START = 7;  // 07:00
  const TIMELINE_END = 22;   // 22:00
  const TOTAL_MINUTES = (TIMELINE_END - TIMELINE_START) * 60;

  const getTopPct = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const mins = (h - TIMELINE_START) * 60 + m;
    return Math.max(0, (mins / TOTAL_MINUTES) * 100);
  };

  const getHeightPct = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh - sh) * 60 + (em - sm);
    return Math.max(2, (mins / TOTAL_MINUTES) * 100);
  };

  const HOUR_LABELS = Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, i) => {
    const h = TIMELINE_START + i;
    return `${String(h).padStart(2, "0")}:00`;
  });

  // ── View switching ─────────────────────────────────────────────
  if (viewMode === "semana") {
    router.push("/planejamento");
    return null;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Title + Date navigation ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#e0d6ff", letterSpacing: "-0.02em" }}>
              Agenda do dia
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#A78BFA", fontWeight: 500 }}>
              {formatDateLabel(selectedDate)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
              style={navBtnStyle}><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
              style={navBtnStyle}><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setSelectedDate(today)}
              style={{ ...navBtnStyle, background: "#7C5CFF", color: "#fff" }}>
              <Calendar size={18} />
            </button>
          </div>
        </div>

        {/* ── Segmented control Dia/Semana/Lista ────────────────── */}
        <div style={{
          display: "flex", borderRadius: 14, background: "#1a1530",
          border: "1px solid rgba(167,139,250,0.15)", padding: 3,
          marginBottom: 16,
        }}>
          {([
            { key: "dia", icon: Sun, label: "Dia" },
            { key: "semana", icon: Calendar, label: "Semana" },
            { key: "lista", icon: List, label: "Lista" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} type="button" onClick={() => setViewMode(key)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: 0,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6, fontFamily: "inherit",
                fontSize: 13, fontWeight: 600,
                background: viewMode === key
                  ? "linear-gradient(135deg, #7C5CFF, #A78BFA)"
                  : "transparent",
                color: viewMode === key ? "#fff" : "#9e96b5",
                transition: "all 0.2s ease",
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Toggle Compromisso/Tarefa ─────────────────────────── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button type="button" onClick={() => setFilterType(filterType === "compromisso" ? "todos" : "compromisso")}
            style={{
              flex: 3, padding: "12px 0", borderRadius: 14, border: 0, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: filterType === "compromisso" || filterType === "todos"
                ? "linear-gradient(135deg, #7C5CFF, #A78BFA)" : "#1a1530",
              color: filterType === "compromisso" || filterType === "todos" ? "#fff" : "#9e96b5",
              border: filterType === "compromisso" || filterType === "todos" ? "none" : "1px solid rgba(167,139,250,0.15)",
            }}>
            📅 Compromissos
          </button>
          <button type="button" onClick={() => setFilterType(filterType === "tarefa" ? "todos" : "tarefa")}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 14, border: 0, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: filterType === "tarefa" || filterType === "todos"
                ? "linear-gradient(135deg, #7C5CFF, #A78BFA)" : "#1a1530",
              color: filterType === "tarefa" || filterType === "todos" ? "#fff" : "#9e96b5",
              border: filterType === "tarefa" || filterType === "todos" ? "none" : "1px solid rgba(167,139,250,0.15)",
            }}>
            ☑️ Tarefas
          </button>
        </div>

        {/* ── Priority Legend ──────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginBottom: 20 }}>
          {(Object.entries(PRIORITY_CONFIG) as [EisenhowerPriority, typeof PRIORITY_CONFIG[EisenhowerPriority]][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "#9e96b5" }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", background: cfg.color + "22",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={10} color={cfg.color} />
                </span>
                {cfg.shortLabel}
              </span>
            );
          })}
        </div>

        {/* ── TIMELINE ─────────────────────────────────────────── */}
        {filteredCompromissos.length > 0 && (
          <div style={{
            background: "#1a1530", borderRadius: 18,
            border: "1px solid rgba(167,139,250,0.12)",
            padding: "12px 0", marginBottom: 20, position: "relative",
          }}>
            <div style={{ display: "flex", minHeight: 400, position: "relative" }}>
              {/* Hour labels */}
              <div style={{ width: 48, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 4 }}>
                {HOUR_LABELS.map((label) => (
                  <div key={label} style={{
                    flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                    paddingRight: 8,
                  }}>
                    <span style={{ fontSize: 10, color: "#9e96b5", lineHeight: 1 }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Timeline track */}
              <div style={{ flex: 1, position: "relative", minHeight: 400 }}>
                {/* Vertical line */}
                <div style={{
                  position: "absolute", left: 0, top: 6, bottom: 6, width: 2,
                  background: "linear-gradient(to bottom, #A78BFA 0%, #7C5CFF 50%, #A78BFA 100%)",
                  borderRadius: 1,
                }} />

                {/* Event cards */}
                {filteredCompromissos.map((item) => {
                  const top = getTopPct(item.start_time || "07:00");
                  const height = item.end_time
                    ? getHeightPct(item.start_time || "07:00", item.end_time)
                    : 8;
                  const priorityCfg = PRIORITY_CONFIG[item.priority as EisenhowerPriority] || PRIORITY_CONFIG.importante_nao_urgente;
                  const PriorityIcon = priorityCfg.icon;

                  return (
                    <div key={item.id}
                      style={{
                        position: "absolute", left: 12, right: 8,
                        top: `${top}%`, height: `${height}%`, minHeight: 50,
                        background: "rgba(124,92,255,0.12)",
                        border: "1px solid rgba(167,139,250,0.2)",
                        borderRadius: 12, padding: "10px 12px",
                        display: "flex", flexDirection: "column",
                        justifyContent: "center",
                      }}>
                      <span style={{ fontSize: 9, color: "#A78BFA", marginBottom: 2 }}>
                        {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff", flex: 1 }}>
                          {item.emoji && <span style={{ marginRight: 4 }}>{item.emoji}</span>}
                          {item.title}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: priorityCfg.color, whiteSpace: "nowrap" }}>
                          <PriorityIcon size={9} /> {priorityCfg.shortLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty timeline state */}
        {filteredCompromissos.length === 0 && filterType !== "tarefa" && (
          <div style={{
            textAlign: "center", padding: "32px 16px", marginBottom: 20,
            background: "#1a1530", borderRadius: 18,
            border: "1px dashed rgba(167,139,250,0.15)",
          }}>
            <p style={{ color: "#9e96b5", fontSize: 13 }}>Nenhum compromisso hoje</p>
            <button type="button" onClick={() => { setNewItemType("compromisso"); setShowNewItem(true); }}
              style={{
                marginTop: 8, padding: "8px 16px", borderRadius: 10, border: 0, cursor: "pointer",
                background: "#7C5CFF", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              }}>
              + Novo compromisso
            </button>
          </div>
        )}

        {/* ── TAREFAS DO DIA ───────────────────────────────────── */}
        <div style={{
          background: "#151520", borderRadius: 18,
          border: "1px solid rgba(167,139,250,0.1)",
          padding: "16px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>Tarefas do dia</h2>
              {pendingTarefas.length > 0 && (
                <span style={{
                  padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 600,
                  background: "rgba(167,139,250,0.15)", color: "#A78BFA",
                }}>
                  {pendingTarefas.length} restante{pendingTarefas.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button type="button" onClick={() => { setNewItemType("tarefa"); setShowNewItem(true); }}
              style={{
                background: "none", border: 0, cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "#A78BFA",
                display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
              }}>
              <Plus size={14} /> Nova tarefa
            </button>
          </div>

          {/* Pending tasks */}
          {pendingTarefas.length === 0 && completedTarefas.length === 0 ? (
            <p style={{ color: "#9e96b5", fontSize: 12, textAlign: "center", padding: 16 }}>Nenhuma tarefa para hoje</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...pendingTarefas, ...completedTarefas].map((item) => {
                const done = item.status === "concluida";
                const priorityCfg = PRIORITY_CONFIG[item.priority as EisenhowerPriority] || PRIORITY_CONFIG.importante_nao_urgente;
                const PriorityIcon = priorityCfg.icon;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 12,
                    background: done ? "transparent" : "rgba(124,92,255,0.04)",
                    border: done ? "1px solid transparent" : "1px solid rgba(167,139,250,0.08)",
                  }}>
                    <button type="button" onClick={() => toggleTask(item)}
                      style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)",
                        background: done ? "#7C5CFF" : "transparent",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      {done && <CheckCircle2 size={14} color="#fff" />}
                    </button>
                    <span style={{
                      flex: 1, fontSize: 13, fontWeight: done ? 400 : 500,
                      color: done ? "#5a5470" : "#e0d6ff",
                      textDecoration: done ? "line-through" : "none",
                    }}>
                      {item.emoji && <span style={{ marginRight: 4 }}>{item.emoji}</span>}
                      {item.title}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, color: priorityCfg.color }}>
                      <PriorityIcon size={9} /> {priorityCfg.shortLabel}
                    </span>
                    <GripVertical size={14} color="#5a5470" style={{ cursor: "grab", flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.15)",
  background: "#1a1530", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#e0d6ff",
};
