"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { filterActiveAgenda } from "@/lib/agenda-repeat";
import type { QuarterlyCycle } from "@/types";
import { FOREGROUND, MUTED, PURPLE, CARD } from "./Section";

// As 8 áreas que a Roda da Vida exibe (mesmas de AreaBalance.tsx)
const AREA_KEYS = [
  "espiritualidade", "carreira", "desenvolvimento", "familia",
  "relacionamentos", "financas", "lazer", "saude",
];

interface GoalStage { id: string; status: string; }
interface GoalSummary {
  id: string;
  title: string;
  area: string;
  status: string;
  goal_stages?: GoalStage[];
}
interface RawTask { area: string; status: string; }
interface RawReview { week_score: number; }
interface RawPlan {
  week_start: string;
  weekly_tasks?: RawTask[];
  weekly_reviews?: RawReview[];
}
interface WeeklyPlansResp { plans: RawPlan[]; }
interface RawAgendaItem { id: string; title: string; date: string; area: string | null; status: string; repeat_type?: string | null; repeat_until?: string | null; excluded?: boolean; }

interface Pillar { key: string; label: string; emoji: string; pct: number | null; }

/** Progresso do ciclo de OKR (0–100), mesma fórmula de OKRProgress.tsx. */
function cyclePct(cycle: QuarterlyCycle): number {
  const krs = cycle.key_results ?? [];
  if (krs.length === 0) return 0;
  return Math.round(
    krs.reduce(
      (s, kr) => s + (kr.target > 0 ? Math.min(100, (kr.current / kr.target) * 100) : 0),
      0,
    ) / krs.length,
  );
}

/** Média do % de etapas concluídas das metas ativas (sem etapas = fora). */
function metasPct(goals: GoalSummary[]): number | null {
  const withStages = goals.filter((g) => g.status === "ativa" && (g.goal_stages?.length ?? 0) > 0);
  if (withStages.length === 0) return null;
  const sum = withStages.reduce((s, g) => {
    const total = g.goal_stages!.length;
    const done = g.goal_stages!.filter((st) => st.status === "concluida").length;
    return s + Math.round((done / total) * 100);
  }, 0);
  return Math.round(sum / withStages.length);
}

function okrPct(cycles: QuarterlyCycle[]): number | null {
  const active = cycles.find((c) => c.status === "active");
  if (!active || !active.key_results || active.key_results.length === 0) return null;
  return cyclePct(active);
}

/** Média do % de conclusão por área (Roda da Vida) no período. */
function equilibrioPct(plans: RawPlan[], agendaItems: RawAgendaItem[]): number | null {
  const done: Record<string, number> = {};
  const totals: Record<string, number> = {};
  for (const p of plans) {
    for (const t of p.weekly_tasks ?? []) {
      if (!AREA_KEYS.includes(t.area)) continue;
      totals[t.area] = (totals[t.area] ?? 0) + 1;
      if (t.status === "concluida") done[t.area] = (done[t.area] ?? 0) + 1;
    }
  }
  for (const it of agendaItems) {
    if (!it.area || !AREA_KEYS.includes(it.area)) continue;
    totals[it.area] = (totals[it.area] ?? 0) + 1;
    if (it.status === "concluida") done[it.area] = (done[it.area] ?? 0) + 1;
  }
  const engaged = AREA_KEYS.filter((k) => (totals[k] ?? 0) > 0);
  if (engaged.length === 0) return null;
  const sum = engaged.reduce((s, k) => s + ((done[k] ?? 0) / totals[k]) * 100, 0);
  return Math.round(sum / engaged.length);
}

/** week_score (1–5) da revisão mais recente no período → 0–100. */
function ritmoPct(plans: RawPlan[]): number | null {
  const withReview = [...plans]
    .filter((p) => (p.weekly_reviews?.length ?? 0) > 0)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  if (withReview.length === 0) return null;
  const s = withReview[withReview.length - 1].weekly_reviews![0].week_score;
  return Math.round(((s - 1) / 4) * 100);
}

/** Nota de crescimento 0–100: média dos pilares com dado. */
export function GrowthScore({ from, to }: { from: string; to: string }) {
  const [goals, setGoals] = useState<GoalSummary[] | null>(null);
  const [cycles, setCycles] = useState<QuarterlyCycle[] | null>(null);
  const [plans, setPlans] = useState<RawPlan[] | null>(null);
  const [agendaItems, setAgendaItems] = useState<RawAgendaItem[] | null>(null);
  const [ringInfo, setRingInfo] = useState(false);

  useEffect(() => {
    safeCachedFetch<GoalSummary[]>("/api/goals").then((d) => setGoals(Array.isArray(d) ? d : []));
    safeCachedFetch<QuarterlyCycle[]>("/api/quarterly-cycles").then((d) => setCycles(Array.isArray(d) ? d : []));
    safeCachedFetch<WeeklyPlansResp>(`/api/weekly-plans?from=${from}&to=${to}`).then((r) => setPlans(r?.plans ?? []));
    safeCachedFetch<RawAgendaItem[]>(`/api/agenda?from=${from}&to=${to}`).then((d) => setAgendaItems(filterActiveAgenda(Array.isArray(d) ? d : [])));
  }, [from, to]);

  if (goals === null || cycles === null || plans === null || agendaItems === null) return null;

  const pillars: Pillar[] = [
    { key: "metas", label: "Metas", emoji: "🎯", pct: metasPct(goals) },
    { key: "okrs", label: "OKRs", emoji: "📊", pct: okrPct(cycles) },
    { key: "equilibrio", label: "Equilíbrio", emoji: "⚖️", pct: equilibrioPct(plans, agendaItems) },
    { key: "ritmo", label: "Ritmo", emoji: "📈", pct: ritmoPct(plans) },
  ];

  const withData = pillars.filter((p) => p.pct != null);

  // Nenhum dado de crescimento ainda.
  if (withData.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ ...CARD, textAlign: "center", maxWidth: 320 }}>
          <p style={{ margin: 0, fontSize: 13, color: FOREGROUND, fontWeight: 600 }}>
            Nenhum dado de crescimento ainda
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            Complete metas, OKRs ou revisões semanais para ver sua nota de crescimento por aqui.
          </p>
        </div>
      </div>
    );
  }

  const score = Math.round(withData.reduce((s, p) => s + (p.pct ?? 0), 0) / withData.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 4px" }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 140, height: 140, borderRadius: "50%",
          background: `conic-gradient(${PURPLE} ${Math.max(0, Math.min(score, 100)) * 3.6}deg, oklch(0.22 0.02 270) 0deg)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 106, height: 106, borderRadius: "50%",
            background: "oklch(0.12 0.012 270)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: FOREGROUND, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Crescimento</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRingInfo((v) => !v)}
          aria-label="O que é crescimento"
          title="O que é crescimento"
          style={{
            position: "absolute", top: 6, right: 6,
            width: 20, height: 20, borderRadius: "50%",
            border: "1px solid oklch(0.5 0.12 270 / 0.4)",
            background: "oklch(0.16 0.012 270)", cursor: "pointer",
            color: ringInfo ? PURPLE : MUTED,
            fontSize: 11, fontWeight: 700, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, fontFamily: "inherit",
          }}
        >
          i
        </button>
      </div>

      {/* Breakdown dos pilares */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {pillars.map((p) => (
          <div key={p.key} style={{ textAlign: "center", minWidth: 52 }}>
            <div style={{ fontSize: 16, lineHeight: 1 }}>{p.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: p.pct != null ? FOREGROUND : MUTED, marginTop: 4 }}>
              {p.pct != null ? `${p.pct}%` : "—"}
            </div>
            <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginTop: 1 }}>{p.label}</div>
          </div>
        ))}
      </div>

      {ringInfo && (
        <p style={{
          margin: "14px 0 0", maxWidth: 320, fontSize: 11, lineHeight: 1.45,
          color: "oklch(0.62 0.03 270)",
          background: "oklch(0.2 0.02 270)",
          borderRadius: 10, padding: "8px 10px", textAlign: "center",
        }}>
          Nota de 0 a 100 que sintetiza seu crescimento: média da conclusão das metas, do
          progresso dos OKRs, do equilíbrio entre as áreas da vida e do ritmo das revisões
          semanais. Pilares sem dado não entram na conta.
        </p>
      )}
    </div>
  );
}
