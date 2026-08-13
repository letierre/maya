"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { nutritionScore, sumMacros, classificationLabel } from "@/lib/meal-utils";
import { getLocalDateFromISO } from "@/lib/utils";
import type { Meal, MealClassification } from "@/types";
import { Section, CARD, MUTED, LILAC, GREEN, RED, Stat } from "./Section";

export function NutricaoResumo({ from, to }: { from: string; to: string }) {
  const [meals, setMeals] = useState<Meal[]>([]);

  useEffect(() => {
    safeCachedFetch<Meal[]>(`/api/meals?from=${from}&to=${to}`).then((data) => {
      if (Array.isArray(data)) setMeals(data);
    });
  }, [from, to]);

  const withMacros = meals.filter((m) => m.macros);
  if (withMacros.length === 0) return null;

  const score = nutritionScore(meals);
  const total = sumMacros(meals);
  const days = new Set(withMacros.map((m) => getLocalDateFromISO(m.data_hora)));
  const avgKcal = days.size > 0 ? Math.round(total.calorias_kcal / days.size) : 0;
  const avgProt = days.size > 0 ? Math.round(total.proteinas_g / days.size) : 0;

  const classCounts: Record<string, number> = {};
  meals.forEach((m) => {
    if (m.classificacao) classCounts[m.classificacao] = (classCounts[m.classificacao] ?? 0) + 1;
  });
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Section title="Nutrição">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Stat
            value={score}
            label="score"
            color={score >= 70 ? GREEN : score >= 45 ? LILAC : RED}
          />
          <Stat value={avgKcal} label="kcal/dia" />
          <Stat value={`${avgProt}g`} label="prot/dia" />
        </div>
        {classEntries.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {classEntries.slice(0, 4).map(([cls, n]) => (
              <span
                key={cls}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: MUTED,
                  background: "oklch(0.2 0.03 270)",
                  borderRadius: 9999,
                  padding: "4px 10px",
                }}
              >
                {classificationLabel(cls as MealClassification)} · {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
