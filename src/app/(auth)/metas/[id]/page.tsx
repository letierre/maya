"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Check, Shield, Trophy, AlertOctagon, Sparkles,
  Target, Compass, Share2, CheckCircle2, Circle, Trash2, Pencil, Archive
} from "lucide-react";
import type { Goal, GoalStage, GoalAction } from "@/types";

// ── Area config ───────────────────────────────────────────────────────────────

const AREA_CONFIG: Record<string, { label: string; emoji: string; hue: number }> = {
  saude:           { label: "Saúde",           emoji: "💚", hue: 160 },
  carreira:        { label: "Carreira",        emoji: "💼", hue: 220 },
  financas:        { label: "Finanças",        emoji: "💰", hue: 85  },
  relacionamentos: { label: "Relacionamentos", emoji: "❤️", hue: 15  },
  desenvolvimento: { label: "Desenvolvimento", emoji: "🧠", hue: 270 },
  familia:         { label: "Família",         emoji: "🏡", hue: 40  },
  lazer:           { label: "Lazer",           emoji: "🌊", hue: 185 },
  espiritualidade: { label: "Espiritualidade", emoji: "✨", hue: 300 },
};

function hueOf(area: string) { return AREA_CONFIG[area]?.hue ?? 160; }
function ac(area: string, l = .5, c = .12) { return `oklch(${l} ${c} ${hueOf(area)})`; }
function al(area: string) { return `oklch(.95 .05 ${hueOf(area)})`; }

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };

function goalProgress(goal: GoalFull) {
  const s = goal.goal_stages ?? [];
  if (!s.length) return 0;
  return Math.round((s.filter((x) => x.status === "concluida").length / s.length) * 100);
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.5}s`,
    color: ["oklch(.6 .2 160)", "oklch(.6 .2 85)", "oklch(.6 .2 220)", "oklch(.6 .2 40)"][i % 4],
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", top: -10, left: p.left,
          width: 8, height: 8, borderRadius: "50%", background: p.color,
          animation: `confettiFall 1.5s ${p.delay} ease-in forwards`,
        }} />
      ))}
      <style>{`@keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(105vh) rotate(720deg);opacity:0} }`}</style>
    </div>
  );
}

// ── CommitChip ────────────────────────────────────────────────────────────────

function CommitChip({ type, label, sub, onClick }: {
  type: "guardian" | "reward" | "punishment";
  label: string; sub: string;
  onClick?: () => void;
}) {
  const COLORS = {
    guardian:   { bg: "oklch(.93 .05 160)", fg: "oklch(.35 .12 160)", icon: "🛡️" },
    reward:     { bg: "oklch(.94 .08 85)",  fg: "oklch(.42 .14 85)",  icon: "🏆" },
    punishment: { bg: "oklch(.94 .06 15)",  fg: "oklch(.42 .14 15)",  icon: "⚠️" },
  }[type];
  return (
    <div
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 12px 7px 10px", borderRadius: 12,
        background: COLORS.bg,
        border: `1px solid ${COLORS.fg}33`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ fontSize: 13 }}>{COLORS.icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: COLORS.fg, opacity: .7 }}>
          {sub}
        </p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: COLORS.fg }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Stage row (vertical roadmap) ──────────────────────────────────────────────

function StageRow({
  stage, area, index, isLast,
  onToggleStage, onToggleAction, onAddAction, onDeleteAction,
}: {
  stage: GoalStage & { goal_actions: GoalAction[] };
  area: string; index: number; isLast: boolean;
  onToggleStage: () => void;
  onToggleAction: (actionId: string) => void;
  onAddAction: (title: string, ifThen?: string) => void;
  onDeleteAction: (actionId: string) => void;
}) {
  const hue = hueOf(area);
  const isDone = stage.status === "concluida";
  const isCurrent = !isDone && index === 0;
  const [adding, setAdding] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [showIfThen, setShowIfThen] = useState(false);
  const [ifThenCond, setIfThenCond] = useState("");
  const [ifThenAct, setIfThenAct]   = useState("");

  const actions = stage.goal_actions ?? [];
  const doneCount = actions.filter((a) => a.status === "concluida").length;

  const handleAddAction = () => {
    if (!newAction.trim()) return;
    const ifThen = ifThenCond.trim() && ifThenAct.trim()
      ? `${ifThenCond.trim()}, então ${ifThenAct.trim()}`
      : undefined;
    onAddAction(newAction.trim(), ifThen);
    setNewAction(""); setIfThenCond(""); setIfThenAct(""); setAdding(false); setShowIfThen(false);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 12, position: "relative", minHeight: 50 }}>
      {/* Connector */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        {!isLast && (
          <span style={{
            position: "absolute", top: 30, bottom: -16, left: "50%", width: 2,
            transform: "translateX(-50%)",
            background: isDone ? `oklch(.5 .14 ${hue})` : `oklch(.5 .12 ${hue} / .2)`,
          }} />
        )}
        <button
          type="button"
          onClick={onToggleStage}
          style={{
            width: 30, height: 30, borderRadius: 9999, flex: "none", zIndex: 1, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono, ui-monospace)",
            background: isDone ? `oklch(.5 .14 ${hue})` : isCurrent ? "#fff" : `oklch(.5 .12 ${hue} / .1)`,
            border: isCurrent ? `2.5px solid oklch(.5 .14 ${hue})` : "none",
            color: isDone ? "#fff" : isCurrent ? `oklch(.4 .14 ${hue})` : `oklch(.5 .1 ${hue} / .6)`,
            boxShadow: isCurrent ? `0 0 0 5px oklch(.5 .14 ${hue} / .15)` : "none",
          }}
        >
          {isDone ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10"/>
            </svg>
          ) : index + 1}
        </button>
      </div>

      {/* Content */}
      <div style={{ paddingBottom: isLast ? 0 : 22, minWidth: 0 }}>
        <p style={{
          margin: "4px 0 0", fontSize: isCurrent ? 15 : 13.5,
          fontWeight: isCurrent ? 700 : 500, letterSpacing: "-0.005em",
          color: isDone ? "oklch(.65 .03 160)" : isCurrent ? `oklch(.2 .04 ${hue})` : "oklch(.35 .02 160)",
          textDecoration: isDone ? "line-through" : "none", lineHeight: 1.3,
        }}>
          {stage.title}
        </p>

        {isDone && actions.length > 0 && (
          <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "oklch(.6 .03 160)" }}>
            {doneCount}/{actions.length} ações ✓
          </p>
        )}

        {/* Current stage actions panel */}
        {isCurrent && (
          <div style={{
            marginTop: 12, padding: 14, borderRadius: 14,
            background: "#fff", border: `1px solid oklch(.5 .12 ${hue} / .15)`,
            boxShadow: `0 4px 14px -6px oklch(.5 .12 ${hue} / .2)`,
          }}>
            {actions.map((a, i) => {
              const done = a.status === "concluida";
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "6px 0",
                  borderTop: i > 0 ? "1px solid oklch(.5 .12 160 / .08)" : "none",
                }}>
                  <button type="button" onClick={() => onToggleAction(a.id)} style={{
                    width: 18, height: 18, borderRadius: 6, flex: "none", marginTop: 1,
                    background: done ? `oklch(.5 .14 ${hue})` : "transparent",
                    border: done ? "none" : `1.5px solid oklch(.5 .14 ${hue} / .4)`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-10"/>
                      </svg>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, lineHeight: 1.3,
                      color: done ? "oklch(.6 .03 160)" : "oklch(.2 .02 160)",
                      textDecoration: done ? "line-through" : "none", fontWeight: 500,
                    }}>{a.title}</p>
                    {a.if_then && !done && (
                      <div style={{
                        marginTop: 5, padding: "4px 8px", borderRadius: 6,
                        background: "oklch(.95 .04 270)", border: "1px solid oklch(.6 .12 270 / .2)",
                        display: "inline-flex", flexWrap: "wrap", gap: 4, alignItems: "center",
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".08em", color: "oklch(.4 .14 270)" }}>SE</span>
                        <span style={{ fontSize: 11, color: "oklch(.3 .08 270)", lineHeight: 1.3 }}>{a.if_then}</span>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => onDeleteAction(a.id)} style={{
                    border: 0, background: "none", padding: 4, cursor: "pointer",
                    color: "oklch(.75 .03 160)", flexShrink: 0,
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {!adding ? (
              <button type="button" onClick={() => setAdding(true)} style={{
                marginTop: 10, padding: "7px 10px", borderRadius: 8,
                background: "transparent", border: `1.5px dashed oklch(.5 .14 ${hue} / .35)`,
                cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
                color: `oklch(.4 .14 ${hue})`,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                <Plus size={11} /> Adicionar ação
              </button>
            ) : (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  autoFocus
                  type="text"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddAction(); if (e.key === "Escape") setAdding(false); }}
                  placeholder="Descreva a ação..."
                  style={{
                    padding: "9px 12px", borderRadius: 10, border: `1.5px solid oklch(.7 .06 ${hue})`,
                    background: "oklch(.98 .005 160)", fontFamily: "inherit", fontSize: 13,
                    color: "oklch(.2 .02 160)", outline: "none",
                  }}
                />
                {!showIfThen ? (
                  <button type="button" onClick={() => setShowIfThen(true)} style={{
                    textAlign: "left", padding: 0, border: 0, background: "none",
                    fontSize: 11, color: "oklch(.55 .06 220)", cursor: "pointer", fontFamily: "inherit",
                    textDecoration: "underline",
                  }}>
                    + Plano SE-ENTÃO (aumenta 2-3× as chances)
                  </button>
                ) : (
                  <div style={{
                    borderRadius: 10, border: "1.5px solid oklch(.75 .06 220)",
                    background: "oklch(.97 .02 220)", padding: "10px 12px",
                    display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "oklch(.45 .1 220)", flexShrink: 0 }}>SE</span>
                      <input autoFocus type="text" value={ifThenCond} onChange={(e) => setIfThenCond(e.target.value)}
                        placeholder="[situação ou gatilho]"
                        style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 12, color: "oklch(.3 .06 220)", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "oklch(.45 .1 220)", flexShrink: 0 }}>ENTÃO</span>
                      <input type="text" value={ifThenAct} onChange={(e) => setIfThenAct(e.target.value)}
                        placeholder="[farei isso]"
                        style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 12, color: "oklch(.3 .06 220)", outline: "none" }} />
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => { setAdding(false); setNewAction(""); setIfThenCond(""); setIfThenAct(""); setShowIfThen(false); }} style={{
                    flex: 1, padding: "8px 12px", borderRadius: 10, border: "1.5px solid oklch(.85 .02 160)",
                    background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer", color: "oklch(.5 .04 160)",
                  }}>Cancelar</button>
                  <button type="button" onClick={handleAddAction} disabled={!newAction.trim()} style={{
                    flex: 1, padding: "8px 12px", borderRadius: 10, border: 0,
                    background: newAction.trim() ? ac(area) : "oklch(.88 .02 160)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    color: newAction.trim() ? "#fff" : "oklch(.6 .02 160)", cursor: "pointer",
                  }}>Salvar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [goal, setGoal] = useState<GoalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [newStage, setNewStage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals/${id}`);
    if (res.ok) setGoal(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const celebrate = () => {
    setConfetti(true);
    setTimeout(() => setConfetti(false), 2000);
  };

  const toggleStage = async (stageId: string, currentStatus: string) => {
    const next = currentStatus === "concluida" ? "pendente" : "concluida";
    const res = await fetch(`/api/goals/${id}/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const { all_stages_done } = await res.json();
      if (all_stages_done) celebrate();
      load();
    }
  };

  const toggleAction = async (stageId: string, actionId: string, currentStatus: string) => {
    const next = currentStatus === "concluida" ? "pendente" : "concluida";
    await fetch(`/api/goals/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  const addAction = async (stageId: string, title: string, ifThen?: string) => {
    await fetch(`/api/goals/${id}/stages/${stageId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, if_then: ifThen }),
    });
    load();
  };

  const deleteAction = async (actionId: string) => {
    await fetch(`/api/goals/actions/${actionId}`, { method: "DELETE" });
    load();
  };

  const addStage = async () => {
    if (!newStage.trim()) return;
    await fetch(`/api/goals/${id}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newStage.trim() }),
    });
    setNewStage(""); setAddingStage(false);
    load();
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (status === "concluida") celebrate();
    setShowMenu(false);
    load();
  };

  const shareGuardian = () => {
    if (!goal) return;
    const text = `Oi ${goal.guardian_name}! Você foi escolhido como guardião da minha meta: "${goal.title}".${goal.reward ? ` Recompensa se eu cumprir: ${goal.reward}.` : ""}${goal.punishment ? ` Punição se eu abandonar: ${goal.punishment}.` : ""} Conto com você! 💪`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Mensagem copiada!");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.97 .005 160)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid oklch(.5 .12 160)", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!goal) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "oklch(.97 .005 160)" }}>
        <p style={{ fontSize: 16, color: "oklch(.5 .04 160)" }}>Meta não encontrada</p>
        <button type="button" onClick={() => router.push("/metas")} style={{
          padding: "12px 24px", borderRadius: 12, border: 0, cursor: "pointer",
          background: "oklch(.5 .12 160)", color: "#fff", fontFamily: "inherit", fontSize: 14,
        }}>Voltar</button>
      </div>
    );
  }

  const area = goal.area;
  const areaConf = AREA_CONFIG[area] ?? AREA_CONFIG.saude;
  const hue = hueOf(area);
  const pct = goalProgress(goal);
  const stages = goal.goal_stages ?? [];
  const daysLeft = goal.target_date ? daysUntil(goal.target_date) : null;
  const hasCommit = goal.guardian_name || goal.reward || goal.punishment;

  return (
    <div style={{
      minHeight: "100dvh", paddingBottom: 110,
      background: `
        radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .35) 0%, transparent 50%),
        linear-gradient(180deg, oklch(.97 .005 160) 0%, oklch(.94 .02 160) 100%)
      `,
    }}>
      <Confetti active={confetti} />

      {/* Floating nav buttons */}
      <button type="button" onClick={() => router.push("/metas")} style={{
        position: "fixed", top: 14, left: 16, zIndex: 50,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
        background: "oklch(1 0 0 / .65)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 3px oklch(.25 .02 160 / .08)",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <button type="button" onClick={() => setShowMenu((v) => !v)} style={{
        position: "fixed", top: 14, right: 16, zIndex: 50,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
        background: "oklch(1 0 0 / .65)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {/* Context menu */}
      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 48 }} />
          <div style={{
            position: "fixed", top: 56, right: 16, zIndex: 49,
            background: "#fff", borderRadius: 16, padding: "8px 0",
            boxShadow: "0 8px 32px oklch(.2 .04 160 / .2)", minWidth: 200,
          }}>
            {[
              { icon: Pencil, label: "Editar meta", action: () => setShowMenu(false) },
              goal.status === "ativa"
                ? { icon: Archive, label: "Pausar meta", action: () => updateStatus("pausada") }
                : { icon: Target, label: "Reativar meta", action: () => updateStatus("ativa") },
              { icon: CheckCircle2, label: "Marcar como concluída", action: () => updateStatus("concluida") },
              { icon: Trash2, label: "Arquivar", action: () => updateStatus("arquivada") },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} type="button" onClick={action} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "12px 16px", border: 0, background: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "oklch(.25 .04 160)", textAlign: "left",
              }}>
                <Icon size={16} style={{ color: "oklch(.55 .08 160)", flexShrink: 0 }} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* HERO card */}
      <div style={{ padding: "64px 14px 0" }}>
        <div style={{
          borderRadius: 22, padding: "20px 22px",
          background: `linear-gradient(135deg, oklch(.95 .04 ${hue}) 0%, oklch(.88 .08 ${hue}) 100%)`,
          border: `1px solid oklch(.5 .12 ${hue} / .2)`,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: 9999,
            background: `radial-gradient(circle, oklch(.5 .12 ${hue} / .15), transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative" }}>
            {/* Tags */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{
                padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                letterSpacing: ".08em", textTransform: "uppercase",
                background: `oklch(.5 .12 ${hue} / .15)`, color: `oklch(.32 .12 ${hue})`,
              }}>
                {areaConf.emoji} {areaConf.label}
              </span>
              <span style={{
                padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                letterSpacing: ".08em", textTransform: "uppercase",
                background: `oklch(.5 .12 ${hue} / .1)`, color: `oklch(.32 .1 ${hue})`,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {goal.type === "destino" ? <Target size={10} /> : <Compass size={10} />}
                {goal.type === "destino" ? "Destino" : "Direção"}
              </span>
              {goal.status === "pausada" && (
                <span style={{
                  padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                  background: "oklch(.97 .04 50)", color: "oklch(.45 .14 50)",
                }}>Pausada</span>
              )}
            </div>

            <h1 style={{
              margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em",
              lineHeight: 1.2, color: `oklch(.18 .04 ${hue})`,
            }}>
              {goal.title}
            </h1>

            {goal.why_it_matters && (
              <p style={{
                margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.45,
                color: `oklch(.35 .06 ${hue})`, fontStyle: "italic",
              }}>
                "{goal.why_it_matters}"
              </p>
            )}

            {/* Progress */}
            {stages.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em",
                    color: `oklch(.32 .14 ${hue})`, lineHeight: 1,
                  }}>
                    {pct}
                  </span>
                  <span style={{ fontSize: 18, color: `oklch(.45 .1 ${hue})`, fontWeight: 500 }}>%</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: `oklch(.4 .08 ${hue})` }}>
                    {stages.filter((s) => s.status === "concluida").length}/{stages.length} etapas
                    {daysLeft !== null && ` · ${daysLeft}d`}
                  </span>
                </div>
                <div style={{
                  marginTop: 6, height: 6, borderRadius: 9999,
                  background: `oklch(.5 .12 ${hue} / .2)`, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${pct}%`, borderRadius: 9999,
                    background: `linear-gradient(90deg, oklch(.4 .14 ${hue}), oklch(.5 .16 ${hue}))`,
                    transition: "width .6s ease",
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CommitChips row */}
      {hasCommit && (
        <div style={{ padding: "14px 20px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {goal.guardian_name && (
            <CommitChip type="guardian" label={goal.guardian_name} sub="Guardião" onClick={shareGuardian} />
          )}
          {goal.reward && (
            <CommitChip type="reward" label={goal.reward} sub="Recompensa" />
          )}
          {goal.punishment && (
            <CommitChip type="punishment" label={goal.punishment} sub="Punição" />
          )}
        </div>
      )}

      {/* Dashed CTA if no commit */}
      {!hasCommit && (
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{
            padding: "12px 16px", borderRadius: 14,
            border: "1.5px dashed oklch(.8 .04 160)",
            background: "transparent",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Shield size={16} style={{ color: "oklch(.65 .06 160)", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: "oklch(.55 .04 160)" }}>
              Sem guardião ou apostas ainda — edite a meta para adicionar.
            </p>
          </div>
        </div>
      )}

      {/* ROADMAP */}
      <div style={{ padding: "28px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: `oklch(.45 .12 ${hue})` }}>
            Mapa da meta
          </p>
          <button type="button" onClick={() => setAddingStage(true)} style={{
            background: "transparent", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 11, fontWeight: 600, color: `oklch(.45 .12 ${hue})`,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Plus size={12} /> Adicionar etapa
          </button>
        </div>

        {stages.length === 0 && !addingStage && (
          <div style={{
            textAlign: "center", padding: "28px 20px", borderRadius: 16,
            border: "2px dashed oklch(.85 .03 160)", background: "oklch(1 0 0 / .4)",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "oklch(.5 .04 160)" }}>
              Adicione etapas para quebrar sua meta em marcos concretos
            </p>
            <button type="button" onClick={() => setAddingStage(true)} style={{
              padding: "10px 20px", borderRadius: 12, border: 0, cursor: "pointer",
              background: al(area), color: ac(area), fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            }}>
              <Plus size={14} style={{ display: "inline", marginRight: 4 }} /> Primeira etapa
            </button>
          </div>
        )}

        {/* Stage list — current (first non-done) gets full panel; rest get compact rows */}
        {(() => {
          const firstNonDone = stages.findIndex((s) => s.status !== "concluida");
          return stages.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              area={area}
              index={i === firstNonDone ? 0 : stage.status === "concluida" ? -1 : 1}
              isLast={i === stages.length - 1 && !addingStage}
              onToggleStage={() => toggleStage(stage.id, stage.status)}
              onToggleAction={(actionId) => {
                const act = (stage.goal_actions ?? []).find((a) => a.id === actionId);
                toggleAction(stage.id, actionId, act?.status ?? "pendente");
              }}
              onAddAction={(title, ifThen) => addAction(stage.id, title, ifThen)}
              onDeleteAction={deleteAction}
            />
          ));
        })()}

        {/* Add stage inline */}
        {addingStage && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <input
              autoFocus
              type="text"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addStage(); if (e.key === "Escape") setAddingStage(false); }}
              placeholder="Nome da nova etapa..."
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid oklch(.7 .06 ${hue})`, background: "#fff",
                fontFamily: "inherit", fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
              }}
            />
            <button type="button" onClick={addStage} style={{
              padding: "12px 16px", borderRadius: 12, border: 0, cursor: "pointer",
              background: ac(area), color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            }}>Salvar</button>
          </div>
        )}
      </div>

      {/* Maya pill */}
      <div style={{ padding: "24px 24px 0" }}>
        <button type="button" onClick={() => router.push(`/metas/coach`)} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "oklch(1 0 0 / .6)", backdropFilter: "blur(8px)",
          border: `1px solid oklch(.5 .12 ${hue} / .2)`, borderRadius: 9999,
          padding: "8px 14px 8px 8px", cursor: "pointer", fontFamily: "inherit",
          fontSize: 12.5, fontWeight: 500, color: "oklch(.2 .02 160)",
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 9999, overflow: "hidden", flex: "none",
            border: "1px solid #fff", display: "block",
          }}>
            <img src="/maya.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </span>
          Conversar sobre essa meta com Maya
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "oklch(.6 .03 160)" }}>
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
