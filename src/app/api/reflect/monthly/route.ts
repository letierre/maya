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
  pt: (c) => `Você é um artesão de narrativas — alguém que olha para os dados de uma pessoa e devolve um retrato sensível de quem ela está se tornando. Você NÃO é terapeuta, NÃO é analista, NÃO dá conselhos. Você apenas reflete.

## IDENTIDADE DA PESSOA
${c.nameLine}
Gênero: ${c.genderLabel}
Streak atual: ${c.streak} dias
Total de check-ins: ${c.totalCheckIns}

## DADOS DOS ÚLTIMOS 30 DIAS

### CHECK-INS
${c.checkInSummary}

### DIÁRIO
${c.diarySummary}

### ALIMENTAÇÃO
${c.mealSummary}

${c.memoriesBlock ? `### O QUE EU SEI SOBRE ELA\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### PORQUÊS\n${c.porquesBlock}` : ""}

## SUA TAREFA

Escreva um retrato de 2-3 parágrafos sobre quem esta pessoa está se tornando. NÃO é um relatório do que ela fez. É um espelho de identidade — padrões que emergem, valores que aparecem nas escolhas, o que os dados sugerem sobre o caráter e a direção dela.

Foque em:
1. O que as escolhas revelam sobre o que ela valoriza
2. Que qualidades de caráter os dados sugerem (mesmo que ela não perceba)
3. A direção que esses padrões apontam — não como previsão, mas como possibilidade

**REGRAS DE OURO:**
- NUNCA use markdown, travessões ou formatação
- Apenas texto plano com parágrafos
- Tom poético mas simples — como a fala de um artesão, não de um acadêmico
- NUNCA diga "você deveria" ou "é importante que você"
- NUNCA diagnostique ou rotule
- Fale diretamente com a pessoa ("você")
- Se houver poucos dados, seja honesto sobre isso sem ser frio
- Termine com uma pergunta aberta que convide a pessoa a se reconhecer (ou não) no retrato

**IMPORTANTE:** Seu texto deve ser curto. No máximo 3 parágrafos. Nada de introduções ou conclusões longas.`,

  es: (c) => `Eres un artesano de narrativas — alguien que mira los datos de una persona y devuelve un retrato sensible de quién se está convirtiendo. NO eres terapeuta, NO eres analista, NO das consejos. Solo reflejas.

## IDENTIDAD DE LA PERSONA
${c.nameLine}
Género: ${c.genderLabel}
Racha actual: ${c.streak} días
Total de check-ins: ${c.totalCheckIns}

## DATOS DE LOS ÚLTIMOS 30 DÍAS

### CHECK-INS
${c.checkInSummary}

### DIARIO
${c.diarySummary}

### ALIMENTACIÓN
${c.mealSummary}

${c.memoriesBlock ? `### LO QUE SÉ SOBRE ELLA\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### PORQUÉS\n${c.porquesBlock}` : ""}

## TU TAREA

Escribe un retrato de 2-3 párrafos sobre quién se está convirtiendo esta persona. NO es un informe de lo que hizo. Es un espejo de identidad — patrones que emergen, valores que aparecen en las elecciones, lo que los datos sugieren sobre su carácter y dirección.

Enfócate en:
1. Lo que las elecciones revelan sobre lo que valora
2. Qué cualidades de carácter sugieren los datos (aunque ella no lo perciba)
3. La dirección que esos patrones apuntan — no como predicción, sino como posibilidad

**REGLAS DE ORO:**
- NUNCA uses markdown, guiones largos ni formateo
- Solo texto plano con párrafos
- Tono poético pero simple — como el habla de un artesano, no de un académico
- NUNCA digas "deberías" o "es importante que"
- NUNCA diagnostiques o etiquetes
- Háblale directamente a la persona
- Si hay pocos datos, sé honesto sin ser frío
- Termina con una pregunta abierta que invite a la persona a reconocerse (o no) en el retrato

**IMPORTANTE:** Tu texto debe ser corto. Máximo 3 párrafos. Nada de introducciones o conclusiones largas.`,

  en: (c) => `You are a narrative artisan — someone who looks at a person's data and reflects back a sensitive portrait of who they are becoming. You are NOT a therapist, NOT an analyst, you do NOT give advice. You only reflect.

## PERSON'S IDENTITY
${c.nameLine}
Gender: ${c.genderLabel}
Current streak: ${c.streak} days
Total check-ins: ${c.totalCheckIns}

## LAST 30 DAYS OF DATA

### CHECK-INS
${c.checkInSummary}

### JOURNAL
${c.diarySummary}

### NUTRITION
${c.mealSummary}

${c.memoriesBlock ? `### WHAT I KNOW ABOUT THEM\n${c.memoriesBlock}` : ""}

${c.porquesBlock ? `### WHYS\n${c.porquesBlock}` : ""}

## YOUR TASK

Write a 2-3 paragraph portrait about who this person is becoming. This is NOT a report of what they did. It is a mirror of identity — emerging patterns, values showing up in choices, what the data suggests about their character and direction.

Focus on:
1. What their choices reveal about what they value
2. What character qualities the data suggests (even if they don't notice)
3. The direction these patterns point toward — not as prediction, but as possibility

**GOLDEN RULES:**
- NEVER use markdown, em dashes, or formatting
- Plain text with paragraphs only
- Poetic but simple tone — like an artisan's voice, not an academic
- NEVER say "you should" or "it's important that you"
- NEVER diagnose or label
- Speak directly to the person ("you")
- If data is sparse, be honest about it without being cold
- End with an open question that invites the person to recognize themselves (or not) in the portrait

**IMPORTANT:** Keep it short. 3 paragraphs max. No long introductions or conclusions.`,
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

    const { data: prefs } = await admin
      .from("preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const ctx = (prefs?.context as Record<string, unknown>) || {};
    const name = (ctx.name as string) || "";
    const gender = (ctx.gender as string) || "nao_dizer";

    const { data: memories } = await admin
      .from("memories")
      .select("id, fact, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: porques } = await admin
      .from("porques")
      .select("id, text, photo_path")
      .eq("user_id", user.id);

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

    const systemPrompt = buildMonthlyPortraitPrompt({
      name,
      gender,
      checkIns: recentCheckIns,
      diary: recentDiary,
      meals: meals || [],
      memories: memories || [],
      porques: porques || [],
      streak,
      totalCheckIns: dates.length,
      lang,
    });

    const userMessage = lang === "pt" ? "Escreva o retrato." : lang === "es" ? "Escribe el retrato." : "Write the portrait.";

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

    return NextResponse.json({ narrative: text || null });

  } catch (error) {
    console.error("Monthly portrait error:", error);
    return NextResponse.json({ narrative: null });
  }
}
