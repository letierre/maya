"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Star, Sparkles, Plus, Clock, Pencil, Trash2, X,
} from "lucide-react";
import type { Goal, GoalStage, GoalAction, WeeklyPlan, WeeklyReview, WeeklyTask, TaskArea } from "@/types";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_CONFIG: Record<string, { emoji: string; hue: number; labelKey: string }> = {
  saude:           { emoji: "💚", hue: 160, labelKey: "area_saude" },
  carreira:        { emoji: "💼", hue: 220, labelKey: "area_carreira" },
  financas:        { emoji: "💰", hue: 85,  labelKey: "area_financas" },
  relacionamentos: { emoji: "❤️", hue: 15,  labelKey: "area_relacionamentos" },
  desenvolvimento: { emoji: "🧠", hue: 270, labelKey: "area_desenvolvimento" },
  familia:         { emoji: "🏡", hue: 40,  labelKey: "area_familia" },
  lazer:           { emoji: "🌊", hue: 185, labelKey: "area_lazer" },
  espiritualidade: { emoji: "✨", hue: 300, labelKey: "area_espiritualidade" },
  outros:          { emoji: "⚪", hue: 200, labelKey: "area_outros" },
};

const DAY_KEYS = ["dia_seg", "dia_ter", "dia_qua", "dia_qui", "dia_sex", "dia_sab", "dia_dom"];
const ALL_AREAS = Object.keys(AREA_CONFIG) as TaskArea[];

function ac(hue: number, l = 0.5, c = 0.12) { return `oklch(${l} ${c} ${hue})`; }
function al(hue: number) { return `oklch(.95 .05 ${hue})`; }

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };
type PlanFull = WeeklyPlan & {
  weekly_reviews: WeeklyReview[];
  weekly_focus_goals: { goal_id: string }[];
  weekly_tasks: WeeklyTask[];
};
type PlanData = { current: PlanFull | null; history: (WeeklyPlan & { weekly_reviews?: WeeklyReview[] })[] };

function weekLabel() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function getISOWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function weekRange(): string {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} style={{
          border: 0, background: "none", padding: 0, cursor: "pointer", fontSize: 28,
          filter: n <= value ? "none" : "grayscale(1) opacity(.35)",
          transition: "filter .15s ease",
        }}>⭐</button>
      ))}
    </div>
  );
}

// ── Focus editor (pedras principais) ──────────────────────────────────────────

function FocusModal({
  initial, goals, onClose, onSaved, lang = "pt",
}: {
  initial: { f1: string; f2: string; f3: string; focusGoalIds: string[] };
  goals: GoalFull[];
  onClose: () => void;
  onSaved: () => void;
  lang?: Lang;
}) {
  const [f1, setF1] = useState(initial.f1);
  const [f2, setF2] = useState(initial.f2);
  const [f3, setF3] = useState(initial.f3);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(initial.focusGoalIds);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (id: string) =>
    setSelectedGoals((p) => p.includes(id) ? p.filter((g) => g !== id) : p.length < 5 ? [...p, id] : p);

  const save = async () => {
    if (!f1.trim()) return;
    setSaving(true);
    await fetch("/api/weekly-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        main_focus: f1,
        main_focus_2: f2.trim() || null,
        main_focus_3: f3.trim() || null,
        focus_goal_ids: selectedGoals,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>{tFn(lang, "plan_pedras_modal_title")}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "oklch(.55 .04 160)" }}>
          {tFn(lang, "plan_pedras_desc")} · {weekLabel()}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {[
            { val: f1, set: setF1, labelKey: "plan_pedra_1", phKey: "plan_pedra_1_ph" },
            { val: f2, set: setF2, labelKey: "plan_pedra_2", phKey: "plan_pedra_2_ph" },
            { val: f3, set: setF3, labelKey: "plan_pedra_3", phKey: "plan_pedra_3_ph" },
          ].map(({ val, set, labelKey, phKey }) => (
            <div key={labelKey}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>{tFn(lang, labelKey)}</p>
              <input value={val} onChange={(e) => set(e.target.value)} placeholder={tFn(lang, phKey)}
                style={inputStyle}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.5 .12 160)"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
              />
            </div>
          ))}
        </div>

        {goals.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_metas_destaque")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((g) => {
                const conf = AREA_CONFIG[g.area] ?? AREA_CONFIG.outros;
                const sel = selectedGoals.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => toggleGoal(g.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                    borderRadius: 13, border: sel ? `2px solid ${ac(conf.hue)}` : "2px solid oklch(.88 .02 160)",
                    background: sel ? al(conf.hue) : "#fff", cursor: "pointer", textAlign: "left",
                    transition: "all .15s ease",
                  }}>
                    <span style={{ fontSize: 17 }}>{conf.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "oklch(.25 .02 160)" }}>{g.title}</span>
                    {sel && <Check size={15} style={{ color: ac(conf.hue), flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button type="button" onClick={save} disabled={saving || !f1.trim()} style={{
          width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (saving || !f1.trim()) ? "not-allowed" : "pointer",
          background: (saving || !f1.trim()) ? "oklch(.88 .02 160)" : "oklch(.5 .12 160)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (saving || !f1.trim()) ? "oklch(.6 .02 160)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
        </button>
      </div>
    </>
  );
}

// ── Add Task Sheet ─────────────────────────────────────────────────────────────

function AddTaskSheet({
  goals, initialDay, onClose, onSaved, lang,
}: {
  goals: GoalFull[];
  initialDay?: number;
  onClose: () => void;
  onSaved: (task: WeeklyTask) => void;
  lang: Lang;
}) {
  const [title, setTitle]           = useState("");
  const [area, setArea]             = useState<TaskArea | "">("");
  const [day, setDay]               = useState<number>(initialDay ?? (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1));
  const [time, setTime]             = useState("");
  const [taskType, setTaskType]     = useState<"crescimento" | "manutencao">("manutencao");
  const [linkedGoalId, setLinkedGoalId]     = useState("");
  const [linkedActionId, setLinkedActionId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedGoal = goals.find((g) => g.id === linkedGoalId);
  const availableActions = selectedGoal
    ? (selectedGoal.goal_stages ?? []).flatMap((s) =>
        (s.goal_actions ?? []).filter((a) => a.status === "pendente")
      )
    : [];

  const canSave = title.trim().length >= 2 && area !== "" && day !== undefined;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const res = await fetch("/api/weekly-plans/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        area,
        task_type: taskType,
        linked_goal_id: linkedGoalId || null,
        linked_action_id: linkedActionId || null,
        day_of_week: day,
        scheduled_time: time || null,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      onSaved(task);
      onClose();
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "92dvh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>{tFn(lang, "plan_nova_tarefa")}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "oklch(.93 .02 160)", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "oklch(.45 .06 160)" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Dia */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_dia_semana")}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {DAY_KEYS.map((dk, i) => (
                <button key={i} type="button" onClick={() => setDay(i)} style={{
                  flex: 1, padding: "9px 2px", borderRadius: 10, border: 0, cursor: "pointer",
                  background: day === i ? "oklch(.5 .12 160)" : "oklch(.93 .02 160)",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                  color: day === i ? "#fff" : "oklch(.45 .06 160)",
                  transition: "all .12s ease",
                }}>
                  {tFn(lang, dk)}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_titulo_campo")}
            </p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tFn(lang, "plan_titulo_ph")}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.5 .12 160)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          {/* Área */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_area_vida")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {ALL_AREAS.map((a) => {
                const conf = AREA_CONFIG[a];
                const sel = area === a;
                return (
                  <button key={a} type="button" onClick={() => setArea(a)} style={{
                    padding: "10px 6px", borderRadius: 12, border: sel ? `2px solid ${ac(conf.hue)}` : "2px solid oklch(.88 .02 160)",
                    background: sel ? al(conf.hue) : "#fff", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    transition: "all .12s ease",
                  }}>
                    <span style={{ fontSize: 18 }}>{conf.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sel ? ac(conf.hue) : "oklch(.45 .04 160)" }}>
                      {tFn(lang, conf.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipo */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_tipo")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { val: "manutencao", labelKey: "plan_manutencao", descKey: "plan_manutencao_desc" },
                { val: "crescimento", labelKey: "plan_crescimento", descKey: "plan_crescimento_desc" },
              ] as const).map(({ val, labelKey, descKey }) => (
                <button key={val} type="button" onClick={() => { setTaskType(val); if (val === "manutencao") { setLinkedGoalId(""); setLinkedActionId(""); } }} style={{
                  flex: 1, padding: "12px 10px", borderRadius: 13,
                  border: taskType === val ? "2px solid oklch(.5 .12 160)" : "2px solid oklch(.88 .02 160)",
                  background: taskType === val ? "oklch(.95 .05 160)" : "#fff",
                  cursor: "pointer", textAlign: "left",
                  transition: "all .12s ease",
                }}>
                  <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "oklch(.25 .02 160)" }}>{val === "manutencao" ? "🔄" : "🚀"} {tFn(lang, labelKey)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "oklch(.55 .04 160)" }}>{tFn(lang, descKey)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "plan_horario")}
            </p>
            <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, padding: 0, overflow: "hidden" }}>
              <Clock size={15} style={{ color: "oklch(.6 .04 160)", marginLeft: 14, flexShrink: 0 }} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{
                  flex: 1, padding: "12px 14px 12px 6px", border: "none",
                  background: "transparent", fontFamily: "inherit",
                  fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
                }}
              />
            </div>
          </div>

          {/* Meta vinculada (só se crescimento) */}
          {taskType === "crescimento" && goals.length > 0 && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                {tFn(lang, "plan_vincular_meta")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {goals.map((g) => {
                  const conf = AREA_CONFIG[g.area] ?? AREA_CONFIG.outros;
                  const sel = linkedGoalId === g.id;
                  return (
                    <button key={g.id} type="button"
                      onClick={() => { setLinkedGoalId(sel ? "" : g.id); setLinkedActionId(""); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        borderRadius: 12, border: sel ? `2px solid ${ac(conf.hue)}` : "2px solid oklch(.88 .02 160)",
                        background: sel ? al(conf.hue) : "#fff", cursor: "pointer", textAlign: "left",
                        transition: "all .12s ease",
                      }}>
                      <span style={{ fontSize: 16 }}>{conf.emoji}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "oklch(.25 .02 160)" }}>{g.title}</span>
                      {sel && <Check size={14} style={{ color: ac(conf.hue), flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {availableActions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                    {tFn(lang, "plan_vincular_acao")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {availableActions.map((a) => {
                      const sel = linkedActionId === a.id;
                      return (
                        <button key={a.id} type="button" onClick={() => setLinkedActionId(sel ? "" : a.id)} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                          borderRadius: 12, border: sel ? "2px solid oklch(.5 .12 160)" : "2px solid oklch(.88 .02 160)",
                          background: sel ? "oklch(.95 .05 160)" : "#fff", cursor: "pointer", textAlign: "left",
                          transition: "all .12s ease",
                        }}>
                          <span style={{ fontSize: 13, flex: 1, color: "oklch(.3 .04 160)" }}>{a.title}</span>
                          {sel && <Check size={14} style={{ color: "oklch(.5 .12 160)", flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={save} disabled={!canSave || saving} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (!canSave || saving) ? "not-allowed" : "pointer",
          background: (!canSave || saving) ? "oklch(.88 .02 160)" : "oklch(.5 .12 160)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (!canSave || saving) ? "oklch(.6 .02 160)" : "#fff",
          transition: "all .15s ease",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "plan_adicionar_tarefa")}
        </button>
      </div>
    </>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({ onClose, onSaved, lang = "pt" }: { onClose: () => void; onSaved: () => void; lang?: Lang }) {
  const [biggestWin, setBiggestWin]   = useState("");
  const [blockedLesson, setBlockedLesson] = useState("");
  const [mainLearning, setMainLearning]   = useState("");
  const [weekScore, setWeekScore]     = useState(3);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!biggestWin.trim()) return;
    setSaving(true);
    await fetch("/api/weekly-plans/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ biggest_win: biggestWin, blocked_lesson: blockedLesson, main_learning: mainLearning, week_score: weekScore }),
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none", resize: "none", lineHeight: 1.6,
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>{tFn(lang, "plan_revisao_modal_title")}</h2>
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "oklch(.55 .04 160)" }}>{weekLabel()}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>{tFn(lang, "plan_maior_vitoria_q")}</p>
            <textarea value={biggestWin} onChange={(e) => setBiggestWin(e.target.value)} placeholder={tFn(lang, "plan_maior_vitoria_ph")} rows={2} style={fieldStyle} />
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>{tFn(lang, "plan_travou_q")}</p>
            <textarea value={blockedLesson} onChange={(e) => setBlockedLesson(e.target.value)} placeholder={tFn(lang, "plan_travou_ph")} rows={2} style={fieldStyle} />
          </div>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>{tFn(lang, "plan_aprendizado_q")}</p>
            <textarea value={mainLearning} onChange={(e) => setMainLearning(e.target.value)} placeholder={tFn(lang, "plan_aprendizado_ph")} rows={2} style={fieldStyle} />
          </div>
          <div>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>{tFn(lang, "plan_como_foi_semana")}</p>
            <StarRating value={weekScore} onChange={setWeekScore} />
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving || !biggestWin.trim()} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (saving || !biggestWin.trim()) ? "not-allowed" : "pointer",
          background: (saving || !biggestWin.trim()) ? "oklch(.88 .02 160)" : "linear-gradient(135deg, oklch(.5 .12 160), oklch(.42 .14 200))",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "plan_fechar_semana")}
        </button>
      </div>
    </>
  );
}

// ── Task row (Bento style) ────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete }: {
  task: WeeklyTask; onToggle: () => void; onDelete: () => void;
}) {
  const conf = AREA_CONFIG[task.area] ?? AREA_CONFIG.outros;
  const done = task.status === "concluida";
  const isHabit = task.task_type === "manutencao";
  const hue = conf.hue;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 12,
      background: done ? "oklch(.97 .015 160)" : "#fff",
      border: `1px solid oklch(.5 .12 ${hue} / .12)`,
    }}>
      <button type="button" onClick={onToggle} style={{
        width: 20, height: 20, flexShrink: 0, cursor: "pointer",
        borderRadius: isHabit ? 9999 : 6,
        background: done ? `oklch(.45 .12 ${hue})` : "transparent",
        border: done ? "none" : `1.5px solid oklch(.5 .12 ${hue} / .4)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
          color: done ? "oklch(.55 .03 160)" : "oklch(.2 .02 160)",
          textDecoration: done ? "line-through" : "none",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{task.title}</p>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
          <span style={{ fontSize: 10 }}>{conf.emoji}</span>
          {task.scheduled_time && (
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono, ui-monospace)", color: "oklch(.55 .03 160)" }}>
              {task.scheduled_time.slice(0, 5)}
            </span>
          )}
          {!isHabit ? (
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
              padding: "1px 6px", borderRadius: 9999,
              background: `oklch(.92 .08 ${hue} / .6)`, color: `oklch(.4 .14 ${hue})`,
            }}>↑ Crescer</span>
          ) : (
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
              padding: "1px 6px", borderRadius: 9999,
              background: "oklch(.95 .005 160)", color: "oklch(.55 .03 160)",
            }}>↻ Hábito</span>
          )}
        </div>
      </div>
      <button type="button" onClick={onDelete} style={{
        border: 0, background: "none", cursor: "pointer", padding: 4, flexShrink: 0,
        color: "oklch(.75 .03 160)",
      }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Pedra card ────────────────────────────────────────────────────────────────

function Pedra({ rank, size, text, linkedGoal }: {
  rank: string; size: "lg" | "md" | "sm"; text: string; linkedGoal?: string;
}) {
  const SIZE_MAP = {
    lg: { num: 32, py: 16, fs: 16,   accent: "oklch(.42 .14 220)", bg: "linear-gradient(135deg, oklch(.95 .06 220) 0%, oklch(.92 .08 210) 100%)" },
    md: { num: 26, py: 13, fs: 14.5, accent: "oklch(.5 .12 220)",  bg: "linear-gradient(135deg, oklch(.96 .04 220) 0%, oklch(.94 .055 215) 100%)" },
    sm: { num: 22, py: 11, fs: 13.5, accent: "oklch(.55 .1 220)",  bg: "linear-gradient(135deg, oklch(.97 .03 220) 0%, oklch(.95 .04 220) 100%)" },
  };
  const s = SIZE_MAP[size];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: `${s.num + 22}px 1fr`, gap: 14,
      padding: `${s.py}px 16px`, borderRadius: 16, marginBottom: 8,
      background: s.bg, border: "1px solid oklch(.5 .12 220 / .15)",
      position: "relative", overflow: "hidden",
    }}>
      <span style={{
        fontSize: s.num, fontWeight: 800, lineHeight: .9,
        letterSpacing: "-0.04em", color: s.accent,
        fontFamily: "var(--font-mono, ui-monospace)",
        opacity: .65, alignSelf: "center",
      }}>{rank}</span>
      <div style={{ minWidth: 0, alignSelf: "center" }}>
        <p style={{
          margin: 0, fontSize: s.fs, fontWeight: 600, lineHeight: 1.3,
          letterSpacing: "-0.01em", color: "oklch(.2 .04 220)",
        }}>{text}</p>
        {linkedGoal && (
          <p style={{
            margin: "3px 0 0", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em",
            textTransform: "uppercase", color: s.accent, opacity: .8,
          }}>↳ {linkedGoal}</p>
        )}
      </div>
    </div>
  );
}

// ── Areas radar SVG ───────────────────────────────────────────────────────────

function AreasRadar({ counts }: { counts: Record<string, number> }) {
  const AREAS_RADAR = [
    { key: "saude",           label: "Saúde",    emoji: "💚", hue: 160 },
    { key: "carreira",        label: "Carreira", emoji: "💼", hue: 220 },
    { key: "financas",        label: "Finanças", emoji: "💰", hue: 85  },
    { key: "relacionamentos", label: "Relac.",   emoji: "❤️", hue: 15  },
    { key: "desenvolvimento", label: "Desenv.",  emoji: "🧠", hue: 270 },
    { key: "familia",         label: "Família",  emoji: "🏡", hue: 40  },
    { key: "lazer",           label: "Lazer",    emoji: "🌊", hue: 185 },
    { key: "espiritualidade", label: "Espirit.", emoji: "✨", hue: 300 },
    { key: "outros",          label: "Outros",   emoji: "⚪", hue: 200 },
  ];
  const N = AREAS_RADAR.length;
  const MAX = 5;
  const cx = 140, cy = 140, R = 92;

  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const r = R * (Math.min(v, MAX) / MAX);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ringPt = (i: number, ratio: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + R * ratio * Math.cos(a), cy + R * ratio * Math.sin(a)];
  };
  const lblPt = (i: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + (R + 22) * Math.cos(a), cy + (R + 22) * Math.sin(a)];
  };

  const polyPoints = AREAS_RADAR.map((a, i) => pt(i, counts[a.key] ?? 0).join(",")).join(" ");
  const covered = AREAS_RADAR.filter((a) => (counts[a.key] ?? 0) > 0).length;
  const uncovered = AREAS_RADAR.filter((a) => (counts[a.key] ?? 0) === 0).map((a) => a.label);

  return (
    <div style={{
      borderRadius: 22, padding: "18px 18px 16px",
      background: `
        radial-gradient(circle at 50% 100%, oklch(.92 .08 180 / .35), transparent 60%),
        linear-gradient(180deg, #fff 0%, oklch(.97 .015 180) 100%)
      `,
      border: "1px solid oklch(.5 .12 180 / .12)",
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(.35 .14 180)" }}>
          Roda das áreas
        </p>
        <span style={{ fontSize: 10.5, color: "oklch(.55 .03 160)" }}>
          {covered} de {AREAS_RADAR.length} cobertas
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
        <svg viewBox="0 0 280 280" style={{ width: 280, height: 280 }}>
          {[1, 0.75, 0.5, 0.25].map((r, idx) => (
            <polygon key={idx}
              points={AREAS_RADAR.map((_, i) => ringPt(i, r).join(",")).join(" ")}
              fill="none" stroke="oklch(.5 .12 180 / .12)" strokeWidth="1" />
          ))}
          {AREAS_RADAR.map((_, i) => {
            const [x, y] = ringPt(i, 1);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="oklch(.5 .12 180 / .12)" strokeWidth="1" />;
          })}
          <polygon points={polyPoints}
            fill="oklch(.5 .12 180 / .22)"
            stroke="oklch(.35 .14 180)" strokeWidth="1.8" strokeLinejoin="round" />
          {AREAS_RADAR.map((a, i) => {
            const v = counts[a.key] ?? 0;
            if (v === 0) return null;
            const [x, y] = pt(i, v);
            return <circle key={a.key} cx={x} cy={y} r="3" fill="#fff" stroke="oklch(.35 .14 180)" strokeWidth="1.5" />;
          })}
          {AREAS_RADAR.map((a, i) => {
            const [lx, ly] = lblPt(i);
            const isZero = (counts[a.key] ?? 0) === 0;
            return (
              <g key={a.key + "lbl"} transform={`translate(${lx} ${ly})`}>
                <text textAnchor="middle" dominantBaseline="middle" dy="-6"
                  fontSize="14" opacity={isZero ? 0.4 : 1}>{a.emoji}</text>
                <text textAnchor="middle" dominantBaseline="middle" dy="8"
                  fontSize="9" fontWeight="700"
                  fill={isZero ? "oklch(.7 .02 160)" : `oklch(.45 .14 ${a.hue})`}
                  letterSpacing=".05em">
                  {a.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {uncovered.length > 0 && (
        <p style={{ margin: 0, fontSize: 11, color: "oklch(.55 .03 160)", textAlign: "center", fontStyle: "italic" }}>
          {uncovered.join(", ")} sem tarefas esta semana.
        </p>
      )}
    </div>
  );
}

// ── Week heat strip ───────────────────────────────────────────────────────────

function WeekHeat({ tasks, selectedDay, onSelect }: {
  tasks: WeeklyTask[]; selectedDay: number; onSelect: (d: number) => void;
}) {
  const DAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const days = DAY_LABELS.map((d, i) => {
    const dt = tasks.filter((t) => t.day_of_week === i);
    return { d, count: dt.length, done: dt.filter((t) => t.status === "concluida").length, today: i === todayDow };
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, padding: "0 10px" }}>
      {days.map((day, i) => {
        const sel = i === selectedDay;
        return (
          <button key={i} type="button" onClick={() => onSelect(i)} style={{
            background: sel ? "oklch(.5 .12 160 / .12)" : "transparent",
            border: sel ? "1.5px solid oklch(.5 .12 160 / .5)" : "1.5px solid transparent",
            borderRadius: 12, padding: "8px 2px 6px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            fontFamily: "inherit",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
              color: day.today ? "oklch(.35 .14 160)" : sel ? "oklch(.4 .12 160)" : "oklch(.55 .03 160)",
            }}>{day.d}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
              {Array.from({ length: Math.max(day.count, 1) }).slice(0, 5).map((_, j) => (
                <span key={j} style={{
                  width: 5, height: 5, borderRadius: 9999,
                  background: j < day.done ? "oklch(.5 .12 160)" :
                    day.count > 0 ? "oklch(.5 .12 160 / .25)" : "oklch(.5 .12 160 / .08)",
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              color: day.count === 0 ? "oklch(.55 .03 160)" : "oklch(.25 .02 160)",
            }}>{day.done}/{day.count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const [goals, setGoals]     = useState<GoalFull[]>([]);
  const [plan, setPlan]       = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks]     = useState<WeeklyTask[]>([]);

  const [showFocus, setShowFocus]     = useState(false);
  const [showReview, setShowReview]   = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskDay, setAddTaskDay]   = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });

  const todayDow = () => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; };
  const openAdd = (day?: number) => { setAddTaskDay(day ?? todayDow()); setShowAddTask(true); };

  const load = useCallback(async () => {
    const [goalsRes, planRes] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/weekly-plans").then((r) => r.json()),
    ]);
    if (Array.isArray(goalsRes)) setGoals(goalsRes.filter((g: GoalFull) => g.status === "ativa"));
    if (planRes && typeof planRes === "object") {
      setPlan(planRes as PlanData);
      setTasks((planRes as PlanData).current?.weekly_tasks ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleTask = async (taskId: string, current: string) => {
    const next = current === "concluida" ? "pendente" : "concluida";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: next as WeeklyTask["status"] } : t));
    await fetch(`/api/weekly-plans/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/weekly-plans/tasks/${taskId}`, { method: "DELETE" });
  };

  const currentPlan   = plan?.current ?? null;
  const review        = currentPlan?.weekly_reviews?.[0] ?? null;
  const focuses       = [currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3].filter(Boolean) as string[];
  const focusGoalIds  = (currentPlan?.weekly_focus_goals ?? []).map((f) => f.goal_id);
  const focusGoals    = focusGoalIds.slice(0, 3).map((id) => goals.find((g) => g.id === id));
  const doneTasks     = tasks.filter((t) => t.status === "concluida").length;
  const totalTasks    = tasks.length;

  const taskCountsByArea = ALL_AREAS.reduce<Record<string, number>>((acc, a) => {
    acc[a] = tasks.filter((t) => t.area === a).length;
    return acc;
  }, {});

  const selectedDayTasks = tasks
    .filter((t) => t.day_of_week === selectedDay)
    .sort((a, b) => {
      if (a.scheduled_time && b.scheduled_time) return a.scheduled_time.localeCompare(b.scheduled_time);
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      return a.position - b.position;
    });
  const doneSelectedDay = selectedDayTasks.filter((t) => t.status === "concluida").length;
  const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid oklch(.5 .12 160)", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: `
        radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .35) 0%, transparent 50%),
        linear-gradient(180deg, oklch(.97 .005 160) 0%, oklch(.94 .02 160) 100%)
      `,
      paddingBottom: 110,
    }}>

      {/* ═ GREETING ═ */}
      <div style={{ padding: "22px 20px 4px" }}>
        <p style={{ margin: 0, fontSize: 12, color: "oklch(.55 .03 160)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600 }}>
          Planejamento · Semana {getISOWeek()}
        </p>
        <h1 style={{ margin: "4px 0 4px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05, color: "oklch(.2 .02 160)" }}>
          Suas Pedras
        </h1>
        <p style={{ margin: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 11, color: "oklch(.55 .03 160)" }}>
          {weekRange()} · {doneTasks} de {totalTasks} ✓
        </p>
      </div>

      <div style={{ padding: "18px 14px 0" }}>

        {/* ═ PEDRAS ═ */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 6px" }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(.45 .12 220)" }}>
              Pedras da semana
            </p>
            <button type="button" onClick={() => setShowFocus(true)} style={{
              background: "transparent", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
              fontSize: 11, fontWeight: 600, color: "oklch(.45 .12 220)",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <Pencil size={11} />
              {focuses.length > 0 ? "Editar" : "Definir"}
            </button>
          </div>
          {focuses.length > 0 ? (
            <>
              {focuses[0] && (
                <Pedra rank="I" size="lg" text={focuses[0]}
                  linkedGoal={focusGoals[0] ? `${AREA_CONFIG[focusGoals[0].area]?.emoji ?? ""} ${focusGoals[0].title}` : undefined} />
              )}
              {focuses[1] && (
                <Pedra rank="II" size="md" text={focuses[1]}
                  linkedGoal={focusGoals[1] ? `${AREA_CONFIG[focusGoals[1].area]?.emoji ?? ""} ${focusGoals[1].title}` : undefined} />
              )}
              {focuses[2] && (
                <Pedra rank="III" size="sm" text={focuses[2]}
                  linkedGoal={focusGoals[2] ? `${AREA_CONFIG[focusGoals[2].area]?.emoji ?? ""} ${focusGoals[2].title}` : undefined} />
              )}
            </>
          ) : (
            <button type="button" onClick={() => setShowFocus(true)} style={{
              width: "100%", padding: 16, borderRadius: 16,
              border: "1.5px dashed oklch(.5 .12 220 / .35)",
              background: "oklch(.96 .04 220 / .5)", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, color: "oklch(.45 .12 220)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Plus size={16} /> Definir pedras da semana
            </button>
          )}
        </div>

        {/* ═ RADAR ═ */}
        {tasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <AreasRadar counts={taskCountsByArea} />
          </div>
        )}

        {/* ═ AGENDA ═ */}
        <div style={{
          borderRadius: 22, padding: "16px 4px 12px",
          background: "#fff", border: "1px solid oklch(.5 .12 160 / .12)",
          boxShadow: "0 1px 2px oklch(.25 .02 160 / .04)",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 14px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(.4 .12 160)" }}>
            Sua semana
          </p>
          <WeekHeat tasks={tasks} selectedDay={selectedDay} onSelect={setSelectedDay} />
          <div style={{ padding: "14px 14px 0", borderTop: "1px solid oklch(.5 .12 160 / .08)", marginTop: 12 }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "oklch(.25 .02 160)", letterSpacing: "-0.005em" }}>
              {DAY_NAMES[selectedDay]}{" "}·{" "}
              <span style={{ color: "oklch(.55 .03 160)", fontWeight: 500 }}>
                {selectedDayTasks.length} {selectedDayTasks.length === 1 ? "item" : "itens"} · {doneSelectedDay} {doneSelectedDay === 1 ? "feito" : "feitos"}
              </span>
            </p>
            {selectedDayTasks.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {selectedDayTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() => toggleTask(t.id, t.status)}
                    onDelete={() => deleteTask(t.id)}
                  />
                ))}
              </div>
            )}
            {selectedDayTasks.length === 0 && (
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "oklch(.6 .03 160)", fontStyle: "italic" }}>
                Nenhuma tarefa para este dia.
              </p>
            )}
            <button type="button" onClick={() => openAdd(selectedDay)} style={{
              marginTop: 10, width: "100%", padding: "10px 14px", borderRadius: 12,
              background: "oklch(.95 .04 160)", border: "1.5px dashed oklch(.5 .12 160 / .35)",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              color: "oklch(.4 .12 160)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Plus size={13} /> Adicionar item
            </button>
          </div>
        </div>

        {/* ═ REVISÃO ═ */}
        {!review ? (
          <div style={{
            borderRadius: 18, padding: "16px 18px", marginBottom: 20,
            background: `
              radial-gradient(circle at 100% 0, oklch(.92 .1 60 / .35), transparent 55%),
              linear-gradient(180deg, oklch(.98 .02 70) 0%, oklch(.96 .04 60) 100%)
            `,
            border: "1px solid oklch(.78 .1 60 / .35)",
            display: "flex", gap: 14, alignItems: "center",
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 9999, flexShrink: 0,
              background: "linear-gradient(135deg, oklch(.85 .15 60), oklch(.7 .18 50))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px -4px oklch(.6 .18 50 / .4)",
            }}>
              <Star size={22} color="#fff" fill="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(.45 .14 50)" }}>
                Revisão da semana
              </p>
              <p style={{ margin: "3px 0 8px", fontSize: 13, color: "oklch(.3 .04 160)", lineHeight: 1.35 }}>
                No domingo à noite, feche a semana com 4 perguntas. Leva 3 min.
              </p>
              <button type="button" onClick={() => setShowReview(true)} style={{
                padding: "7px 14px", borderRadius: 10, border: 0, cursor: "pointer",
                background: "oklch(.7 .18 50)", fontFamily: "inherit",
                fontSize: 12, fontWeight: 700, color: "#fff",
              }}>
                Fazer revisão
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 18,
            boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px",
            marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(.45 .14 50)" }}>
                Revisão da semana ✓
              </p>
              <div style={{ display: "flex", gap: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ fontSize: 13, color: i < review.week_score ? "oklch(.6 .18 60)" : "oklch(.5 .12 160 / .2)" }}>★</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(.96 .04 160)" }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "oklch(.45 .1 160)", textTransform: "uppercase" }}>Maior vitória</p>
                <p style={{ margin: 0, fontSize: 13, color: "oklch(.3 .06 160)" }}>{review.biggest_win}</p>
              </div>
              {review.main_learning && (
                <div style={{ padding: "10px 12px", borderRadius: 12, background: "oklch(.96 .04 220)" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "oklch(.45 .1 220)", textTransform: "uppercase" }}>Aprendizado</p>
                  <p style={{ margin: 0, fontSize: 13, color: "oklch(.3 .06 220)" }}>{review.main_learning}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═ MAYA PILL ═ */}
        <div style={{ padding: "0 10px", marginBottom: 24 }}>
          <button type="button" onClick={() => router.push("/insights?context=plan")} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "oklch(1 0 0 / .6)", backdropFilter: "blur(8px)",
            border: "1px solid oklch(.5 .12 160 / .2)", borderRadius: 9999,
            padding: "8px 14px 8px 8px", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12.5, fontWeight: 500, color: "oklch(.2 .02 160)",
            letterSpacing: "-0.005em",
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 9999, flexShrink: 0,
              background: "linear-gradient(135deg, oklch(.55 .15 160), oklch(.45 .12 180))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={12} color="#fff" />
            </span>
            Maya pode ajudar a equilibrar a roda
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "oklch(.55 .03 160)", marginLeft: -2 }}>
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ═ HISTÓRICO ═ */}
        {(plan?.history ?? []).length > 0 && (
          <div style={{ padding: "0 10px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(.55 .03 160)" }}>
              Semanas anteriores
            </p>
            {(plan?.history ?? []).map((h, i) => {
              const d = new Date(h.week_start + "T12:00:00");
              const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
              const mon = new Date(d);
              mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
              const sun = new Date(mon);
              sun.setDate(mon.getDate() + 6);
              const label = `${mon.getDate()} ${MONTHS[mon.getMonth()]}–${sun.getDate()} ${MONTHS[sun.getMonth()]}`;
              const rev = (h as { weekly_reviews?: WeeklyReview[] }).weekly_reviews?.[0];
              return (
                <div key={h.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 0",
                  borderTop: i === 0 ? "none" : "1px solid oklch(.5 .12 160 / .1)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "oklch(.55 .03 160)" }}>
                      {label}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "oklch(.25 .02 160)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.main_focus || "Sem foco registrado"}
                    </p>
                  </div>
                  {rev && (
                    <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <span key={j} style={{ fontSize: 11, color: j < rev.week_score ? "oklch(.6 .18 60)" : "oklch(.5 .12 160 / .2)" }}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button type="button" onClick={() => openAdd()} style={{
        position: "fixed", bottom: 88, right: 20, zIndex: 40,
        width: 52, height: 52, borderRadius: "50%", border: 0, cursor: "pointer",
        background: "oklch(.5 .12 160)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px oklch(.5 .12 160 / .4)",
      }}>
        <Plus size={22} color="#fff" />
      </button>

      {showFocus && (
        <FocusModal
          goals={goals}
          initial={{
            f1: currentPlan?.main_focus ?? "",
            f2: currentPlan?.main_focus_2 ?? "",
            f3: currentPlan?.main_focus_3 ?? "",
            focusGoalIds: (currentPlan?.weekly_focus_goals ?? []).map((f) => f.goal_id),
          }}
          onClose={() => setShowFocus(false)}
          onSaved={load}
          lang={lang}
        />
      )}

      {showAddTask && (
        <AddTaskSheet
          goals={goals}
          initialDay={addTaskDay}
          onClose={() => setShowAddTask(false)}
          onSaved={(task) => setTasks((prev) => [...prev, task])}
          lang={lang}
        />
      )}

      {showReview && <ReviewModal onClose={() => setShowReview(false)} onSaved={load} lang={lang} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
