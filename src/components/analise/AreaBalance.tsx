"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { LifeWheel } from "@/components/planejamento/LifeWheel";
import { Section } from "./Section";
import { AreaDetailSheet } from "./AreaDetailSheet";

// As 8 áreas que a Roda da Vida exibe (sem "outros")
const AREA_KEYS = [
  "espiritualidade", "carreira", "desenvolvimento", "familia",
  "relacionamentos", "financas", "lazer", "saude",
];

interface RawTask {
  id: string;
  title: string;
  area: string;
  status: string;
  day_of_week: number;
  scheduled_time: string | null;
}
interface RawPlan { week_start: string; weekly_tasks?: RawTask[]; }
interface WeeklyPlansResp { plans: RawPlan[]; }
interface RawAgendaItem {
  id: string;
  title: string;
  area: string | null;
  status: string;
  item_type: string;
  date: string;
  start_time: string | null;
}

/** Roda da Vida agregando as tarefas de TODAS as semanas do período selecionado. */
export function AreaBalance({ from, to }: { from: string; to: string }) {
  const [plans, setPlans] = useState<RawPlan[]>([]);
  const [agendaItems, setAgendaItems] = useState<RawAgendaItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    safeCachedFetch<WeeklyPlansResp>(`/api/weekly-plans?from=${from}&to=${to}`).then((r) => {
      if (r?.plans) setPlans(r.plans);
    });
    safeCachedFetch<RawAgendaItem[]>(`/api/agenda?from=${from}&to=${to}`).then((r) => {
      if (Array.isArray(r)) setAgendaItems(r);
    });
  }, [from, to]);

  const done: Record<string, number> = {};
  const totals: Record<string, number> = {};
  for (const p of plans) {
    for (const t of p.weekly_tasks ?? []) {
      if (!AREA_KEYS.includes(t.area)) continue;
      totals[t.area] = (totals[t.area] ?? 0) + 1;
      if (t.status === "concluida") done[t.area] = (done[t.area] ?? 0) + 1;
    }
  }
  // Mescla itens da agenda (compromissos/tarefas criados direto na agenda)
  for (const it of agendaItems) {
    if (!it.area || !AREA_KEYS.includes(it.area)) continue;
    totals[it.area] = (totals[it.area] ?? 0) + 1;
    if (it.status === "concluida") done[it.area] = (done[it.area] ?? 0) + 1;
  }

  const hasData = AREA_KEYS.some((k) => (totals[k] ?? 0) > 0);
  if (!hasData) return null;

  // ── Toggle (otimista + PATCH; o estado local é a fonte única, sem refetch) ──
  const toggleTask = async (taskId: string, next: string) => {
    setPlans((prev) =>
      prev.map((p) => ({
        ...p,
        weekly_tasks: (p.weekly_tasks ?? []).map((t) =>
          t.id === taskId ? { ...t, status: next } : t
        ),
      }))
    );
    await fetch(`/api/weekly-plans/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const toggleAgenda = async (id: string, next: string) => {
    setAgendaItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: next } : it)));
    await fetch("/api/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
  };

  return (
    <Section title="Equilíbrio de áreas">
      <LifeWheel done={done} totals={totals} />
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "11px 0",
          borderRadius: 14,
          border: "1px solid rgba(167,139,250,0.25)",
          background: "rgba(124,92,255,0.08)",
          color: "#A78BFA",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Ver detalhes por área →
      </button>

      {showDetails && (
        <AreaDetailSheet
          plans={plans}
          agendaItems={agendaItems}
          from={from}
          to={to}
          onClose={() => setShowDetails(false)}
          onToggleTask={toggleTask}
          onToggleAgenda={toggleAgenda}
        />
      )}
    </Section>
  );
}
