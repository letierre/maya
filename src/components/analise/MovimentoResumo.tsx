"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";
import { didExercise } from "@/lib/checkin-answered";
import type { CheckIn } from "@/types";
import { Section, CARD, MUTED, LILAC, Stat } from "./Section";

interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
}

export function MovimentoResumo({
  from,
  to,
  checkIns,
}: {
  from: string;
  to: string;
  checkIns: CheckIn[];
}) {
  const [sessions, setSessions] = useState<RunningSession[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    safeCachedFetch<RunningSession[]>(`/api/running?from=${from}&to=${to}`).then((data) => {
      if (Array.isArray(data)) setSessions(data);
    });
  }, [from, to]);

  const days = checkIns.length;
  const walkedDays = checkIns.filter((c) => c.walked === true).length;
  const ranDays = checkIns.filter((c) => c.ran === true).length;
  const strengthDays = checkIns.filter((c) => c.strength_training === true).length;
  const activeDays = checkIns.filter((c) => didExercise(c)).length;

  const hasRun = sessions.length > 0;
  const hasExercise = activeDays > 0;
  if (!hasRun && !hasExercise) return null;

  const totalKm = sessions.reduce((s, r) => s + (r.distance_meters || 0), 0) / 1000;
  const totalMin = sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60;

  const stats: { value: string | number; label: string; color?: string }[] = [];
  if (hasRun) {
    stats.push({ value: sessions.length, label: t("an_sessoes") });
    stats.push({ value: totalKm >= 10 ? Math.round(totalKm) : Math.round(totalKm * 10) / 10, label: "km" });
    stats.push({ value: Math.round(totalMin), label: "min" });
  }
  if (hasExercise) {
    stats.push({ value: `${activeDays}/${days}`, label: t("an_dias_ativos"), color: LILAC });
  }

  const breakdown = [
    { emoji: "🚶", label: t("an_caminhada"), n: walkedDays },
    { emoji: "🏃", label: t("an_corrida"), n: ranDays },
    { emoji: "🏋️", label: t("an_musculacao"), n: strengthDays },
  ].filter((b) => b.n > 0);

  return (
    <Section title={t("ob_area_movimento")}>
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8 }}>
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} color={s.color} />
          ))}
        </div>
        {breakdown.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {breakdown.map((b) => (
              <span
                key={b.label}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: MUTED,
                  background: "oklch(0.2 0.03 270)",
                  borderRadius: 9999,
                  padding: "4px 10px",
                }}
              >
                {b.emoji} {b.label} · {b.n} {b.n === 1 ? t("an_dia") : t("an_dias")}
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
