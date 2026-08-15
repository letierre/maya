"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { LifeWheel } from "@/components/planejamento/LifeWheel";
import { Section } from "./Section";

// As 8 áreas que a Roda da Vida exibe (sem "outros")
const AREA_KEYS = [
  "espiritualidade", "carreira", "desenvolvimento", "familia",
  "relacionamentos", "financas", "lazer", "saude",
];

interface RawTask { area: string; status: string; }
interface RawPlan { week_start: string; weekly_tasks?: RawTask[]; }
interface WeeklyPlansResp { plans: RawPlan[]; }
interface RawAgendaItem { area: string | null; status: string; }

/** Roda da Vida agregando as tarefas de TODAS as semanas do período selecionado. */
export function AreaBalance({ from, to }: { from: string; to: string }) {
  const [plans, setPlans] = useState<RawPlan[]>([]);
  const [agendaItems, setAgendaItems] = useState<RawAgendaItem[]>([]);

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

  return (
    <Section title="Equilíbrio de áreas">
      <LifeWheel done={done} totals={totals} />
    </Section>
  );
}
