import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { sumMacros, nutritionScore, mealTypeLabel, mealTypeEmoji } from "@/lib/meal-utils";
import { getLocalDateFromISO, getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChefHat, Salad, Apple, Fish, Wheat } from "lucide-react";
import type { Meal, MealType } from "@/types";

interface WeekDay {
  date: string;
  label: string;
  meals: Meal[];
  kcal: number;
  score: number;
}

const NUTRIENT_SOURCES: { nutrient: string; emoji: string; keywords: string[] }[] = [
  { nutrient: "Ferro", emoji: "🩸", keywords: ["feijão", "lentilha", "carne", "bovina", "figado", "beterraba", "espinafre", "grao", "grão de bico", "castanha"] },
  { nutrient: "Cálcio", emoji: "🦴", keywords: ["leite", "queijo", "iogurte", "coalhada", "requeijão", "brócolis", "couve", "gergelim", "amêndoa", "tofu"] },
  { nutrient: "Vitamina C", emoji: "🍊", keywords: ["laranja", "limão", "acerola", "kiwi", "morango", "manga", "abacaxi", "tomate", "pimentão", "brócolis"] },
  { nutrient: "Fibras", emoji: "🌾", keywords: ["aveia", "chia", "linhaça", "granola", "cereal", "integral", "farelo", "ameixa", "mamão", "legume"] },
  { nutrient: "Ômega 3", emoji: "🐟", keywords: ["salmão", "sardinha", "atum", "bacalhau", "tilápia", "truta", "nozes", "linhaça", "chia"] },
  { nutrient: "Magnésio", emoji: "🔋", keywords: ["banana", "castanha", "amêndoa", "abacate", "espinafre", "cacau", "aveia", "feijão", "semente", "abóbora"] },
];

export function WeeklyReport({ meals, weekDays }: { meals: Meal[]; weekDays: WeekDay[] }) {
  const mondayDate = getWeekMondayDate();
  const sundayDate = getWeekSundayDate();

  // Semana atual vs anterior (seg-dom vs seg-dom anterior)
  const { thisWeekAvg, lastWeekAvg, trend, trendPct } = useMemo(() => {
    const prevMonday = new Date(mondayDate + "T12:00:00");
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevMondayStr = prevMonday.toISOString().slice(0, 10);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    const prevSundayStr = prevSunday.toISOString().slice(0, 10);

    const thisWeekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.macros;
    });
    const lastWeekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= prevMondayStr && d <= prevSundayStr && m.macros;
    });

    const thisDays = new Set(thisWeekMeals.map((m) => getLocalDateFromISO(m.data_hora))).size;
    const lastDays = new Set(lastWeekMeals.map((m) => getLocalDateFromISO(m.data_hora))).size;
    const avg1 = thisDays > 0 ? Math.round(sumMacros(thisWeekMeals as { macros: NonNullable<Meal["macros"]> }[]).calorias_kcal / thisDays) : 0;
    const avg2 = lastDays > 0 ? Math.round(sumMacros(lastWeekMeals as { macros: NonNullable<Meal["macros"]> }[]).calorias_kcal / lastDays) : 0;

    let t: "up" | "down" | "flat" = "flat";
    let pct = 0;
    if (avg1 > 0 && avg2 > 0) {
      pct = Math.round(((avg1 - avg2) / avg2) * 100);
      t = pct > 5 ? "up" : pct < -5 ? "down" : "flat";
    }
    return { thisWeekAvg: avg1, lastWeekAvg: avg2, trend: t, trendPct: Math.abs(pct) };
  }, [meals, mondayDate, sundayDate]);

  // Distribuição por tipo de refeição — semana atual (Seg-Dom)
  const mealTypeDist = useMemo(() => {
    const map = new Map<MealType, { kcal: number; count: number }>();
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate;
    });
    for (const m of weekMeals) {
      if (!m.macros) continue;
      const entry = map.get(m.tipo_refeicao) || { kcal: 0, count: 0 };
      entry.kcal += m.macros.calorias_kcal;
      entry.count += 1;
      map.set(m.tipo_refeicao, entry);
    }
    const totalKcal = [...map.values()].reduce((s, e) => s + e.kcal, 0);
    return [...map.entries()]
      .map(([tipo, data]) => ({
        tipo,
        emoji: mealTypeEmoji(tipo),
        label: mealTypeLabel(tipo),
        kcal: data.kcal,
        count: data.count,
        pct: totalKcal > 0 ? Math.round((data.kcal / totalKcal) * 100) : 0,
      }))
      .sort((a, b) => b.kcal - a.kcal);
  }, [meals, mondayDate, sundayDate]);

  // Itens mais frequentes — semana atual
  const topItems = useMemo(() => {
    const itemMap = new Map<string, number>();
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.itens;
    });
    for (const m of weekMeals) {
      for (const item of m.itens || []) {
        const name = item.nome.toLowerCase().trim();
        if (name.length < 2) continue;
        itemMap.set(name, (itemMap.get(name) || 0) + 1);
      }
    }
    return [...itemMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [meals, mondayDate, sundayDate]);

  // Melhor e pior dia
  const { bestDay, worstDay } = useMemo(() => {
    let best: WeekDay | null = null;
    let worst: WeekDay | null = null;
    for (const day of weekDays) {
      const analyzed = day.meals.filter((m) => m.macros && m.status_analise === "analisado");
      if (analyzed.length === 0) continue;
      const score = nutritionScore(analyzed);
      if (!best || score > nutritionScore(best.meals.filter((m) => m.macros && m.status_analise === "analisado"))) best = { ...day, score };
      if (!worst || score < nutritionScore(worst.meals.filter((m) => m.macros && m.status_analise === "analisado"))) worst = { ...day, score };
    }
    return { bestDay: best, worstDay: worst };
  }, [weekDays]);

  // Possíveis lacunas de micronutrientes
  const { nutrientGaps, analyzedCount, sparseData } = useMemo(() => {
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.status_analise === "analisado";
    });
    const allItems = weekMeals.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase().trim()));
    const gaps = NUTRIENT_SOURCES.filter(
      (src) => !allItems.some((item) => src.keywords.some((kw) => item.includes(kw)))
    );
    return {
      nutrientGaps: gaps,
      analyzedCount: weekMeals.length,
      sparseData: weekMeals.length < 5,
    };
  }, [meals, mondayDate, sundayDate]);

  const hasWeekData = weekDays.some((d) => d.kcal > 0);
  if (!hasWeekData) return null;

  return (
    <div className="space-y-3">
      {/* Tendência semanal */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">📊 Comparação semanal</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground">Esta semana</p>
              <p className="text-xl font-bold tabular-nums">{thisWeekAvg || "–"}</p>
              <p className="text-xs text-muted-foreground">kcal/dia</p>
            </div>
            <div className="flex flex-col items-center px-4">
              {trend === "up" ? (
                <TrendingUp className="size-5 text-amber-500" />
              ) : trend === "down" ? (
                <TrendingDown className="size-5 text-emerald-500" />
              ) : (
                <Minus className="size-5 text-muted-foreground" />
              )}
              {trendPct > 0 && (
                <span className={`text-xs font-medium mt-0.5 ${trend === "up" ? "text-amber-500" : "text-emerald-500"}`}>
                  {trendPct}%
                </span>
              )}
            </div>
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground">Semana passada</p>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">{lastWeekAvg || "–"}</p>
              <p className="text-xs text-muted-foreground">kcal/dia</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Melhor / Pior dia */}
      {(bestDay || worstDay) && bestDay?.date !== worstDay?.date && (
        <div className="grid grid-cols-2 gap-2">
          {bestDay && (
            <Card className="rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">🌟 Melhor dia</p>
                <p className="text-sm font-medium">{new Date(bestDay.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}</p>
                <p className="text-lg font-bold text-emerald-600">{bestDay.score}</p>
              </CardContent>
            </Card>
          )}
          {worstDay && (
            <Card className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border-amber-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">💡 A melhorar</p>
                <p className="text-sm font-medium">{new Date(worstDay.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" })}</p>
                <p className="text-lg font-bold text-amber-600">{worstDay.score}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Distribuição por tipo de refeição */}
      {mealTypeDist.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">🍽️ Distribuição por refeição</p>
            {mealTypeDist.map((d) => (
              <div key={d.tipo} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{d.emoji} {d.label}</span>
                  <span className="text-muted-foreground text-xs">{d.kcal} kcal · {d.pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${Math.max(d.pct, 4)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Itens mais frequentes */}
      {topItems.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">🔁 O que mais apareceu</p>
            <div className="flex flex-wrap gap-1.5">
              {topItems.map(([nome, count]) => (
                <span key={nome} className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                  {nome} <span className="font-medium text-foreground">{count}x</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Possíveis lacunas */}
      {nutrientGaps.length > 0 && (
        <Card className="rounded-2xl border-amber-200/50 dark:border-amber-800/30 bg-amber-50/20 dark:bg-amber-950/10">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">🔍 Possíveis lacunas</p>
            {sparseData && (
              <p className="text-xs text-amber-700 bg-amber-100/60 rounded-lg px-3 py-2">
                Você registrou apenas {analyzedCount} {analyzedCount === 1 ? "refeição" : "refeições"} com análise esta semana. As lacunas abaixo provavelmente subestimam a realidade.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {sparseData
                ? "Com os dados disponíveis, estes nutrientes provavelmente estão em falta:"
                : "Baseado nos alimentos registrados esta semana, estes nutrientes podem estar em falta:"}
            </p>
            <div className="space-y-2">
              {nutrientGaps.map((gap) => (
                <div key={gap.nutrient} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{gap.emoji}</span>
                  <span className="font-medium">{gap.nutrient}</span>
                  <span className="text-xs text-muted-foreground">— sem fontes claras na semana</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Análise baseada nos alimentos registrados. Pode não refletir sua ingestão real completa.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
