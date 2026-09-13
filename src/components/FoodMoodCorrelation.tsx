"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sumMacros } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDateFromISO } from "@/lib/utils";
import { TrendingUp, TrendingDown, Zap, Moon, Smile } from "lucide-react";
import type { Meal, CheckIn } from "@/types";

interface Props {
  meals: Meal[];
}

export function FoodMoodCorrelation({ meals }: Props) {
  const { t } = useTranslation();
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
        lines.push(t("nu_kcal_comp", { a: String(highAvgKcal), b: String(lowAvgKcal) }));
      }
      if (Math.abs(highAvgProt - lowAvgProt) >= 3) {
        lines.push(t("nu_prot_comp", { a: String(highAvgProt), b: String(lowAvgProt) }));
      }
      if (Math.abs(Number(highAvgMeals) - Number(lowAvgMeals)) >= 0.5) {
        lines.push(t("nu_refeicoes_comp", { a: highAvgMeals, b: lowAvgMeals }));
      }

      if (lines.length > 0) {
        results.push({
          title: t("nu_energia_titulo"),
          emoji: "⚡",
          icon: Zap,
          body: `${t("nu_energia_intro")}\n${lines.join("\n")}\n\n${t("nu_energia_disclaimer")}`,
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
          title: t("nu_sono_titulo"),
          emoji: "🌙",
          icon: Moon,
          body: t("nu_sono_body", { bad: String(badLatePct), good: String(goodLatePct) }),
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
          title: t("nu_frequencia_titulo"),
          emoji: "🍽️",
          icon: Smile,
          body: t("nu_frequencia_body", { many: manyAvgEnergy, few: fewAvgEnergy }),
        });
      }
    }

    return results.length > 0 ? results : null;
  }, [meals, checkIns, loaded, t]);

  if (!correlations || correlations.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("nu_conexoes")}</p>
      <p className="text-[11px] text-muted-foreground">
        {t("nu_correlacoes")}
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
