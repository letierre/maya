import type { Meal, MealType, MealClassification, Macros, MealItem } from "@/types";

// Meta diária padrão de calorias (personalizável via preferences.context.kcal_goal)
export const DEFAULT_DAILY_KCAL = 2000;

export function getDailyKcalGoal(context?: Record<string, unknown>): number {
  if (context) {
    const goal = context.nutrition_goal as { objective?: string; kcal?: number } | undefined;
    if (goal?.kcal && typeof goal.kcal === "number") return goal.kcal;
  }
  return DEFAULT_DAILY_KCAL;
}

// Mapeamento horário → tipo de refeição
export function getMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour < 9) return "cafe_da_manha";
  if (hour >= 9 && hour < 11) return "lanche_manha";
  if (hour >= 11 && hour < 14) return "almoco";
  if (hour >= 14 && hour < 17) return "lanche";
  if (hour >= 17 && hour < 21) return "jantar";
  return "lanche_noturno";
}

// Label legível para cada tipo
export function mealTypeLabel(type: MealType): string {
  const map: Record<MealType, string> = {
    cafe_da_manha: "Café da manhã",
    lanche_manha: "Lanche da manhã",
    almoco: "Almoço",
    lanche: "Lanche",
    jantar: "Jantar",
    lanche_noturno: "Lanche noturno",
  };
  return map[type];
}

// Emoji para cada tipo
export function mealTypeEmoji(type: MealType): string {
  const map: Record<MealType, string> = {
    cafe_da_manha: "🌅",
    lanche_manha: "🥐",
    almoco: "☀️",
    lanche: "🍪",
    jantar: "🌙",
    lanche_noturno: "🌃",
  };
  return map[type];
}

// Label para classificação
export function classificationLabel(c: MealClassification): string {
  const map: Record<MealClassification, string> = {
    equilibrada: "Equilibrada",
    leve_proteina: "Leve em proteína",
    alta_acucar: "Alta em açúcar",
    alta_gordura: "Alta em gordura",
    alta_sal: "Alta em sódio",
    vegetais_baixo: "Vegetais / Baixa caloria",
    nao_identificada: "Não identificada",
  };
  return map[c];
}

// Cor da badge para classificação
export function classificationColor(c: MealClassification): string {
  const map: Record<MealClassification, string> = {
    equilibrada: "bg-green-100 text-green-800",
    leve_proteina: "bg-yellow-100 text-yellow-800",
    alta_acucar: "bg-red-100 text-red-800",
    alta_gordura: "bg-orange-100 text-orange-800",
    alta_sal: "bg-purple-100 text-purple-800",
    vegetais_baixo: "bg-blue-100 text-blue-800",
    nao_identificada: "bg-gray-100 text-gray-600",
  };
  return map[c];
}

// Soma macros de várias refeições
export function sumMacros(meals: { macros: Macros | null }[]): Macros {
  return meals.reduce(
    (acc, m) => {
      if (!m.macros) return acc;
      return {
        carboidratos_g: acc.carboidratos_g + m.macros.carboidratos_g,
        proteinas_g: acc.proteinas_g + m.macros.proteinas_g,
        gorduras_g: acc.gorduras_g + m.macros.gorduras_g,
        calorias_kcal: acc.calorias_kcal + m.macros.calorias_kcal,
      };
    },
    { carboidratos_g: 0, proteinas_g: 0, gorduras_g: 0, calorias_kcal: 0 }
  );
}

// Qualidade geral do dia baseado nos macros
export function dailyQuality(
  meals: { macros: Macros | null; classificacao: MealClassification | null }[]
): "bom" | "atencao" | "sem_dados" {
  const comMacros = meals.filter((m) => m.macros);
  if (comMacros.length === 0) return "sem_dados";

  const total = sumMacros(comMacros);
  const totalG = total.carboidratos_g + total.proteinas_g + total.gorduras_g;
  if (totalG === 0) return "sem_dados";

  const carbPct = (total.carboidratos_g / totalG) * 100;
  const protPct = (total.proteinas_g / totalG) * 100;
  const gordPct = (total.gorduras_g / totalG) * 100;

  // Faixas saudáveis aproximadas: 45-65% carb, 15-25% prot, 20-35% gord
  const carbOk = carbPct >= 40 && carbPct <= 65;
  const protOk = protPct >= 15 && protPct <= 30;
  const gordOk = gordPct >= 15 && gordPct <= 35;

  // Pelo menos 2 das 3 faixas ok
  const okCount = [carbOk, protOk, gordOk].filter(Boolean).length;
  return okCount >= 2 ? "bom" : "atencao";
}

// Hash simples para cache de análise (string → número)
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Score de nutrição 0-100: balanço de macros (40pts) + frequência (30pts) + qualidade (30pts)
export function nutritionScore(meals: { macros: Macros | null; classificacao: MealClassification | null }[]): number {
  const comMacros = meals.filter((m) => m.macros);
  if (comMacros.length === 0) return 0;

  const total = sumMacros(comMacros);
  const totalG = total.carboidratos_g + total.proteinas_g + total.gorduras_g;

  // 1. Balanço de macros (40 pontos)
  let macroScore = 0;
  if (totalG > 0) {
    const carbPct = (total.carboidratos_g / totalG) * 100;
    const protPct = (total.proteinas_g / totalG) * 100;
    const gordPct = (total.gorduras_g / totalG) * 100;
    const carbOk = carbPct >= 45 && carbPct <= 60 ? 15 : carbPct >= 35 && carbPct <= 70 ? 10 : 3;
    const protOk = protPct >= 15 && protPct <= 25 ? 15 : protPct >= 10 && protPct <= 35 ? 10 : 3;
    const gordOk = gordPct >= 20 && gordPct <= 30 ? 10 : gordPct >= 10 && gordPct <= 40 ? 6 : 2;
    macroScore = carbOk + protOk + gordOk;
  }

  // 2. Frequência de refeições (30 pontos)
  const freqScore = comMacros.length >= 4 ? 30 : comMacros.length >= 3 ? 25 : comMacros.length >= 2 ? 18 : 8;

  // 3. Qualidade das refeições (30 pontos)
  const classScores: Record<string, number> = {
    equilibrada: 10,
    vegetais_baixo: 8,
    leve_proteina: 5,
    nao_identificada: 5,
    alta_gordura: 2,
    alta_sal: 2,
    alta_acucar: 1,
  };
  const qualityTotal = meals
    .filter((m) => m.classificacao)
    .reduce((acc, m) => acc + (classScores[m.classificacao!] || 5), 0);
  const maxQuality = Math.max(meals.filter((m) => m.classificacao).length * 10, 10);
  const qualityScore = Math.min((qualityTotal / maxQuality) * 30, 30);

  return Math.min(Math.round(macroScore + freqScore + qualityScore), 100);
}

// Determina se "comeu bem" baseado nas refeições do dia
export function ateWellFromMeals(meals: Meal[]): boolean {
  const comMacros = meals.filter((m) => m.macros && m.status_analise === "analisado");
  if (comMacros.length === 0) return false;

  const total = sumMacros(comMacros);

  // Pelo menos 2 refeições e calorias dentro de faixa razoável (800-3500)
  if (comMacros.length < 2) return false;
  if (total.calorias_kcal < 800 || total.calorias_kcal > 3500) return false;

  const quality = dailyQuality(comMacros);
  return quality === "bom";
}
