import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import { sumMacros } from "@/lib/meal-utils";

type Lang = "pt" | "es" | "en";

function buildWeeklyPrompt(data: {
  checkIns: Record<string, unknown>[];
  meals: Record<string, unknown>[];
  diary: Record<string, unknown>[];
  userName: string;
  lang: Lang;
}): string {
  const parts: string[] = [];
  const lang = data.lang || "pt";

  const labels: Record<Lang, { yes: string; no: string; noDetails: string; feeling: string; energy: string; slept: string; stress: string; mealsLabel: string; fewMeals: string; diaryLabel: string }> = {
    pt: { yes: "sim", no: "não", noDetails: "sem detalhes", feeling: "sentimento", energy: "energia", slept: "dormiu bem", stress: "estresse", mealsLabel: "REFEIÇÕES", fewMeals: "Poucas ou nenhuma refeição analisada na semana.", diaryLabel: "DIÁRIO" },
    es: { yes: "sí", no: "no", noDetails: "sin detalles", feeling: "sentimiento", energy: "energía", slept: "durmió bien", stress: "estrés", mealsLabel: "COMIDAS", fewMeals: "Pocas o ninguna comida analizada en la semana.", diaryLabel: "DIARIO" },
    en: { yes: "yes", no: "no", noDetails: "no details", feeling: "feeling", energy: "energy", slept: "slept well", stress: "stress", mealsLabel: "MEALS", fewMeals: "Few or no meals analyzed this week.", diaryLabel: "JOURNAL" },
  };

  const l = labels[lang] || labels.pt;

  if (data.checkIns.length > 0) {
    const ciLines = data.checkIns.map((c: Record<string, unknown>) => {
      const segs: string[] = [];
      if (c.feeling) segs.push(`${l.feeling}: "${c.feeling}"`);
      if (c.energy_level != null) segs.push(`${l.energy}: ${c.energy_level}/10`);
      if (c.slept_well != null) segs.push(`${l.slept}: ${c.slept_well ? l.yes : l.no}`);
      if (c.stress_level != null) segs.push(`${l.stress}: ${c.stress_level}/10`);
      return `${c.date}: ${segs.join(", ") || l.noDetails}`;
    });
    parts.push("CHECK-INS:\n" + ciLines.join("\n"));
  }

  const analyzedMeals = data.meals.filter((m: Record<string, unknown>) => m.macros && m.status_analise === "analisado");
  if (analyzedMeals.length > 0) {
    const total = sumMacros(analyzedMeals as { macros: { carboidratos_g: number; proteinas_g: number; gorduras_g: number; calorias_kcal: number } | null }[]);
    const foods = new Set(
      analyzedMeals.flatMap((m: Record<string, unknown>) =>
        ((m.itens as { nome: string }[]) || []).map((i) => i.nome.toLowerCase())
      )
    );
    parts.push(
      `${l.mealsLabel}: ${analyzedMeals.length} analisadas na semana. ` +
      `Total: ${Math.round(total.calorias_kcal)} kcal. ` +
      `Alimentos: ${[...foods].slice(0, 15).join(", ")}.`
    );
  } else {
    parts.push(`${l.mealsLabel}: ${l.fewMeals}`);
  }

  if (data.diary.length > 0) {
    const dLines = data.diary.map((d: Record<string, unknown>) =>
      `${d.date}: ${(d.content as string).slice(0, 120)}`
    );
    parts.push(`${l.diaryLabel}:\n` + dLines.join("\n"));
  }

  const nome = data.userName || "usuário";

  const systemByLang: Record<Lang, string> = {
    pt: `Você é o assistente do app de saúde e acompanhou a semana de ${nome} de perto, vendo os dados dia a dia.

Seu trabalho: escrever uma reflexão semanal usando o que você observou. Fale na voz do app, como se o app estivesse falando diretamente com o usuário: "Vi que você...", "Percebi que...", "Na segunda, você...".

REGRAS:
- Comece com "Vi que..." ou "Percebi que..." relacionado a algo que realmente aparece nos dados
- Conecte padrões que você observou: alimentação, humor, sono, escrita — o que aparecer nos dados
- Tom: acolhedor e próximo, como um amigo que prestou atenção sem julgamento
- 3-5 parágrafos curtos
- Se os dados de alimentação forem escassos ou a qualidade nutricional baixa, mencione isso com cuidado, sem drama
- NUNCA diga o que a pessoa "deve" ou "precisa" fazer — apenas observe e conecte
- Use português brasileiro natural, com acentos e gramática corretos
- NUNCA use markdown, asteriscos, travessões
- Apenas pontuação comum: vírgula, ponto final, dois pontos`,

    es: `Eres el asistente de la app de salud y seguiste de cerca la semana de ${nome}, viendo los datos día a día.

Tu trabajo: escribir una reflexión semanal usando lo que observaste. Habla en la voz de la app, como si la app le hablara directamente al usuario: "Vi que...", "Noté que...", "El lunes, tú...".

REGLAS:
- Empieza con "Vi que..." o "Noté que..." relacionado con algo que realmente aparece en los datos
- Conecta patrones que observaste: alimentación, estado de ánimo, sueño, escritura
- Tono: cercano y acogedor, como un amigo que estuvo atento sin juzgar
- 3-5 párrafos cortos
- NUNCA digas lo que la persona "debe" o "necesita" hacer — solo observa y conecta
- Usa español natural
- NUNCA uses markdown, asteriscos, guiones largos
- Solo puntuación común: coma, punto final, dos puntos`,

    en: `You are the health app's assistant and followed ${nome}'s week closely, seeing the data day by day.

Your job: write a weekly reflection using what you observed. Speak in the app's voice, as if the app were talking directly to the user: "I noticed that...", "I saw that...", "On Monday, you...".

RULES:
- Start with "I noticed..." or "I saw..." related to something that actually appears in the data
- Connect patterns you observed: food, mood, sleep, journaling — whatever shows up in the data
- Tone: warm and close, like a friend who paid attention without judgment
- 3-5 short paragraphs
- NEVER say what the person "should" or "needs to" do — only observe and connect
- Use natural English
- NEVER use markdown, asterisks, or em dashes
- Only common punctuation: comma, period, colon`,
  };

  return `${systemByLang[lang] || systemByLang.pt}

DADOS DE ${nome}:

${parts.join("\n\n")}

Escreva o espelho da semana de ${nome}:`;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const lang: Lang = body.lang || "pt";

    const admin = getSupabaseAdmin();
    const mondayDate = getWeekMondayDate(); // YYYY-MM-DD SP timezone
    const sundayDate = getWeekSundayDate(); // YYYY-MM-DD SP timezone
    // Convert Mon 00:00 SP to UTC for timestamp queries (SP = UTC-3)
    const mondayUTC = new Date(mondayDate + "T03:00:00.000Z").toISOString();
    // Sunday 23:59 SP = Monday 02:59 UTC next day
    const sundayUTC = new Date(sundayDate + "T03:00:00.000Z");
    sundayUTC.setDate(sundayUTC.getDate() + 1);

    const [mealsRes, checkInsRes, diaryRes, prefsRes] = await Promise.all([
      admin.from("meals").select("*").eq("user_id", user.id).gte("data_hora", mondayUTC).lt("data_hora", sundayUTC.toISOString()).order("data_hora"),
      admin.from("check_ins").select("*").eq("user_id", user.id).gte("date", mondayDate).lte("date", sundayDate).order("date"),
      admin.from("diary_entries").select("*").eq("user_id", user.id).gte("date", mondayDate).lte("date", sundayDate).order("date").limit(7),
      admin.from("preferences").select("context").eq("user_id", user.id).single(),
    ]);

    const userName = (prefsRes.data?.context as Record<string, unknown>)?.name as string || "";

    const prompt = buildWeeklyPrompt({
      checkIns: checkInsRes.data || [],
      meals: mealsRes.data || [],
      diary: diaryRes.data || [],
      userName,
      lang,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        temperature: 0.7,
        system: prompt,
        messages: [{ role: "user", content: lang === "pt" ? "Gere o espelho da semana." : lang === "es" ? "Genera el espejo de la semana." : "Generate the weekly mirror." }],
      }),
    });

    if (!response.ok) throw new Error(await response.text());

    const apiData = await response.json();
    return NextResponse.json({ narrative: apiData.content?.[0]?.text || "" });
  } catch (error) {
    console.error("POST /api/reflect/weekly error:", error);
    return NextResponse.json({ error: "Erro ao gerar espelho" }, { status: 500 });
  }
}
