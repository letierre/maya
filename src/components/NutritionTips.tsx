"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sumMacros, getDailyKcalGoal } from "@/lib/meal-utils";
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
        title: "Experimente mais proteína",
        body: "Sua proteína está abaixo do ideal. Adicione ovos, frango, peixe, lentilha ou grão-de-bico nas refeições. A proteína ajuda na saciedade e na energia.",
        emoji: "🥚",
      });
    }

    // 2. Açúcar alto
    if (sugarCount >= 3) {
      result.push({
        icon: Lightbulb,
        title: "Menos açúcar, mais energia",
        body: `Você teve ${sugarCount} refeições com açúcar alto nos últimos dias. Troque por frutas frescas, iogurte natural ou castanhas — dão energia sem o pico de glicose.`,
        emoji: "🍓",
      });
    }

    // 3. Cansado + gordura alta
    if (tiredDays >= 2 && fatCount >= 3) {
      result.push({
        icon: Zap,
        title: "Refeições mais leves podem ajudar",
        body: "Você tem se sentido cansado(a) e as refeições estão pesadas. Tente incluir mais vegetais, grelhados e saladas — digestão mais leve, mais disposição.",
        emoji: "🥗",
      });
    }

    // 4. Pouca variedade
    const allItems = new Set(recentMeals.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase())));
    if (allItems.size < 6 && recentMeals.length >= 5) {
      result.push({
        icon: Apple,
        title: "Varie seu cardápio",
        body: "Você tem comido poucos alimentos diferentes. Quanto mais variada a alimentação, mais nutrientes diferentes seu corpo recebe. Que tal experimentar algo novo hoje?",
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
        title: "Sono e alimentação andam juntos",
        body: "Você teve noites difíceis. Evite cafeína após as 16h e tente jantar mais cedo. Alimentos ricos em magnésio (banana, castanhas, aveia) ajudam a relaxar.",
        emoji: "🍌",
      });
    }

    // 6. Muitas refeições equilibradas — reforço positivo
    if (balancedCount >= 5 && analyzed.length >= 6) {
      result.push({
        icon: Lightbulb,
        title: "Você está no caminho certo!",
        body: `A maioria das suas refeições está equilibrada. Continue assim — seu corpo agradece. Pequenas consistências criam grandes mudanças.`,
        emoji: "🌟",
      });
    }

    // 7. Poucas calorias vs meta
    if (avgKcalPerDay < 1200 && daysWithMeals >= 3) {
      const goal = getDailyKcalGoal(ctx);
      result.push({
        icon: Zap,
        title: "Tá comendo o suficiente?",
        body: `Sua média diária está em ${avgKcalPerDay} kcal (meta: ${goal}). Comer pouco pode deixar o metabolismo lento e causar cansaço. Inclua snacks saudáveis entre as refeições.`,
        emoji: "🥜",
      });
    }

    // 8. Alta em sódio
    if (saltCount >= 3) {
      result.push({
        icon: Lightbulb,
        title: "Atenção ao sódio",
        body: `Você teve ${saltCount} refeições com alto teor de sal nos últimos dias. O excesso de sódio pode causar retenção de líquido e pressão elevada. Prefira temperos naturais e alimentos frescos.`,
        emoji: "🧂",
      });
    }

    // 9. Poucas refeições registradas — pode ser registro incompleto
    if (avgMealsPerDay < 2.5 && daysWithMeals >= 3 && avgKcalPerDay >= 1200) {
      result.push({
        icon: Coffee,
        title: "Registrando todas as refeições?",
        body: `Você tem registrado em média ${avgMealsPerDay.toFixed(1)} refeições por dia. Se comer mais do que isso, vale anotar tudo — a análise de qualidade fica mais precisa quando os dados estão completos.`,
        emoji: "📋",
      });
    }

    return result.slice(0, 3);
  }, [meals, checkIns, ctx]);

  if (!loaded || tips.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">💡 Para você</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <Card key={i} className="rounded-xl bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/10 border-amber-200/50 dark:border-amber-800/30">
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
