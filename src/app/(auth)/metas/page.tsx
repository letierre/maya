"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Compass, ChevronRight, Trophy, AlertTriangle, Calendar, Shield, Sparkles } from "lucide-react";
import type { Goal, GoalStage, GoalAction } from "@/types";

// ── Area config ───────────────────────────────────────────────────────────────

const AREA_CONFIG: Record<string, { label: string; emoji: string; hue: number }> = {
  saude:          { label: "Saúde",                  emoji: "💚", hue: 160 },
  carreira:       { label: "Carreira",               emoji: "💼", hue: 220 },
  financas:       { label: "Finanças",               emoji: "💰", hue: 85  },
  relacionamentos:{ label: "Relacionamentos",        emoji: "❤️", hue: 15  },
  desenvolvimento:{ label: "Desenvolvimento",        emoji: "🧠", hue: 270 },
  familia:        { label: "Família",                emoji: "🏡", hue: 40  },
  lazer:          { label: "Lazer",                  emoji: "🌊", hue: 185 },
  espiritualidade:{ label: "Espiritualidade",        emoji: "✨", hue: 300 },
};

function areaColor(area: string, alpha = 1) {
  const hue = AREA_CONFIG[area]?.hue ?? 160;
  return `oklch(.5 .12 ${hue} / ${alpha})`;
}
function areaLight(area: string, alpha = 1) {
  const hue = AREA_CONFIG[area]?.hue ?? 160;
  return `oklch(.96 .04 ${hue} / ${alpha})`;
}
function areaMid(area: string, alpha = 1) {
  const hue = AREA_CONFIG[area]?.hue ?? 160;
  return `oklch(.75 .08 ${hue} / ${alpha})`;
}

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };

// ── Progress calc ─────────────────────────────────────────────────────────────

function goalProgress(goal: GoalFull): number {
  const stages = goal.goal_stages ?? [];
  if (!stages.length) return 0;
  return Math.round((stages.filter((s) => s.status === "concluida").length / stages.length) * 100);
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function nextAction(goal: GoalFull): string | null {
  for (const stage of (goal.goal_stages ?? [])) {
    if (stage.status === "concluida") continue;
    const pending = (stage.goal_actions ?? []).find((a) => a.status === "pendente");
    if (pending) return pending.title;
  }
  return null;
}

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, onClick }: { goal: GoalFull; onClick: () => void }) {
  const area = AREA_CONFIG[goal.area] ?? AREA_CONFIG.saude;
  const pct = goalProgress(goal);
  const inactive = daysSince(goal.updated_at);
  const isInactive = inactive >= 14;
  const next = nextAction(goal);
  const daysLeft = goal.target_date ? daysUntil(goal.target_date) : null;
  const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", background: "none", border: "none",
        padding: 0, cursor: "pointer",
      }}
    >
      <div style={{
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 2px 16px oklch(.2 .04 160 / .08), 0 1px 4px oklch(.2 .04 160 / .06)",
        overflow: "hidden",
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px oklch(.2 .04 160 / .12), 0 2px 8px oklch(.2 .04 160 / .08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px oklch(.2 .04 160 / .08), 0 1px 4px oklch(.2 .04 160 / .06)";
        }}
      >
        {/* Color accent bar */}
        <div style={{ height: 5, background: areaColor(goal.area) }} />

        <div style={{ padding: "16px 18px 18px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            {/* Area emoji badge */}
            <div style={{
              width: 42, height: 42, borderRadius: 14, flexShrink: 0,
              background: areaLight(goal.area),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>
              {area.emoji}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Type + area tags */}
              <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                  background: areaLight(goal.area), color: areaColor(goal.area),
                }}>
                  {goal.type === "destino" ? <Target size={9} /> : <Compass size={9} />}
                  {goal.type === "destino" ? "Destino" : "Direção"}
                </span>
                <span style={{
                  padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 600,
                  background: "oklch(.95 .01 160)", color: "oklch(.45 .06 160)",
                }}>
                  {area.label}
                </span>
                {isInactive && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                    background: "oklch(.97 .06 60)", color: "oklch(.5 .14 60)",
                  }}>
                    <AlertTriangle size={9} /> {inactive}d sem atividade
                  </span>
                )}
                {isOverdue && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                    background: "oklch(.97 .06 15)", color: "oklch(.5 .18 15)",
                  }}>
                    <AlertTriangle size={9} /> Prazo vencido
                  </span>
                )}
                {isUrgent && !isOverdue && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700,
                    background: "oklch(.97 .05 50)", color: "oklch(.45 .16 50)",
                  }}>
                    <Calendar size={9} /> {daysLeft}d restantes
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "oklch(.18 .02 160)", lineHeight: 1.3 }}>
                {goal.title}
              </h3>
            </div>

            <ChevronRight size={18} style={{ color: "oklch(.7 .04 160)", flexShrink: 0, marginTop: 2 }} />
          </div>

          {/* Why it matters */}
          {goal.why_it_matters && (
            <p style={{
              margin: "0 0 12px", fontSize: 12, color: "oklch(.5 .04 160)",
              fontStyle: "italic", lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              "{goal.why_it_matters}"
            </p>
          )}

          {/* Progress bar (destination goals only) */}
          {goal.type === "destino" && (goal.goal_stages?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(.5 .04 160)" }}>
                  {(goal.goal_stages ?? []).filter((s) => s.status === "concluida").length} de {goal.goal_stages?.length} etapas
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: areaColor(goal.area) }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 9999, background: areaLight(goal.area), overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 9999,
                  background: pct >= 100
                    ? "linear-gradient(90deg, oklch(.5 .15 160), oklch(.55 .18 120))"
                    : `linear-gradient(90deg, ${areaColor(goal.area)}, ${areaMid(goal.area)})`,
                  width: `${pct}%`,
                  transition: "width .6s ease",
                }} />
              </div>
            </div>
          )}

          {/* Next action + footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {next ? (
                <p style={{
                  margin: 0, fontSize: 11, color: "oklch(.45 .06 160)", fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  → {next}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 11, color: "oklch(.65 .03 160)" }}>
                  Adicione ações às etapas
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {goal.guardian_name && (
                <span title={`Guardião: ${goal.guardian_name}`} style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "oklch(.92 .04 160)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Shield size={12} style={{ color: "oklch(.45 .1 160)" }} />
                </span>
              )}
              {goal.reward && (
                <span title={`Recompensa: ${goal.reward}`} style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "oklch(.95 .04 85)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trophy size={12} style={{ color: "oklch(.5 .14 85)" }} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MetasPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalFull[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      const data = await res.json();
      if (Array.isArray(data)) {
        setGoals(data.filter((g: GoalFull) => g.status === "ativa" || g.status === "pausada"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const activeGoals = goals.filter((g) => g.status === "ativa");
  const pausedGoals = goals.filter((g) => g.status === "pausada");

  const limitPct = Math.min((activeGoals.length / 5) * 100, 100);
  const limitColor = activeGoals.length >= 5
    ? "oklch(.5 .18 15)"
    : activeGoals.length >= 4
    ? "oklch(.5 .16 50)"
    : "oklch(.45 .15 160)";

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, oklch(.5 .12 160), oklch(.42 .14 200))",
        padding: "52px 20px 32px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -40, right: -40, width: 160, height: 160,
          borderRadius: "50%", background: "oklch(1 0 0 / .06)",
        }} />
        <div style={{
          position: "absolute", bottom: -20, left: -20, width: 100, height: 100,
          borderRadius: "50%", background: "oklch(1 0 0 / .04)",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "oklch(1 0 0 / .7)", fontWeight: 500 }}>
            Seu sistema de metas
          </p>
          <h1 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>
            Metas & Objetivos
          </h1>

          {/* Limit indicator */}
          <div style={{
            background: "oklch(1 0 0 / .15)", borderRadius: 14, padding: "12px 16px",
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "oklch(1 0 0 / .85)", fontWeight: 600 }}>
                Metas ativas
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                {activeGoals.length} / 5
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 9999, background: "oklch(1 0 0 / .2)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 9999, width: `${limitPct}%`,
                background: activeGoals.length >= 5
                  ? "oklch(.7 .18 15)"
                  : "oklch(1 0 0 / .8)",
                transition: "width .5s ease",
              }} />
            </div>
            {activeGoals.length >= 5 && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "oklch(.9 .06 15)", fontWeight: 600 }}>
                ⚠️ Limite atingido — conclua ou pause uma meta para criar nova
              </p>
            )}
            {activeGoals.length === 0 && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "oklch(1 0 0 / .65)" }}>
                Pesquisas mostram que 3–5 metas grandes por ano é o ponto ideal de foco
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{
                height: 160, borderRadius: 20, background: "oklch(.93 .01 160)",
                animation: "pulse 1.5s ease infinite",
              }} />
            ))}
          </div>
        ) : goals.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", margin: "0 auto 20px",
              background: "oklch(.93 .04 160)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Target size={36} style={{ color: "oklch(.5 .12 160)" }} />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "oklch(.25 .04 160)" }}>
              Suas metas começam aqui
            </h2>
            <p style={{ margin: "0 0 28px", fontSize: 14, color: "oklch(.5 .04 160)", lineHeight: 1.6 }}>
              Crie de 3 a 5 metas grandes para o ano. Cada uma vira um projeto com etapas, ações e um guardião que vai te cobrar.
            </p>
            <button
              type="button"
              onClick={() => router.push("/metas/nova")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px", borderRadius: 14, border: 0, cursor: "pointer",
                background: "oklch(.5 .12 160)", color: "#fff",
                fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                boxShadow: "0 4px 16px oklch(.5 .12 160 / .35)",
              }}
            >
              <Plus size={20} /> Criar primeira meta
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Active goals */}
            {activeGoals.length > 0 && (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activeGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onClick={() => router.push(`/metas/${goal.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Paused goals */}
            {pausedGoals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.6 .04 160)" }}>
                  Pausadas
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pausedGoals.map((goal) => (
                    <div key={goal.id} style={{ opacity: 0.6 }}>
                      <GoalCard goal={goal} onClick={() => router.push(`/metas/${goal.id}`)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB — Nova meta */}
      {!loading && activeGoals.length < 5 && (
        <button
          type="button"
          onClick={() => router.push("/metas/nova")}
          style={{
            position: "fixed", bottom: 88, right: 20, zIndex: 40,
            width: 56, height: 56, borderRadius: "50%", border: 0, cursor: "pointer",
            background: "oklch(.5 .12 160)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px oklch(.5 .12 160 / .45)",
            transition: "transform .15s ease",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          <Plus size={26} color="#fff" />
        </button>
      )}

      {/* Coach button */}
      <button
        type="button"
        onClick={() => router.push("/metas/coach")}
        style={{
          position: "fixed", bottom: 88, left: 20, zIndex: 40,
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 18px", borderRadius: 28, border: 0, cursor: "pointer",
          background: "linear-gradient(135deg, oklch(.42 .14 200), oklch(.5 .12 160))",
          color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 20px oklch(.4 .12 200 / .4)",
        }}
      >
        <Sparkles size={16} /> Coach Maya
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: .5 }
        }
      `}</style>
    </div>
  );
}
