"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sumMacros, getDailyKcalGoal } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDateFromISO, getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import { cachedFetch } from "@/lib/fetch-cache";
import { Lightbulb, Apple, Coffee, Moon, Zap } from "lucide-react";
import type { Meal, CheckIn } from "@/types";

interface Tip {
  icon: typeof Lightbulb;
  title: string;
  body: string;
  emoji: string;
}

export function NutritionTips() {
  const { t } = useTranslation();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [ctx, setCtx] = useState<Record<string, unknown>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      cachedFetch<Meal[]>("/api/meals"),
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ context?: Record<string, unknown> }>("/api/preferences"),
    ])
      .then(([mealsData, checkInsData, prefsData]) => {
        if (Array.isArray(mealsData)) setMeals(mealsData);
        if (Array.isArray(checkInsData)) setCheckIns(checkInsData);
        setCtx((prefsData?.context as Record<string, unknown>) || {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const tips = useMemo<Tip[]>(() => {
    const result: Tip[] = [];

    // Semana atual (Seg–Dom)
    const mondayDate = getWeekMondayDate();
    const sundayDate = getWeekSundayDate();
    const recentMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate;
    });
    const analyzed = recentMeals.filter((m) => m.macros && m.status_analise === "analisado");

    if (analyzed.length === 0) return result;

    const total = sumMacros(analyzed);
    const totalG = total.carboidratos_g + total.proteinas_g + total.gorduras_g;
    const protPct = totalG > 0 ? (total.proteinas_g / totalG) * 100 : 0;
    const daysWithMeals = new Set(recentMeals.map((m) => getLocalDateFromISO(m.data_hora))).size;
    const avgKcalPerDay = daysWithMeals > 0 ? Math.round(analyzed.reduce((s, m) => s + (m.macros?.calorias_kcal || 0), 0) / daysWithMeals) : 0;

    const sugarCount = recentMeals.filter((m) => m.classificacao === "alta_acucar").length;
    const fatCount = recentMeals.filter((m) => m.classificacao === "alta_gordura").length;
    const saltCount = recentMeals.filter((m) => m.classificacao === "alta_sal").length;
    const balancedCount = recentMeals.filter((m) => m.classificacao === "equilibrada").length;
    const avgMealsPerDay = daysWithMeals > 0 ? recentMeals.length / daysWithMeals : 0;

    // Check-ins recentes
    const recentCheckIns = checkIns.filter((c) => {
      const diff = (new Date().getTime() - new Date(c.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });

    const tiredDays = recentCheckIns.filter((c) => {
      const feel = (c.feeling || "").toLowerCase();
      return feel.includes("cansad") || feel.includes("cansad") || feel.includes("fatigad") || feel.includes("tired") || feel.includes("sem energia");
    }).length;

    const sleptBadDays = recentCheckIns.filter((c) => !c.slept_well).length;

    // 1. Proteína baixa
    if (protPct < 18 && analyzed.length >= 3) {
      result.push({
        icon: Apple,
        title: t("nu_tip_proteina_titulo"),
        body: t("nu_tip_proteina_body"),
        emoji: "🥚",
      });
    }

    // 2. Açúcar alto
    if (sugarCount >= 3) {
      result.push({
        icon: Lightbulb,
        title: t("nu_tip_acucar_titulo"),
        body: t("nu_tip_acucar_body", { n: String(sugarCount) }),
        emoji: "🍓",
      });
    }

    // 3. Cansado + gordura alta
    if (tiredDays >= 2 && fatCount >= 3) {
      result.push({
        icon: Zap,
        title: t("nu_tip_leves_titulo"),
        body: t("nu_tip_leves_body"),
        emoji: "🥗",
      });
    }

    // 4. Pouca variedade
    const allItems = new Set(recentMeals.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase())));
    if (allItems.size < 6 && recentMeals.length >= 5) {
      result.push({
        icon: Apple,
        title: t("nu_tip_varie_titulo"),
        body: t("nu_tip_varie_body"),
        emoji: "🌈",
      });
    }

    // 5. Dormiu mal + sem café da manhã nutritivo
    const noBreakfast = !recentMeals.some((m) => {
      const hour = new Date(m.data_hora).getHours();
      return hour >= 5 && hour < 11 && m.tipo_refeicao === "cafe_da_manha";
    });

    if (sleptBadDays >= 3) {
      result.push({
        icon: Moon,
        title: t("nu_tip_sono_titulo"),
        body: t("nu_tip_sono_body"),
        emoji: "🍌",
      });
    }

    // 6. Muitas refeições equilibradas — reforço positivo
    if (balancedCount >= 5 && analyzed.length >= 6) {
      result.push({
        icon: Lightbulb,
        title: t("nu_tip_caminho_titulo"),
        body: t("nu_tip_caminho_body"),
        emoji: "🌟",
      });
    }

    // 7. Poucas calorias vs meta
    if (avgKcalPerDay < 1200 && daysWithMeals >= 3) {
      const goal = getDailyKcalGoal(ctx);
      result.push({
        icon: Zap,
        title: t("nu_tip_suficiente_titulo"),
        body: t("nu_tip_suficiente_body", { avg: String(avgKcalPerDay), goal: String(goal) }),
        emoji: "🥜",
      });
    }

    // 8. Alta em sódio
    if (saltCount >= 3) {
      result.push({
        icon: Lightbulb,
        title: t("nu_tip_sodio_titulo"),
        body: t("nu_tip_sodio_body", { n: String(saltCount) }),
        emoji: "🧂",
      });
    }

    // 9. Poucas refeições registradas — pode ser registro incompleto
    if (avgMealsPerDay < 2.5 && daysWithMeals >= 3 && avgKcalPerDay >= 1200) {
      result.push({
        icon: Coffee,
        title: t("nu_tip_registrando_titulo"),
        body: t("nu_tip_registrando_body", { avg: avgMealsPerDay.toFixed(1) }),
        emoji: "📋",
      });
    }

    return result.slice(0, 3);
  }, [meals, checkIns, ctx, t]);

  if (!loaded || tips.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("nu_para_voce")}</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <Card key={i} style={{ borderRadius: 12, background: "linear-gradient(90deg, oklch(.58 .18 270 / .06), transparent)", border: "1px solid oklch(.58 .18 270 / .12)" }}>
            <CardContent className="p-3.5">
              <div className="flex gap-3">
                <span className="text-xl shrink-0">{tip.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium mb-0.5">{tip.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tip.body}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
