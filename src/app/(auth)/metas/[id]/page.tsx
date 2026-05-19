"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Check, ChevronDown, ChevronUp, Trophy, Shield,
  AlertOctagon, Sparkles, Target, Compass, Share2, MoreHorizontal,
  Pencil, Archive, CheckCircle2, Circle, Trash2
} from "lucide-react";
import type { Goal, GoalStage, GoalAction } from "@/types";

// ── Area config ───────────────────────────────────────────────────────────────

const AREA_CONFIG: Record<string, { label: string; emoji: string; hue: number }> = {
  saude:          { label: "Saúde",            emoji: "💚", hue: 160 },
  carreira:       { label: "Carreira",         emoji: "💼", hue: 220 },
  financas:       { label: "Finanças",         emoji: "💰", hue: 85  },
  relacionamentos:{ label: "Relacionamentos",  emoji: "❤️", hue: 15  },
  desenvolvimento:{ label: "Desenvolvimento",  emoji: "🧠", hue: 270 },
  familia:        { label: "Família",          emoji: "🏡", hue: 40  },
  lazer:          { label: "Lazer",            emoji: "🌊", hue: 185 },
  espiritualidade:{ label: "Espiritualidade",  emoji: "✨", hue: 300 },
};

function hue(area: string) { return AREA_CONFIG[area]?.hue ?? 160; }
function ac(area: string, l = .5, c = .12, a = 1) { return `oklch(${l} ${c} ${hue(area)} / ${a})`; }
function al(area: string, a = 1) { return `oklch(.95 .05 ${hue(area)} / ${a})`; }

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Action item ───────────────────────────────────────────────────────────────

function ActionItem({
  action, area, onToggle, onDelete,
}: {
  action: GoalAction; area: string;
  onToggle: () => void; onDelete: () => void;
}) {
  const done = action.status === "concluida";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0",
      borderBottom: "1px solid oklch(.92 .02 160)",
    }}>
      <button type="button" onClick={onToggle} style={{
        border: 0, background: "none", padding: 0, cursor: "pointer", flexShrink: 0, marginTop: 1,
      }}>
        {done
          ? <CheckCircle2 size={20} style={{ color: ac(area) }} />
          : <Circle size={20} style={{ color: "oklch(.75 .03 160)" }} />
        }
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 500,
          color: done ? "oklch(.65 .03 160)" : "oklch(.25 .02 160)",
          textDecoration: done ? "line-through" : "none",
          lineHeight: 1.4,
        }}>
          {action.title}
        </p>
        {action.if_then && !done && (
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "oklch(.55 .06 220)", fontStyle: "italic" }}>
            SE {action.if_then}
          </p>
        )}
      </div>
      <button type="button" onClick={onDelete} style={{
        border: 0, background: "none", padding: 4, cursor: "pointer", flexShrink: 0,
        color: "oklch(.75 .03 160)",
      }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Stage card ────────────────────────────────────────────────────────────────

function StageCard({
  stage, area, index, onToggleStage, onToggleAction, onAddAction, onDeleteAction,
}: {
  stage: GoalStage & { goal_actions: GoalAction[] };
  area: string; index: number;
  onToggleStage: () => void;
  onToggleAction: (actionId: string) => void;
  onAddAction: (title: string, ifThen?: string) => void;
  onDeleteAction: (actionId: string) => void;
}) {
  const [open, setOpen] = useState(stage.status !== "concluida");
  const [adding, setAdding] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [newIfThen, setNewIfThen] = useState("");
  const [showIfThen, setShowIfThen] = useState(false);

  const actions = stage.goal_actions ?? [];
  const doneCount = actions.filter((a) => a.status === "concluida").length;
  const isDone = stage.status === "concluida";

  const handleAddAction = () => {
    if (!newAction.trim()) return;
    onAddAction(newAction.trim(), newIfThen.trim() || undefined);
    setNewAction(""); setNewIfThen(""); setAdding(false); setShowIfThen(false);
  };

  return (
    <div style={{
      borderRadius: 16, border: isDone
        ? `1.5px solid ${ac(area, .6, .08, .4)}`
        : "1.5px solid oklch(.88 .02 160)",
      background: isDone ? al(area, .5) : "#fff",
      overflow: "hidden",
      transition: "all .2s ease",
    }}>
      {/* Stage header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        cursor: "pointer",
      }} onClick={() => setOpen((o) => !o)}>
        {/* Number / check */}
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleStage(); }} style={{
          width: 32, height: 32, borderRadius: "50%", border: 0, cursor: "pointer", flexShrink: 0,
          background: isDone ? ac(area) : "oklch(.93 .04 160)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s ease",
        }}>
          {isDone
            ? <Check size={16} color="#fff" />
            : <span style={{ fontSize: 13, fontWeight: 800, color: "oklch(.45 .12 160)" }}>{index + 1}</span>
          }
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 14, fontWeight: 700,
            color: isDone ? ac(area, .4, .1) : "oklch(.2 .02 160)",
            textDecoration: isDone ? "line-through" : "none",
          }}>
            {stage.title}
          </p>
          {actions.length > 0 && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "oklch(.6 .04 160)" }}>
              {doneCount}/{actions.length} ações
            </p>
          )}
        </div>

        {open ? <ChevronUp size={16} style={{ color: "oklch(.65 .04 160)", flexShrink: 0 }} />
               : <ChevronDown size={16} style={{ color: "oklch(.65 .04 160)", flexShrink: 0 }} />}
      </div>

      {/* Stage body */}
      {open && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid oklch(.92 .02 160)" }}>
          {actions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {actions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  area={area}
                  onToggle={() => onToggleAction(action.id)}
                  onDelete={() => onDeleteAction(action.id)}
                />
              ))}
            </div>
          )}

          {/* Add action */}
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} style={{
              marginTop: 10, display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", borderRadius: 10, border: `1.5px dashed oklch(.8 .04 160)`,
              background: "transparent", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              color: "oklch(.5 .08 160)", cursor: "pointer",
            }}>
              <Plus size={14} /> Adicionar ação
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
                  padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(.7 .06 160)",
                  background: "oklch(.98 .005 160)", fontFamily: "inherit", fontSize: 13,
                  color: "oklch(.2 .02 160)", outline: "none",
                }}
              />
              {showIfThen ? (
                <input
                  type="text"
                  value={newIfThen}
                  onChange={(e) => setNewIfThen(e.target.value)}
                  placeholder="SE [situação], ENTÃO farei isso..."
                  style={{
                    padding: "10px 12px", borderRadius: 10, border: "1.5px solid oklch(.75 .06 220)",
                    background: "oklch(.97 .02 220)", fontFamily: "inherit", fontSize: 12,
                    color: "oklch(.3 .06 220)", outline: "none",
                  }}
                />
              ) : (
                <button type="button" onClick={() => setShowIfThen(true)} style={{
                  textAlign: "left", padding: 0, border: 0, background: "none",
                  fontSize: 11, color: "oklch(.55 .06 220)", cursor: "pointer", fontFamily: "inherit",
                  textDecoration: "underline",
                }}>
                  + Adicionar plano SE-ENTÃO (aumenta 2-3× as chances de executar)
                </button>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setAdding(false); setNewAction(""); setShowIfThen(false); }} style={{
                  flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid oklch(.85 .02 160)",
                  background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                  color: "oklch(.5 .04 160)",
                }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleAddAction} disabled={!newAction.trim()} style={{
                  flex: 1, padding: "9px 12px", borderRadius: 10, border: 0,
                  background: newAction.trim() ? ac(area) : "oklch(.88 .02 160)",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  color: newAction.trim() ? "#fff" : "oklch(.6 .02 160)", cursor: "pointer",
                }}>
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
      <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid oklch(.5 .12 160)", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!goal) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
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
  const pct = goalProgress(goal);
  const stages = goal.goal_stages ?? [];
  const daysLeft = goal.target_date ? daysUntil(goal.target_date) : null;

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 100 }}>
      <Confetti active={confetti} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${ac(area)}, ${ac(area, .38, .16, 1)})`,
        padding: "52px 20px 28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "oklch(1 0 0 / .06)" }} />
        <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "oklch(1 0 0 / .04)" }} />

        {/* Top row */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button type="button" onClick={() => router.push("/metas")} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "oklch(1 0 0 / .15)", border: 0, borderRadius: 10,
            padding: "8px 12px", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <ChevronLeft size={16} /> Metas
          </button>
          <button type="button" onClick={() => setShowMenu((v) => !v)} style={{
            width: 36, height: 36, borderRadius: "50%", border: 0, cursor: "pointer",
            background: "oklch(1 0 0 / .15)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MoreHorizontal size={18} color="#fff" />
          </button>
        </div>

        {/* Context menu */}
        {showMenu && (
          <div style={{
            position: "absolute", top: 60, right: 20, zIndex: 100,
            background: "#fff", borderRadius: 16, padding: "8px 0",
            boxShadow: "0 8px 32px oklch(.2 .04 160 / .2)", minWidth: 200,
          }}>
            {[
              { icon: Pencil, label: "Editar meta", action: () => { setShowMenu(false); } },
              goal.status === "ativa"
                ? { icon: Archive, label: "Pausar meta", action: () => updateStatus("pausada") }
                : { icon: Target, label: "Reativar meta", action: () => updateStatus("ativa") },
              { icon: CheckCircle2, label: "Marcar como concluída", action: () => updateStatus("concluida") },
              { icon: Trash2, label: "Arquivar", action: () => updateStatus("arquivada") },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} type="button" onClick={action} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "12px 16px", border: 0, background: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "oklch(.25 .04 160)",
                textAlign: "left",
              }}>
                <Icon size={16} style={{ color: "oklch(.55 .08 160)", flexShrink: 0 }} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Goal info */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
              background: "oklch(1 0 0 / .2)", color: "#fff",
            }}>
              {goal.type === "destino" ? <Target size={10} /> : <Compass size={10} />}
              {goal.type === "destino" ? "Destino" : "Direção"}
            </span>
            <span style={{
              padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
              background: "oklch(1 0 0 / .15)", color: "oklch(1 0 0 / .9)",
            }}>
              {areaConf.emoji} {areaConf.label}
            </span>
            {goal.status === "pausada" && (
              <span style={{
                padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700,
                background: "oklch(.97 .04 50)", color: "oklch(.45 .14 50)",
              }}>
                Pausada
              </span>
            )}
          </div>

          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
            {goal.title}
          </h1>

          {goal.why_it_matters && (
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "oklch(1 0 0 / .8)", fontStyle: "italic", lineHeight: 1.5 }}>
              "{goal.why_it_matters}"
            </p>
          )}

          {/* Progress + deadline */}
          {goal.type === "destino" && stages.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "oklch(1 0 0 / .8)" }}>
                  {stages.filter((s) => s.status === "concluida").length} de {stages.length} etapas
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 9999, background: "oklch(1 0 0 / .2)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 9999, width: `${pct}%`,
                  background: pct >= 100 ? "oklch(.8 .15 120)" : "#fff",
                  transition: "width .6s ease",
                }} />
              </div>
              {daysLeft !== null && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "oklch(1 0 0 / .75)" }}>
                  {daysLeft < 0 ? `⚠️ Prazo vencido há ${Math.abs(daysLeft)} dias`
                    : daysLeft === 0 ? "🎯 Prazo: hoje!"
                    : `📅 ${daysLeft} dias para o prazo`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Commitment block */}
        {(goal.guardian_name || goal.reward || goal.punishment) && (
          <div style={{
            background: "#fff", borderRadius: 18,
            boxShadow: "0 2px 12px oklch(.2 .04 160 / .07)",
            overflow: "hidden",
          }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${ac(area)}, oklch(.6 .12 85))` }} />
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                Comprometimento
              </p>

              {goal.guardian_name && (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: "oklch(.93 .04 160)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Shield size={18} style={{ color: ac(area) }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "oklch(.6 .04 160)", fontWeight: 600 }}>Guardião</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "oklch(.22 .02 160)" }}>{goal.guardian_name}</p>
                    {goal.guardian_contact && (
                      <p style={{ margin: 0, fontSize: 11, color: "oklch(.55 .04 160)" }}>{goal.guardian_contact}</p>
                    )}
                  </div>
                  <button type="button" onClick={shareGuardian} style={{
                    border: 0, borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                    background: al(area), display: "flex", alignItems: "center", gap: 5,
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: ac(area),
                  }}>
                    <Share2 size={12} /> Compartilhar
                  </button>
                </div>
              )}

              {goal.reward && (
                <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, background: "oklch(.97 .04 85)" }}>
                  <Trophy size={18} style={{ color: "oklch(.5 .14 85)", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "oklch(.5 .1 85)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      Recompensa
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "oklch(.35 .06 85)", lineHeight: 1.4 }}>{goal.reward}</p>
                  </div>
                </div>
              )}

              {goal.punishment && (
                <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, background: "oklch(.97 .04 15)" }}>
                  <AlertOctagon size={18} style={{ color: "oklch(.5 .18 15)", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "oklch(.5 .14 15)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      Punição
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "oklch(.38 .08 15)", lineHeight: 1.4 }}>{goal.punishment}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stages */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              Etapas & Ações
            </p>
            <button type="button" onClick={() => setAddingStage(true)} style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 10,
              border: "1.5px solid oklch(.8 .04 160)", background: "#fff", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: "oklch(.45 .1 160)",
            }}>
              <Plus size={14} /> Etapa
            </button>
          </div>

          {stages.length === 0 && !addingStage && (
            <div style={{
              textAlign: "center", padding: "28px 20px",
              borderRadius: 16, border: "2px dashed oklch(.85 .03 160)",
              background: "#fff",
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

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stages.map((stage, i) => (
              <StageCard
                key={stage.id}
                stage={stage}
                area={area}
                index={i}
                onToggleStage={() => toggleStage(stage.id, stage.status)}
                onToggleAction={(actionId) => toggleAction(stage.id, actionId, (stage.goal_actions ?? []).find((a) => a.id === actionId)?.status ?? "pendente")}
                onAddAction={(title, ifThen) => addAction(stage.id, title, ifThen)}
                onDeleteAction={deleteAction}
              />
            ))}
          </div>

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
                  border: "1.5px solid oklch(.7 .06 160)", background: "#fff",
                  fontFamily: "inherit", fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
                }}
              />
              <button type="button" onClick={addStage} style={{
                padding: "12px 16px", borderRadius: 12, border: 0, cursor: "pointer",
                background: ac(area), color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              }}>
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Coach CTA */}
        <button type="button" onClick={() => router.push("/metas/coach")} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
          borderRadius: 18, border: 0, cursor: "pointer", textAlign: "left",
          background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
          boxShadow: "0 4px 16px oklch(.42 .14 200 / .3)",
        }}>
          <Sparkles size={22} color="#fff" />
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#fff" }}>Falar com Maya</p>
            <p style={{ margin: 0, fontSize: 12, color: "oklch(1 0 0 / .75)" }}>
              Sua coach IA tem acesso a todas suas metas
            </p>
          </div>
        </button>
      </div>

      {showMenu && (
        <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
      )}
    </div>
  );
}
