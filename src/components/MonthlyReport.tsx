"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sumMacros, classificationLabel, classificationColor } from "@/lib/meal-utils";
import { getLocalDateFromISO } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ChefHat, Salad, Apple, Fish, Wheat } from "lucide-react";
import type { Meal } from "@/types";

// Mapeamento de alimentos → nutrientes prováveis (regras simples)
const NUTRIENT_SOURCES: { nutrient: string; emoji: string; keywords: string[]; icon: typeof ChefHat }[] = [
  { nutrient: "Ferro", emoji: "🩸", keywords: ["feijão", "lentilha", "carne", "bovina", "figado", "beterraba", "espinafre", "grao", "grão de bico", "castanha"], icon: ChefHat },
  { nutrient: "Cálcio", emoji: "🦴", keywords: ["leite", "queijo", "iogurte", "coalhada", "requeijão", "brócolis", "couve", "gergelim", "amêndoa", "tofu"], icon: ChefHat },
  { nutrient: "Vitamina C", emoji: "🍊", keywords: ["laranja", "limão", "acerola", "kiwi", "morango", "manga", "abacaxi", "tomate", "pimentão", "brócolis"], icon: Salad },
  { nutrient: "Fibras", emoji: "🌾", keywords: ["aveia", "chia", "linhaça", "granola", "cereal", "integral", "farelo", "ameixa", "mamão", "legume"], icon: Wheat },
  { nutrient: "Ômega 3", emoji: "🐟", keywords: ["salmão", "sardinha", "atum", "bacalhau", "tilápia", "truta", "nozes", "linhaça", "chia"], icon: Fish },
  { nutrient: "Magnésio", emoji: "🔋", keywords: ["banana", "castanha", "amêndoa", "abacate", "espinafre", "cacau", "aveia", "feijão", "semente", "abóbora"], icon: Apple },
];

interface MonthData {
  total: number;
  avgKcal: number;
  classCount: Map<string, number>;
}

export function MonthlyReport({ meals, monthStats }: { meals: Meal[]; monthStats: MonthData }) {
  const analysis = useMemo(() => {
    const analyzed = meals.filter((m) => m.macros && m.status_analise === "analisado");

    // Variedade: itens únicos
    const allItems = analyzed.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase().trim()));
    const uniqueItems = new Set(allItems);
    const varietyScore = uniqueItems.size >= 20 ? "Excelente" : uniqueItems.size >= 12 ? "Boa" : uniqueItems.size >= 6 ? "Regular" : "Baixa";
    const varietyColor = uniqueItems.size >= 20 ? "text-emerald-600" : uniqueItems.size >= 12 ? "text-amber-600" : "text-red-600";

    // Top itens
    const itemFreq = new Map<string, number>();
    for (const item of allItems) {
      itemFreq.set(item, (itemFreq.get(item) || 0) + 1);
    }
    const topItems = [...itemFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Distribuição por tipo de refeição
    const byType = new Map<string, { kcal: number; count: number }>();
    for (const m of analyzed) {
      const entry = byType.get(m.tipo_refeicao) || { kcal: 0, count: 0 };
      entry.kcal += m.macros?.calorias_kcal || 0;
      entry.count++;
      byType.set(m.tipo_refeicao, entry);
    }

    // Lacunas de micronutrientes
    const nutrientGaps: { nutrient: string; emoji: string; icon: typeof ChefHat }[] = [];
    for (const source of NUTRIENT_SOURCES) {
      const found = allItems.some((item) =>
        source.keywords.some((kw) => item.includes(kw))
      );
      if (!found) {
        nutrientGaps.push(source);
      }
    }

    // Tendência semanal dentro do mês
    const weeklyKcal: { label: string; kcal: number; count: number }[] = [];
    const now = new Date();
    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), w * 7 + 1);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), (w + 1) * 7);
      const weekMeals = analyzed.filter((m) => {
        const d = new Date(m.data_hora);
        return d >= weekStart && d <= weekEnd;
      });
      const total = sumMacros(weekMeals);
      weeklyKcal.push({
        label: `Sem ${w + 1}`,
        kcal: weekMeals.length > 0 ? Math.round(total.calorias_kcal / Math.max(weekMeals.length, 1)) : 0,
        count: weekMeals.length,
      });
    }

    // Tendência (comparando primeira vs última semana com dados)
    const weeksWithData = weeklyKcal.filter((w) => w.count > 0);
    let trend: "up" | "down" | "stable" = "stable";
    if (weeksWithData.length >= 2) {
      const first = weeksWithData[0].kcal;
      const last = weeksWithData[weeksWithData.length - 1].kcal;
      if (last > first * 1.1) trend = "up";
      else if (last < first * 0.9) trend = "down";
    }

    return {
      uniqueItems,
      varietyScore,
      varietyColor,
      topItems,
      byType,
      nutrientGaps,
      weeklyKcal,
      trend,
    };
  }, [meals]);

  if (monthStats.total === 0) return null;

  return (
    <div className="space-y-3">
      {/* Variedade alimentar */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">🥗 Variedade alimentar</p>
            <span className={`text-sm font-bold ${analysis.varietyColor}`}>
              {analysis.varietyScore}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-2xl font-bold">{analysis.uniqueItems.size}</span>
            <span className="text-muted-foreground text-xs">
              {analysis.uniqueItems.size === 1 ? "alimento diferente" : "alimentos diferentes"} no mês
            </span>
          </div>
          {analysis.uniqueItems.size < 12 && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              Quanto mais variada a alimentação, mais nutrientes diferentes seu corpo recebe. Tente incluir algo novo essa semana.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tendência de kcal por semana */}
      {analysis.weeklyKcal.some((w) => w.count > 0) && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">📈 Média kcal por semana</span>
              {analysis.trend === "up" && <TrendingUp className="size-4 text-amber-500" />}
              {analysis.trend === "down" && <TrendingDown className="size-4 text-emerald-500" />}
              {analysis.trend === "stable" && <Minus className="size-4 text-muted-foreground" />}
            </div>
            <div className="flex items-end gap-1 h-20">
              {analysis.weeklyKcal.map((w) => {
                const maxKcal = Math.max(...analysis.weeklyKcal.map((x) => x.kcal), 1);
                const height = (w.kcal / maxKcal) * 100;
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium tabular-nums">
                      {w.kcal > 0 ? w.kcal : "-"}
                    </span>
                    <div
                      className="w-full bg-emerald-200 dark:bg-emerald-800 rounded-t-md transition-all"
                      style={{ height: `${Math.max(height, 4)}%`, opacity: w.count > 0 ? 1 : 0.3 }}
                    />
                    <span className="text-[10px] text-muted-foreground">{w.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top alimentos */}
      {analysis.topItems.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">⭐ Mais consumidos</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.topItems.map(([name, count]) => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted/60 rounded-full text-xs">
                  {name}
                  <span className="text-[10px] text-muted-foreground">{count}x</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lacunas de micronutrientes */}
      {analysis.nutrientGaps.length > 0 && (
        <Card className="rounded-2xl border-amber-200/50 dark:border-amber-800/30 bg-amber-50/20 dark:bg-amber-950/10">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">🔍 Possíveis lacunas</p>
            {monthStats.total < 15 && (
              <p className="text-xs text-amber-700 bg-amber-100/60 rounded-lg px-3 py-2">
                Você registrou apenas {monthStats.total} {monthStats.total === 1 ? "refeição" : "refeições"} com análise este mês. As lacunas abaixo provavelmente subestimam a realidade.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {monthStats.total < 15
                ? "Com os dados disponíveis, estes nutrientes provavelmente estão em falta:"
                : "Baseado nos alimentos registrados, estes nutrientes podem estar em falta:"}
            </p>
            <div className="space-y-2">
              {analysis.nutrientGaps.map((gap) => (
                <div key={gap.nutrient} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{gap.emoji}</span>
                  <span className="font-medium">{gap.nutrient}</span>
                  <span className="text-xs text-muted-foreground">
                    — sem fontes claras no mês
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Análise baseada nos alimentos registrados. Pode não refletir sua ingestão real completa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Distribuição por tipo */}
      {analysis.byType.size > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">🍽️ Distribuição por refeição</p>
            <div className="space-y-2">
              {[...analysis.byType.entries()]
                .sort((a, b) => b[1].kcal - a[1].kcal)
                .map(([type, data]) => {
                  const typeLabels: Record<string, string> = {
                    cafe_da_manha: "Café da manhã",
                    almoco: "Almoço",
                    lanche: "Lanche",
                    jantar: "Jantar",
                    lanche_noturno: "Lanche noturno",
                  };
                  const typeEmojis: Record<string, string> = {
                    cafe_da_manha: "🌅",
                    almoco: "☀️",
                    lanche: "🍪",
                    jantar: "🌙",
                    lanche_noturno: "🌃",
                  };
                  return (
                    <div key={type} className="flex items-center gap-2 text-sm">
                      <span>{typeEmojis[type] || "🍽️"}</span>
                      <span className="flex-1">{typeLabels[type] || type}</span>
                      <span className="text-muted-foreground text-xs">{data.count}x</span>
                      <span className="font-medium tabular-nums w-16 text-right">{Math.round(data.kcal)} kcal</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
