"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Target, Compass, Check, ChevronRight, Star, Sparkles, Plus, Calendar } from "lucide-react";
import type { Goal, GoalStage, GoalAction, WeeklyPlan, WeeklyReview } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AREA_CONFIG: Record<string, { emoji: string; hue: number }> = {
  saude: { emoji: "💚", hue: 160 }, carreira: { emoji: "💼", hue: 220 },
  financas: { emoji: "💰", hue: 85 }, relacionamentos: { emoji: "❤️", hue: 15 },
  desenvolvimento: { emoji: "🧠", hue: 270 }, familia: { emoji: "🏡", hue: 40 },
  lazer: { emoji: "🌊", hue: 185 }, espiritualidade: { emoji: "✨", hue: 300 },
};

function ac(hue: number) { return `oklch(.5 .12 ${hue})`; }
function al(hue: number) { return `oklch(.95 .05 ${hue})`; }

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };
type PlanData = { current: (WeeklyPlan & { weekly_reviews: WeeklyReview[]; weekly_focus_goals: { goal_id: string }[] }) | null; history: WeeklyPlan[] };

function weekLabel() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
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

// ── Create plan modal ─────────────────────────────────────────────────────────

function CreatePlanModal({
  goals, onClose, onCreated,
}: { goals: GoalFull[]; onClose: () => void; onCreated: () => void }) {
  const [mainFocus, setMainFocus] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const save = async () => {
    if (!mainFocus.trim()) return;
    setSaving(true);
    await fetch("/api/weekly-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ main_focus: mainFocus, linked_goal_id: linkedGoalId, focus_goal_ids: selectedGoals }),
    });
    setSaving(false);
    onCreated();
    onClose();
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
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>
          Planejar semana
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "oklch(.55 .04 160)" }}>{weekLabel()}</p>

        {/* Main focus */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
            🎯 Pedra principal da semana
          </p>
          <textarea
            autoFocus
            value={mainFocus}
            onChange={(e) => setMainFocus(e.target.value)}
            placeholder="O que DEVE acontecer esta semana para que ela valha a pena?"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", padding: "12px 14px",
              borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
              background: "oklch(.98 .005 160)", fontFamily: "inherit",
              fontSize: 14, color: "oklch(.2 .02 160)", outline: "none", resize: "none", lineHeight: 1.6,
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "oklch(.5 .12 160)"; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "oklch(.82 .03 160)"; }}
          />
        </div>

        {/* Goal in focus */}
        {goals.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              Metas em foco (até 3)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((g) => {
                const conf = AREA_CONFIG[g.area] ?? AREA_CONFIG.saude;
                const isSelected = selectedGoals.includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => toggle(g.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                    borderRadius: 14, border: isSelected
                      ? `2px solid ${ac(conf.hue)}`
                      : "2px solid oklch(.88 .02 160)",
                    background: isSelected ? al(conf.hue) : "#fff",
                    cursor: "pointer", textAlign: "left",
                    transition: "all .15s ease",
                  }}>
                    <span style={{ fontSize: 18 }}>{conf.emoji}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "oklch(.25 .02 160)" }}>{g.title}</span>
                    {isSelected && <Check size={16} style={{ color: ac(conf.hue), flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button type="button" onClick={save} disabled={saving || !mainFocus.trim()} style={{
          width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (saving || !mainFocus.trim()) ? "not-allowed" : "pointer",
          background: (saving || !mainFocus.trim()) ? "oklch(.88 .02 160)" : "oklch(.5 .12 160)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (saving || !mainFocus.trim()) ? "oklch(.6 .02 160)" : "#fff",
          transition: "all .15s ease",
        }}>
          {saving ? "Salvando…" : "Começar semana"}
        </button>
      </div>
    </>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [biggestWin, setBiggestWin] = useState("");
  const [blockedLesson, setBlockedLesson] = useState("");
  const [mainLearning, setMainLearning] = useState("");
  const [weekScore, setWeekScore] = useState(3);
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

  const fieldStyle = {
    width: "100%", boxSizing: "border-box" as const, padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none", resize: "none" as const, lineHeight: 1.6,
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
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>Revisão da semana</h2>
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "oklch(.55 .04 160)" }}>{weekLabel()}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              🏆 Qual foi sua maior vitória?
            </p>
            <textarea value={biggestWin} onChange={(e) => setBiggestWin(e.target.value)}
              placeholder="Celebre algo, por menor que seja..." rows={2} style={fieldStyle} />
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              🔒 O que travou e como lidar diferente?
            </p>
            <textarea value={blockedLesson} onChange={(e) => setBlockedLesson(e.target.value)}
              placeholder="Não é culpa — é aprendizado." rows={2} style={fieldStyle} />
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              💡 Principal aprendizado
            </p>
            <textarea value={mainLearning} onChange={(e) => setMainLearning(e.target.value)}
              placeholder="Uma coisa que levará para a próxima semana..." rows={2} style={fieldStyle} />
          </div>

          <div>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              Como foi a semana?
            </p>
            <StarRating value={weekScore} onChange={setWeekScore} />
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving || !biggestWin.trim()} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (saving || !biggestWin.trim()) ? "not-allowed" : "pointer",
          background: (saving || !biggestWin.trim()) ? "oklch(.88 .02 160)" : "linear-gradient(135deg, oklch(.5 .12 160), oklch(.42 .14 200))",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#fff",
        }}>
          {saving ? "Salvando…" : "Fechar semana"}
        </button>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalFull[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    const [goalsRes, planRes] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/weekly-plans").then((r) => r.json()),
    ]);
    if (Array.isArray(goalsRes)) setGoals(goalsRes.filter((g: GoalFull) => g.status === "ativa"));
    if (planRes && typeof planRes === "object") setPlan(planRes as PlanData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentPlan = plan?.current ?? null;
  const focusGoalIds = (currentPlan?.weekly_focus_goals ?? []).map((f) => f.goal_id);
  const focusGoals = goals.filter((g) => focusGoalIds.includes(g.id));
  const review = currentPlan?.weekly_reviews?.[0] ?? null;

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid oklch(.5 .12 160)", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 100 }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, oklch(.42 .14 200), oklch(.5 .12 160))",
        padding: "52px 20px 32px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "oklch(1 0 0 / .06)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "oklch(1 0 0 / .04)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: "oklch(1 0 0 / .7)", fontWeight: 500 }}>Planejamento</p>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>Semana atual</h1>
          <p style={{ margin: 0, fontSize: 13, color: "oklch(1 0 0 / .75)", fontWeight: 500 }}>
            <Calendar size={13} style={{ display: "inline", marginRight: 4 }} />
            {weekLabel()}
          </p>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* No plan yet */}
        {!currentPlan ? (
          <div style={{
            background: "#fff", borderRadius: 20,
            boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)",
            overflow: "hidden", textAlign: "center",
          }}>
            <div style={{ height: 5, background: "linear-gradient(90deg, oklch(.42 .14 200), oklch(.5 .12 160))" }} />
            <div style={{ padding: "36px 24px" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
                background: "oklch(.93 .04 160)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Target size={30} style={{ color: "oklch(.5 .12 160)" }} />
              </div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "oklch(.22 .02 160)" }}>
                Nova semana, novo foco
              </h2>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "oklch(.5 .04 160)", lineHeight: 1.6 }}>
                O que vai importar esta semana? Defina sua pedra principal e quais metas receberão sua atenção.
              </p>
              <button type="button" onClick={() => setShowCreate(true)} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px", borderRadius: 14, border: 0, cursor: "pointer",
                background: "oklch(.5 .12 160)", color: "#fff",
                fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                boxShadow: "0 4px 16px oklch(.5 .12 160 / .35)",
              }}>
                <Plus size={18} /> Planejar semana
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Main focus card */}
            <div style={{
              background: "#fff", borderRadius: 20,
              boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)",
              overflow: "hidden",
            }}>
              <div style={{ height: 4, background: "linear-gradient(90deg, oklch(.42 .14 200), oklch(.5 .12 160))" }} />
              <div style={{ padding: "16px 18px" }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                  🎯 Pedra principal
                </p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "oklch(.22 .02 160)", lineHeight: 1.4 }}>
                  {currentPlan.main_focus}
                </p>
              </div>
            </div>

            {/* Goals in focus */}
            {focusGoals.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                  Metas em foco esta semana
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {focusGoals.map((g) => {
                    const conf = AREA_CONFIG[g.area] ?? AREA_CONFIG.saude;
                    const stages = g.goal_stages ?? [];
                    const pct = stages.length
                      ? Math.round((stages.filter((s) => s.status === "concluida").length / stages.length) * 100)
                      : 0;
                    return (
                      <button key={g.id} type="button" onClick={() => router.push(`/metas/${g.id}`)} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                        borderRadius: 14, border: "1.5px solid oklch(.88 .02 160)",
                        background: "oklch(.98 .005 160)", cursor: "pointer", textAlign: "left",
                      }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{conf.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "oklch(.25 .02 160)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {g.title}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {g.type === "destino"
                              ? <Target size={11} style={{ color: "oklch(.6 .06 160)" }} />
                              : <Compass size={11} style={{ color: "oklch(.6 .06 220)" }} />
                            }
                            {g.type === "destino" && stages.length > 0 && (
                              <>
                                <div style={{ flex: 1, height: 4, borderRadius: 9999, background: al(conf.hue), overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, background: ac(conf.hue) }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: ac(conf.hue), flexShrink: 0 }}>{pct}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: "oklch(.7 .04 160)", flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Review */}
            {!review ? (
              <div style={{
                background: "#fff", borderRadius: 20,
                boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)",
                overflow: "hidden",
              }}>
                <div style={{ height: 4, background: "linear-gradient(90deg, oklch(.5 .14 50), oklch(.5 .12 85))" }} />
                <div style={{ padding: "16px 18px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                    Revisão semanal
                  </p>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "oklch(.5 .04 160)", lineHeight: 1.5 }}>
                    Reserve 10 minutos para fechar a semana. Celebre o que avançou, aprenda com o que travou.
                  </p>
                  <button type="button" onClick={() => setShowReview(true)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 18px", borderRadius: 12, border: 0, cursor: "pointer",
                    background: "oklch(.93 .04 160)", color: "oklch(.4 .12 160)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  }}>
                    <Star size={16} /> Fazer revisão
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                    Revisão da semana
                  </p>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ fontSize: 14, filter: i < review.week_score ? "none" : "grayscale(1) opacity(.3)" }}>⭐</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

            {/* Edit plan */}
            <button type="button" onClick={() => setShowCreate(true)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              borderRadius: 14, border: "1.5px dashed oklch(.8 .04 160)", background: "transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              color: "oklch(.5 .08 160)",
            }}>
              <Plus size={16} /> Atualizar plano da semana
            </button>
          </>
        )}

        {/* History */}
        {(plan?.history ?? []).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              Semanas anteriores
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(plan?.history ?? []).map((h) => {
                const d = new Date(h.week_start + "T12:00:00");
                const label = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
                const rev = (h as unknown as { weekly_reviews?: WeeklyReview[] }).weekly_reviews?.[0];
                return (
                  <div key={h.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    borderRadius: 12, background: "oklch(.97 .005 160)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "oklch(.4 .06 160)" }}>Semana de {label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "oklch(.55 .04 160)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.main_focus || "Sem foco registrado"}
                      </p>
                    </div>
                    {rev && (
                      <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{ fontSize: 12, filter: i < rev.week_score ? "none" : "grayscale(1) opacity(.25)" }}>⭐</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Coach CTA */}
        <button type="button" onClick={() => router.push("/insights")} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
          borderRadius: 18, border: 0, cursor: "pointer", textAlign: "left",
          background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
          boxShadow: "0 4px 16px oklch(.42 .14 200 / .3)",
        }}>
          <Sparkles size={22} color="#fff" />
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#fff" }}>Maya Coach</p>
            <p style={{ margin: 0, fontSize: 12, color: "oklch(1 0 0 / .75)" }}>
              Revise suas metas e planejamento com a IA
            </p>
          </div>
        </button>
      </div>

      {showCreate && <CreatePlanModal goals={goals} onClose={() => setShowCreate(false)} onCreated={load} />}
      {showReview && <ReviewModal onClose={() => setShowReview(false)} onSaved={load} />}
    </div>
  );
}
