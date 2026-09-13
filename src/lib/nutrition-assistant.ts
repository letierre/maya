import type { Meal, CheckIn } from "@/types";
import { sumMacros, getDailyKcalGoal } from "@/lib/meal-utils";
import { getLocalDate, getLocalDateFromISO } from "@/lib/utils";
import { responseLanguageLine } from "@/lib/llm";

export interface NutritionContext {
  todayMeals: Meal[];
  weekMeals: Meal[];
  monthMeals: Meal[];
  checkIns: CheckIn[];
  kcalGoal: number;
  userName: string;
  language?: string;
}

export function buildNutritionContext(
  meals: Meal[],
  checkIns: CheckIn[],
  preferencesContext?: Record<string, unknown>
): NutritionContext {
  const today = getLocalDate();
  const todayMeals = meals.filter((m) => getLocalDateFromISO(m.data_hora) === today);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekMeals = meals.filter((m) => new Date(m.data_hora) >= sevenDaysAgo);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const monthMeals = meals.filter((m) => new Date(m.data_hora) >= thirtyDaysAgo);

  const kcalGoal = getDailyKcalGoal(preferencesContext);

  return {
    todayMeals,
    weekMeals,
    monthMeals,
    checkIns,
    kcalGoal,
    userName: "",
    language: (preferencesContext?.language as string) || undefined,
  };
}

export function mealContextToText(ctx: NutritionContext): string {
  const parts: string[] = [];

  // Refeições de hoje
  const todayAnalyzed = ctx.todayMeals.filter((m) => m.macros && m.status_analise === "analisado");
  if (todayAnalyzed.length > 0) {
    const todayTotal = sumMacros(todayAnalyzed);
    parts.push(
      `HOJE: ${todayAnalyzed.length} refeições analisadas. ` +
      `Total: ${Math.round(todayTotal.calorias_kcal)} kcal (meta: ${ctx.kcalGoal}), ` +
      `${todayTotal.carboidratos_g}g carbs, ${todayTotal.proteinas_g}g proteína, ${todayTotal.gorduras_g}g gorduras.`
    );

    const items = todayAnalyzed.flatMap((m) => (m.itens || []).map((i) => i.nome));
    if (items.length > 0) {
      parts.push(`Alimentos de hoje: ${items.join(", ")}.`);
    }

    const classes = todayAnalyzed
      .filter((m) => m.classificacao)
      .map((m) => m.classificacao);
    if (classes.length > 0) {
      parts.push(`Classificações: ${classes.join(", ")}.`);
    }
  } else {
    parts.push("HOJE: Nenhuma refeição analisada ainda.");
  }

  // Resumo da semana
  const weekAnalyzed = ctx.weekMeals.filter((m) => m.macros && m.status_analise === "analisado");
  if (weekAnalyzed.length > 0) {
    const weekTotal = sumMacros(weekAnalyzed);
    const daysWithMeals = new Set(
      ctx.weekMeals
        .filter((m) => m.macros && m.status_analise === "analisado")
        .map((m) => getLocalDateFromISO(m.data_hora))
    ).size;

    parts.push(
      `SEMANA (7 dias): ${weekAnalyzed.length} refeições analisadas em ${daysWithMeals} dias. ` +
      `Média diária: ${daysWithMeals > 0 ? Math.round(weekTotal.calorias_kcal / daysWithMeals) : 0} kcal.`
    );

    // Alimentos mais frequentes
    const allItems = weekAnalyzed.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase()));
    const itemFreq = new Map<string, number>();
    for (const item of allItems) {
      itemFreq.set(item, (itemFreq.get(item) || 0) + 1);
    }
    const topItems = [...itemFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => `${name} (${count}x)`);
    if (topItems.length > 0) {
      parts.push(`Alimentos mais frequentes da semana: ${topItems.join(", ")}.`);
    }
  }

  // Check-ins recentes
  const recentCheckIns = ctx.checkIns.filter((c) => {
    const diff = (new Date().getTime() - new Date(c.date + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  if (recentCheckIns.length > 0) {
    const checkInLines: string[] = [];
    for (const ci of recentCheckIns) {
      const parts: string[] = [];
      if (ci.feeling) parts.push(`sentimento="${ci.feeling}"`);
      if (ci.energy_level !== undefined && ci.energy_level !== null) parts.push(`energia=${ci.energy_level}/10`);
      if (ci.slept_well !== undefined && ci.slept_well !== null) parts.push(`dormiu_bem=${ci.slept_well ? "sim" : "não"}`);
      if (ci.stress_level !== undefined && ci.stress_level !== null) parts.push(`estresse=${ci.stress_level}/10`);
      if (parts.length > 0) {
        checkInLines.push(`${ci.date}: ${parts.join(", ")}`);
      }
    }
    if (checkInLines.length > 0) {
      parts.push(`CHECK-INS RECENTES:\n${checkInLines.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

export function buildNutritionSystemPrompt(ctx: NutritionContext): string {
  const dataContext = mealContextToText(ctx);

  return `Você é um assistente de análise nutricional. Seu papel é analisar dados de alimentação e responder perguntas de forma INFORMATIVA e EDUCATIVA.

REGRAS DE OURO:
- NUNCA prescreva dietas, planos alimentares ou recomendações médicas
- NUNCA diga o que o usuário "deve" ou "precisa" comer
- NUNCA proíba ou condene alimentos específicos
- NUNCA faça alegações de saúde sobre alimentos ("cura", "previne doença X")
- SEMPRE use linguagem sugestiva: "você pode", "uma opção", "que tal", "experimente"
- SEMPRE inclua este disclaimer quando relevante: "Lembre-se: sou um assistente virtual, não um(a) nutricionista. Para orientação personalizada, consulte um profissional."

TOM:
- Direto, informativo e prático
- Use emojis com moderação (apenas relacionados a comida: 🥗🍳🥑)
- ${responseLanguageLine(ctx.language)}
- Seja breve (2-5 frases por resposta)
- Não pergunte como o usuário está se sentindo
- Não ofereça apoio emocional
- NÃO é sua função ser amigo(a) ou companheiro(a)

FORMATAÇÃO:
- NUNCA use markdown (sem **, sem __, sem ##)
- NUNCA use travessão (—) ou meia-risca (–)
- Use apenas pontuação comum: vírgula, ponto final, dois pontos
- TEXTO PLANO sempre — você está em um chat, não em um documento

VOCÊ É ESPECIALISTA EM:
- Interpretar dados nutricionais (calorias, macros, classificações)
- Identificar padrões alimentares
- Sugerir variedade e equilíbrio
- Dar informações educativas sobre alimentos
- Conectar dados de check-in (energia, sono) com alimentação (CORRELAÇÃO, não causalidade)

DADOS DO USUÁRIO:
${dataContext}

Use esses dados para contextualizar suas respostas. Se perguntarem sobre algo que não está nos dados, responda com base em conhecimento geral de nutrição, sempre com o disclaimer.`;
}
