"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { Section, CARD, LILAC, Stat } from "./Section";

interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
}

export function MovimentoResumo({
  from,
  to,
  exercisePct,
}: {
  from: string;
  to: string;
  exercisePct?: number | null;
}) {
  const [sessions, setSessions] = useState<RunningSession[]>([]);

  useEffect(() => {
    safeCachedFetch<RunningSession[]>(`/api/running?from=${from}&to=${to}`).then((data) => {
      if (Array.isArray(data)) setSessions(data);
    });
  }, [from, to]);

  const hasRun = sessions.length > 0;
  const hasExercise = exercisePct != null && exercisePct > 0;
  if (!hasRun && !hasExercise) return null;

  const totalKm = sessions.reduce((s, r) => s + (r.distance_meters || 0), 0) / 1000;
  const totalMin = sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60;

  const stats: { value: string | number; label: string; color?: string }[] = [];
  if (hasRun) {
    stats.push({ value: sessions.length, label: "sessões" });
    stats.push({ value: totalKm >= 10 ? Math.round(totalKm) : Math.round(totalKm * 10) / 10, label: "km" });
    stats.push({ value: Math.round(totalMin), label: "min" });
  }
  if (hasExercise) {
    stats.push({ value: `${Math.round(exercisePct ?? 0)}%`, label: "dias ativos", color: LILAC });
  }

  return (
    <Section title="Movimento">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8 }}>
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} color={s.color} />
          ))}
        </div>
      </div>
    </Section>
  );
}
