import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getLocalDate } from "@/lib/utils";

type Lang = "pt" | "es" | "en";

interface CheckIn {
  id: string;
  date: string;
  energy_level: number | null;
  feeling: string | null;
  gratitude: string | null;
  slept_well: boolean | null;
  positives: string[];
}

interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  mood: number | null;
}

interface Meal {
  id: string;
  data_hora: string;
  descricao: string | null;
  items: string[];
  classificacao: string | null;
  macros: {
    calorias_kcal: number;
    proteinas_g: number;
    carboidratos_g: number;
    gorduras_g: number;
  } | null;
}

interface Memory {
  id: string;
  fact: string;
  created_at: string;
}

interface Porque {
  id: string;
  text: string;
  photo_path: string | null;
}

const MONTHLY_PROMPTS: Record<Lang, (ctx: {
  nameLine: string;
  genderLabel: string;
  streak: number;
  totalCheckIns: number;
  checkInSummary: string;
  diarySummary: string;
  mealSummary: string;
  memoriesBlock: string;
  porquesBlock: string;
}) => string> = {
  pt: (c) => `Você é um observador atento e humilde. Você olha para os dados de uma pessoa e, se algo chamar sua atenção, você comenta com naturalidade. Você NÃO é terapeuta, NÃO é analista, NÃO dá conselhos. Você apenas observa.

## CONTEXTO
${c.nameLine}
Gênero: ${c.genderLabel}
Total de check-ins: ${c.totalCheckIns}

## O QUE OS DADOS MOSTRAM (últimos 30 dias)

### CHECK-INS
${c.checkInSummary}

### DIÁRIO
${c.diarySummary}

### ALIMENTAÇÃO
${c.mealSummary}

${c.memoriesBlock ? `### O QUE EU SEI SOBRE ELA\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### PORQUÊS\n${c.porquesBlock}` : ""}

## SUA TAREFA

Escreva 1-2 parágrafos curtos com observações honestas. Não invente significado onde não há dados. Não force uma narrativa de transformação.

**O MAIS IMPORTANTE:**
- Se os dados forem poucos (menos de 7 check-ins, por exemplo), DIGA ISSO com naturalidade. Algo como: "Ainda é cedo para ver padrões, mas o que já aparece..."
- Se houver lacunas (dias sem registro), não as ignore — elas também contam
- NÃO tente fazer poesia com poucos dados. Simplicidade e honestidade valem mais
- Nunca diga "você está se tornando" ou "você é uma pessoa que..."
- Prefira: "o que os dados sugerem", "o que aparece até agora", "é cedo para dizer mas..."
- Se realmente não houver quase nada, um parágrafo curto e honesto basta

**REGRAS:**
- NUNCA use markdown, travessões ou formatação
- Apenas texto plano
- Tom de conversa — nem poético forçado, nem relatório seco
- Nunca diga "você deveria" ou "é importante que você"
- Nunca diagnostique ou rotule
- Termine com naturalidade, sem pergunta obrigatória`,

  es: (c) => `Eres un observador atento y humilde. Miras los datos de una persona y, si algo te llama la atención, lo comentas con naturalidad. NO eres terapeuta, NO eres analista, NO das consejos. Solo observas.

## CONTEXTO
${c.nameLine}
Género: ${c.genderLabel}
Total de check-ins: ${c.totalCheckIns}

## LO QUE MUESTRAN LOS DATOS (últimos 30 días)

### CHECK-INS
${c.checkInSummary}

### DIARIO
${c.diarySummary}

### ALIMENTACIÓN
${c.mealSummary}

${c.memoriesBlock ? `### LO QUE SÉ SOBRE ELLA\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### PORQUÉS\n${c.porquesBlock}` : ""}

## TU TAREA

Escribe 1-2 párrafos cortos con observaciones honestas. No inventes significado donde no hay datos. No fuerces una narrativa de transformación.

**LO MÁS IMPORTANTE:**
- Si los datos son pocos (menos de 7 check-ins, por ejemplo), DILO con naturalidad. Algo como: "Todavía es pronto para ver patrones, pero lo que ya aparece..."
- Si hay vacíos (días sin registro), no los ignores — también cuentan
- NO intentes hacer poesía con pocos datos. La sencillez y honestidad valen más
- Nunca digas "te estás convirtiendo" o "eres una persona que..."
- Prefiere: "lo que los datos sugieren", "lo que aparece hasta ahora", "es pronto para decir pero..."
- Si realmente no hay casi nada, un párrafo corto y honesto basta

**REGLAS:**
- NUNCA uses markdown, guiones largos ni formateo
- Solo texto plano
- Tono de conversación — ni poético forzado, ni informe seco
- Nunca digas "deberías" o "es importante que"
- Nunca diagnostiques o etiquetes
- Termina con naturalidad, sin pregunta obligatoria`,

  en: (c) => `You are an attentive, humble observer. You look at a person's data and, if something catches your eye, you mention it naturally. You are NOT a therapist, NOT an analyst, you do NOT give advice. You only observe.

## CONTEXT
${c.nameLine}
Gender: ${c.genderLabel}
Total check-ins: ${c.totalCheckIns}

## WHAT THE DATA SHOWS (last 30 days)

### CHECK-INS
${c.checkInSummary}

### JOURNAL
${c.diarySummary}

### NUTRITION
${c.mealSummary}

${c.memoriesBlock ? `### WHAT I KNOW ABOUT THEM\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### WHYS\n${c.porquesBlock}` : ""}

## YOUR TASK

Write 1-2 short paragraphs of honest observations. Don't invent meaning where there's no data. Don't force a transformation narrative.

**MOST IMPORTANT:**
- If data is sparse (fewer than 7 check-ins, for example), SAY SO naturally. Something like: "It's still early to see patterns, but what's already showing up..."
- If there are gaps (days with no entries), don't ignore them — they count too
- DON'T try to make poetry out of thin data. Honesty and simplicity are worth more
- Never say "you are becoming" or "you are a person who..."
- Prefer: "what the data suggests", "what's showing up so far", "it's early to say but..."
- If there's genuinely very little data, one short honest paragraph is enough

**RULES:**
- NEVER use markdown, em dashes, or formatting
- Plain text only
- Conversational tone — not forced poetry, not a dry report
- Never say "you should" or "it's important that you"
- Never diagnose or label
- End naturally, without a forced question`,
};

function buildMonthlyPortraitPrompt(context: {
  name: string;
  gender: string;
  checkIns: CheckIn[];
  diary: DiaryEntry[];
  meals: Meal[];
  memories: Memory[];
  porques: Porque[];
  streak: number;
  totalCheckIns: number;
  lang: Lang;
}): string {
  const { name, gender, checkIns, diary, meals, memories, porques, streak, totalCheckIns, lang } = context;

  const nameLine = name ? `Nome: ${name}` : "";

  const genderLabels: Record<Lang, string> = {
    pt: gender === "masculino" ? "masculino" : gender === "feminino" ? "feminino" : "não informado",
    es: gender === "masculino" ? "masculino" : gender === "feminino" ? "femenino" : "no informado",
    en: gender === "masculino" ? "male" : gender === "feminino" ? "female" : "not informed",
  };
  const genderLabel = genderLabels[lang] || genderLabels.pt;

  const noCheckInLabels: Record<Lang, string> = {
    pt: "sem check-ins no período",
    es: "sin check-ins en el período",
    en: "no check-ins in this period",
  };
  const noDiaryLabels: Record<Lang, string> = {
    pt: "sem diário no período",
    es: "sin diario en el período",
    en: "no journal entries in this period",
  };
  const noMealsLabels: Record<Lang, string> = {
    pt: "sem refeições no período",
    es: "sin comidas en el período",
    en: "no meals in this period",
  };

  const checkInSummary = checkIns.length > 0
    ? checkIns.map(c => {
        const energyStr = c.energy_level !== null ? `energia ${c.energy_level}/10` : "";
        const sleepLabels: Record<Lang, [string, string]> = { pt: ["dormiu bem", "dormiu mal"], es: ["durmió bien", "durmió mal"], en: ["slept well", "slept poorly"] };
        const sl = sleepLabels[lang] || sleepLabels.pt;
        const sleepStr = c.slept_well !== null ? (c.slept_well ? sl[0] : sl[1]) : "";
        const feelStr = c.feeling ? `"${c.feeling.slice(0, 80)}"` : "";
        return `${c.date}: ${[energyStr, sleepStr, feelStr].filter(Boolean).join(" | ")}`;
      }).join("\n")
    : noCheckInLabels[lang];

  const diarySummary = diary.length > 0
    ? diary.map(d => `${d.date}: ${d.content.slice(0, 150)}`).join("\n")
    : noDiaryLabels[lang];

  const mealSummary = meals.length > 0
    ? `${meals.length} refeições registradas. ` +
      meals.filter(m => m.classificacao === "saudavel").length + " saudáveis, " +
      meals.filter(m => m.classificacao === "alta_acucar" || m.classificacao === "alta_gordura").length + " com alerta."
    : noMealsLabels[lang];

  const memoriesBlock = memories.length > 0
    ? memories.map(m => `- ${m.fact}`).join("\n")
    : "";

  const porquesBlock = porques.length > 0
    ? (lang === "pt" ? "Razões que movem esta pessoa:" : lang === "es" ? "Razones que mueven a esta persona:" : "What moves this person:") + "\n" +
      porques.map(p => `- ${p.text}`).join("\n")
    : "";

  const promptFn = MONTHLY_PROMPTS[lang] || MONTHLY_PROMPTS.pt;
  return promptFn({ nameLine, genderLabel, streak, totalCheckIns, checkInSummary, diarySummary, mealSummary, memoriesBlock, porquesBlock });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const lang: Lang = body.lang || "pt";

    const admin = getSupabaseAdmin();

    // Verifica se já existe retrato para o mês atual (cache)
    const currentMonth = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", month: "numeric", year: "numeric" });
    // formato: "5/2026"

    const { data: existingPrefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const existingCtx = (existingPrefs?.context as Record<string, unknown>) || {};

    if (existingCtx.monthly_portrait_month === currentMonth && existingCtx.monthly_portrait) {
      return NextResponse.json({ narrative: existingCtx.monthly_portrait as string, cached: true });
    }

    // Busca todos os dados para gerar novo retrato
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = getLocalDate(thirtyDaysAgo);

    const { data: checkIns } = await admin
      .from("check_ins")
      .select("id, date, energy_level, feeling, gratitude, slept_well, positives")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(31);

    const recentCheckIns = (checkIns || []).filter((c: CheckIn) => c.date >= cutoff);

    const { data: diary } = await admin
      .from("diary_entries")
      .select("id, date, content, mood")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(15);

    const recentDiary = (diary || []).filter((d: DiaryEntry) => d.date >= cutoff);

    const { data: meals } = await admin
      .from("meals")
      .select("id, data_hora, descricao, items, classificacao, macros")
      .eq("user_id", user.id)
      .gte("data_hora", thirtyDaysAgo.toISOString())
      .order("data_hora", { ascending: false });

    const name = (existingCtx.name as string) || "";
    const gender = (existingCtx.gender as string) || "nao_dizer";

    const { data: memories } = await admin
      .from("user_memories")
      .select("id, fact, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Porques vêm do context, não de uma tabela separada
    const porques = (existingCtx.porques as Array<{ id: string; text: string; photoPath: string | null }>) || [];

    const { data: allCheckIns } = await admin
      .from("check_ins")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const dates = (allCheckIns || []).map((c: { date: string }) => c.date);
    let streak = 0;
    const today = getLocalDate();
    const checkDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    for (let i = 0; i < dates.length; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (dates.includes(checkDate(d))) streak++;
      else break;
    }

    // Se não tem dados suficientes, não gera retrato
    if (recentCheckIns.length === 0 && (meals || []).length === 0 && recentDiary.length === 0) {
      return NextResponse.json({ narrative: null });
    }

    const systemPrompt = buildMonthlyPortraitPrompt({
      name,
      gender,
      checkIns: recentCheckIns,
      diary: recentDiary,
      meals: meals || [],
      memories: memories || [],
      porques,
      streak,
      totalCheckIns: dates.length,
      lang,
    });

    const userMessage = lang === "pt" ? "Compartilhe suas observações honestas." : lang === "es" ? "Comparte tus observaciones honestas." : "Share your honest observations.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Monthly portrait AI error:", errText);
      return NextResponse.json({ narrative: null });
    }

    const aiData = await response.json();
    const text = aiData?.content?.[0]?.text?.trim() || "";

    if (text) {
      // Salva no context para cache mensal
      const updatedCtx = { ...existingCtx, monthly_portrait: text, monthly_portrait_month: currentMonth };
      await admin
        .from("user_preferences")
        .update({ context: updatedCtx })
        .eq("user_id", user.id);
    }

    return NextResponse.json({ narrative: text || null });

  } catch (error) {
    console.error("Monthly portrait error:", error);
    return NextResponse.json({ narrative: null });
  }
}
