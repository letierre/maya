"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

type GoalFull = Goal & { goal_stages: (GoalStage & { goal_actions: GoalAction[] })[] };

function goalProgress(goal: GoalFull): number {
  const s = goal.goal_stages ?? [];
  if (!s.length) return 0;
  return Math.round((s.filter((x) => x.status === "concluida").length / s.length) * 100);
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function nextAction(goal: GoalFull): string | null {
  for (const stage of (goal.goal_stages ?? [])) {
    if (stage.status === "concluida") continue;
    const pending = (stage.goal_actions ?? []).find((a) => a.status === "pendente");
    if (pending) return pending.title;
    return null;
  }
  return null;
}

function currentStageTitle(goal: GoalFull): string {
  const stage = (goal.goal_stages ?? []).find((s) => s.status !== "concluida");
  return stage?.title ?? "";
}

function romanYear(): string {
  const y = new Date().getFullYear();
  const thousands = ["", "M", "MM", "MMM"];
  const hundreds =  ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"];
  const tens =      ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"];
  const ones =      ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
  return (
    thousands[Math.floor(y / 1000)] +
    hundreds[Math.floor((y % 1000) / 100)] +
    tens[Math.floor((y % 100) / 10)] +
    ones[y % 10]
  );
}

// ── Meta spread ───────────────────────────────────────────────────────────────

function MetaSpread({ goal, order, primary, onClick }: {
  goal: GoalFull; order: string; primary: boolean; onClick: () => void;
}) {
  const conf = AREA_CONFIG[goal.area] ?? AREA_CONFIG.saude;
  const hue = conf.hue;
  const pct = goalProgress(goal);
  const stage = currentStageTitle(goal);
  const next = nextAction(goal);
  const daysLeft = goal.target_date ? daysUntil(goal.target_date) : null;
  const isPaused = goal.status === "pausada";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left", background: "transparent",
        border: "none", padding: "24px 24px 22px", cursor: "pointer",
        borderTop: "1px solid oklch(.28 .02 270 / .5)",
        opacity: isPaused ? 0.55 : 1,
      }}
    >
      {/* Header: order numeral + area chip */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{
          fontFamily: "var(--font-mono, ui-monospace)", fontSize: 32, fontWeight: 800,
          letterSpacing: "-0.04em", lineHeight: 0.85, color: `oklch(.5 .14 ${hue})`,
          opacity: primary ? 1 : 0.55,
        }}>{order}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase",
          color: `oklch(.4 .12 ${hue})`,
        }}>
          {conf.emoji} {conf.label}
        </span>
      </div>

      {/* Title */}
      <h2 style={{
        margin: "8px 0 0", fontSize: primary ? 22 : 18,
        fontWeight: primary ? 700 : 600, letterSpacing: "-0.02em",
        lineHeight: 1.2, color: "#e0d6ff",
      }}>
        {goal.title}
      </h2>

      {/* Why */}
      {goal.why_it_matters && (
        <p style={{
          margin: "8px 0 0", fontSize: primary ? 14 : 13, lineHeight: 1.45,
          color: "oklch(.55 .03 270)", fontStyle: "italic",
        }}>
          "{goal.why_it_matters}"
        </p>
      )}

      {/* Progress: big number + bar */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "60px 1fr", gap: 14, alignItems: "center" }}>
        <span style={{
          fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1,
          color: `oklch(.4 .14 ${hue})`,
        }}>
          {pct}<span style={{ fontSize: 14, opacity: 0.6 }}>%</span>
        </span>
        <div>
          <div style={{ height: 3, borderRadius: 9999, background: `oklch(.5 .12 ${hue} / .15)`, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`, borderRadius: 9999,
              background: `linear-gradient(90deg, oklch(.45 .14 ${hue}), oklch(.55 .14 ${hue}))`,
            }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "oklch(.55 .03 270)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontStyle: "italic" }}>{isPaused ? "Pausada" : stage}</span>
            {daysLeft !== null && daysLeft >= 0 && !isPaused && (
              <span style={{ color: "oklch(.42 .14 50)", fontWeight: 600 }}>{daysLeft}d restantes</span>
            )}
          </div>
        </div>
      </div>

      {/* Next action */}
      {next && !isPaused && (
        <p style={{
          margin: "14px 0 0", fontSize: 12, color: "#e0d6ff",
          paddingLeft: 12, borderLeft: `2px solid oklch(.5 .14 ${hue} / .5)`,
        }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
            color: `oklch(.5 .12 ${hue})`, display: "block", marginBottom: 2,
          }}>
            Próximo passo
          </span>
          {next}
        </p>
      )}
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

  const orderedGoals = useMemo(() => {
    const active = goals.filter((g) => g.status === "ativa");
    const paused = goals.filter((g) => g.status === "pausada");
    active.sort((a, b) => {
      const aDays = a.target_date ? daysUntil(a.target_date) : 999;
      const bDays = b.target_date ? daysUntil(b.target_date) : 999;
      return aDays - bDays;
    });
    return [...active, ...paused];
  }, [goals]);

  const activeCount = goals.filter((g) => g.status === "ativa").length;
  const pausedCount = goals.filter((g) => g.status === "pausada").length;
  const canAddMore = activeCount < 5;

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.12 .012 270)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #7C5CFF", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", paddingBottom: 110,
      background: `
        radial-gradient(ellipse 70% 40% at 50% 0%, oklch(.58 .18 270 / .15) 0%, transparent 60%),
        linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
      `,
    }}>

      {/* Editorial header */}
      <div style={{ padding: "24px 24px 8px", textAlign: "center", position: "relative" }}>
        <p style={{
          margin: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
          color: "oklch(.55 .03 270)", letterSpacing: ".16em", textTransform: "uppercase",
        }}>
          Volume I · {romanYear()}
        </p>
        <h1 style={{
          margin: "6px 0 0", fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05,
          fontStyle: "italic", color: "#e0d6ff",
        }}>
          O livro das metas
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "oklch(.55 .03 270)" }}>
          {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
          {pausedCount > 0 && ` · ${pausedCount} pausada${pausedCount > 1 ? "s" : ""}`}
          {canAddMore && (
            <span style={{ color: "oklch(.55 .03 270)" }}> · {5 - activeCount} slot{5 - activeCount !== 1 ? "s" : ""} livre{5 - activeCount !== 1 ? "s" : ""}</span>
          )}
          {!canAddMore && <span style={{ color: "oklch(.5 .14 15)", fontWeight: 600 }}> · limite atingido</span>}
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <span style={{ width: 44, height: 1, background: "oklch(.28 .02 270 / .5)", display: "block" }} />
        </div>

        {/* Nova meta link */}
        {canAddMore && (
          <button type="button" onClick={() => router.push("/metas/nova")} style={{
            position: "absolute", top: 28, right: 24,
            background: "transparent", border: 0, padding: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#7C5CFF",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <Plus size={13} /> Nova meta
          </button>
        )}
      </div>

      {/* Goals list */}
      {orderedGoals.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <p style={{
            margin: "0 0 4px", fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
            color: "oklch(.55 .03 270)", letterSpacing: ".16em", textTransform: "uppercase",
          }}>
            Capítulo I
          </p>
          <h2 style={{ margin: "8px 0 6px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", fontStyle: "italic", color: "#e0d6ff" }}>
            Sua história começa aqui
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: "oklch(.55 .03 270)", lineHeight: 1.6 }}>
            Nenhuma meta ainda. Crie a primeira e dê o primeiro passo.
          </p>
          <button type="button" onClick={() => router.push("/metas/nova")} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 24px", borderRadius: 14, border: 0, cursor: "pointer",
            background: "#7C5CFF", color: "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          }}>
            <Plus size={18} /> Criar primeira meta
          </button>
        </div>
      ) : (
        <>
          {orderedGoals.map((goal, i) => (
            <MetaSpread
              key={goal.id}
              goal={goal}
              order={ROMANS[i] ?? String(i + 1)}
              primary={i === 0}
              onClick={() => router.push(`/metas/${goal.id}`)}
            />
          ))}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "center", margin: "32px 0 0" }}>
            <span style={{ width: 44, height: 1, background: "oklch(.28 .02 270 / .5)", display: "block" }} />
          </div>
          <p style={{ margin: "14px 24px", fontSize: 11, fontStyle: "italic", color: "oklch(.55 .03 270)", textAlign: "center" }}>
            Toque numa meta para abrir o capítulo completo.
          </p>
        </>
      )}
    </div>
  );
}
