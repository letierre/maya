"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sumMacros } from "@/lib/meal-utils";
import { getLocalDateFromISO } from "@/lib/utils";
import { TrendingUp, TrendingDown, Zap, Moon, Smile } from "lucide-react";
import type { Meal, CheckIn } from "@/types";

interface Props {
  meals: Meal[];
}

export function FoodMoodCorrelation({ meals }: Props) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/check-ins")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCheckIns(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const correlations = useMemo(() => {
    if (!loaded || checkIns.length === 0 || meals.length === 0) return null;

    // Agrupar refeições por dia
    const mealsByDay = new Map<string, Meal[]>();
    for (const m of meals) {
      const day = getLocalDateFromISO(m.data_hora);
      const arr = mealsByDay.get(day) || [];
      arr.push(m);
      mealsByDay.set(day, arr);
    }

    // Dias com ambos: check-in + refeição
    const matchedDays: {
      date: string;
      checkIn: CheckIn;
      meals: Meal[];
      macros: ReturnType<typeof sumMacros>;
      kcal: number;
      mealCount: number;
      protPct: number;
    }[] = [];

    for (const ci of checkIns) {
      const dayMeals = mealsByDay.get(ci.date);
      if (!dayMeals || dayMeals.length === 0) continue;
      const analyzed = dayMeals.filter((m) => m.macros && m.status_analise === "analisado");
      if (analyzed.length === 0) continue;
      const macros = sumMacros(analyzed);
      const totalG = macros.carboidratos_g + macros.proteinas_g + macros.gorduras_g;
      const protPct = totalG > 0 ? Math.round((macros.proteinas_g / totalG) * 100) : 0;

      matchedDays.push({
        date: ci.date,
        checkIn: ci,
        meals: dayMeals,
        macros,
        kcal: Math.round(macros.calorias_kcal),
        mealCount: analyzed.length,
        protPct,
      });
    }

    if (matchedDays.length < 3) return null;

    // Análises
    const results: {
      title: string;
      emoji: string;
      icon: typeof Zap;
      body: string;
    }[] = [];

    // 1. Energia alta vs baixa
    const highEnergy = matchedDays.filter((d) => (d.checkIn.energy_level || 0) >= 7);
    const lowEnergy = matchedDays.filter((d) => (d.checkIn.energy_level || 0) <= 4);

    if (highEnergy.length >= 2 && lowEnergy.length >= 2) {
      const highAvgKcal = Math.round(highEnergy.reduce((s, d) => s + d.kcal, 0) / highEnergy.length);
      const lowAvgKcal = Math.round(lowEnergy.reduce((s, d) => s + d.kcal, 0) / lowEnergy.length);
      const highAvgProt = Math.round(highEnergy.reduce((s, d) => s + d.protPct, 0) / highEnergy.length);
      const lowAvgProt = Math.round(lowEnergy.reduce((s, d) => s + d.protPct, 0) / lowEnergy.length);
      const highAvgMeals = (highEnergy.reduce((s, d) => s + d.mealCount, 0) / highEnergy.length).toFixed(1);
      const lowAvgMeals = (lowEnergy.reduce((s, d) => s + d.mealCount, 0) / lowEnergy.length).toFixed(1);

      const lines: string[] = [];
      if (Math.abs(highAvgKcal - lowAvgKcal) > 150) {
        lines.push(`${highAvgKcal} vs ${lowAvgKcal} kcal`);
      }
      if (Math.abs(highAvgProt - lowAvgProt) >= 3) {
        lines.push(`${highAvgProt}% vs ${lowAvgProt}% proteína`);
      }
      if (Math.abs(Number(highAvgMeals) - Number(lowAvgMeals)) >= 0.5) {
        lines.push(`${highAvgMeals} vs ${lowAvgMeals} refeições/dia`);
      }

      if (lines.length > 0) {
        results.push({
          title: "Energia alta vs baixa",
          emoji: "⚡",
          icon: Zap,
          body: `Dias com mais energia têm em média:\n${lines.join("\n")}\n\nIsso é uma correlação observada nos seus dados, não uma regra.`,
        });
      }
    }

    // 2. Sono bom vs ruim
    const goodSleep = matchedDays.filter((d) => d.checkIn.slept_well === true);
    const badSleep = matchedDays.filter((d) => d.checkIn.slept_well === false);

    if (goodSleep.length >= 2 && badSleep.length >= 2) {
      const goodLateMeals = goodSleep.filter((d) => {
        return d.meals.some((m) => {
          const h = new Date(m.data_hora).getHours();
          return h >= 21 && m.tipo_refeicao === "jantar";
        });
      }).length;
      const badLateMeals = badSleep.filter((d) => {
        return d.meals.some((m) => {
          const h = new Date(m.data_hora).getHours();
          return h >= 21 && m.tipo_refeicao === "jantar";
        });
      }).length;

      const goodLatePct = Math.round((goodLateMeals / goodSleep.length) * 100);
      const badLatePct = Math.round((badLateMeals / badSleep.length) * 100);

      if (Math.abs(goodLatePct - badLatePct) >= 20) {
        results.push({
          title: "Sono e horário das refeições",
          emoji: "🌙",
          icon: Moon,
          body: `Jantar após 21h: ${badLatePct}% dos dias com sono ruim vs ${goodLatePct}% dos dias com sono bom.\n\nComer mais cedo pode ajudar na qualidade do sono.`,
        });
      }
    }

    // 3. Dias com mais refeições vs humor
    const manyMeals = matchedDays.filter((d) => d.mealCount >= 4);
    const fewMeals = matchedDays.filter((d) => d.mealCount <= 2);

    if (manyMeals.length >= 2 && fewMeals.length >= 2) {
      const manyAvgEnergy = (manyMeals.reduce((s, d) => s + (d.checkIn.energy_level || 5), 0) / manyMeals.length).toFixed(1);
      const fewAvgEnergy = (fewMeals.reduce((s, d) => s + (d.checkIn.energy_level || 5), 0) / fewMeals.length).toFixed(1);

      if (Math.abs(Number(manyAvgEnergy) - Number(fewAvgEnergy)) >= 0.8) {
        results.push({
          title: "Frequência de refeições e energia",
          emoji: "🍽️",
          icon: Smile,
          body: `Dias com 4+ refeições: energia média ${manyAvgEnergy}/10\nDias com 2- refeições: energia média ${fewAvgEnergy}/10\n\nComer mais vezes ao dia pode estar associado a mais energia nos seus registros.`,
        });
      }
    }

    return results.length > 0 ? results : null;
  }, [meals, checkIns, loaded]);

  if (!correlations || correlations.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">🔗 Conexões entre sua alimentação e bem-estar</p>
      <p className="text-[11px] text-muted-foreground">
        Correlações observadas nos seus registros — não é um diagnóstico.
      </p>
      <div className="space-y-2">
        {correlations.map((c, i) => (
          <Card key={i} style={{ borderRadius: 12, background: "linear-gradient(90deg, oklch(.58 .18 270 / .06), transparent)", border: "1px solid oklch(.58 .18 270 / .12)" }}>
            <CardContent className="p-3.5">
              <div className="flex gap-3">
                <span className="text-xl shrink-0">{c.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium mb-0.5">{c.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
