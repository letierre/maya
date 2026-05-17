import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getLocalDate } from "@/lib/utils";
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
    pt: `Você é um ESPELHO — você reflete de volta o que vê, sem julgar, sem prescrever, sem dar conselhos.

Seu trabalho: escrever uma narrativa curta sobre a semana de ${nome} baseada nos dados abaixo.

REGRAS:
- NUNCA diga o que a pessoa "deve" ou "precisa" fazer
- NUNCA julgue os dados como bons ou ruins
- APENAS reflita padrões: "quando X aconteceu, Y apareceu"
- Use o nome da pessoa naturalmente
- Tom: cálido, humano, como quem se importa
- Escreva 3-5 parágrafos curtos
- Use português brasileiro natural, com acentos e gramática corretos
- NUNCA use markdown, asteriscos, travessões
- Apenas pontuação comum: vírgula, ponto final, dois pontos
- Comece com um parágrafo que acolhe a semana como um todo`,

    es: `Eres un ESPEJO — reflejas de vuelta lo que ves, sin juzgar, sin prescribir, sin dar consejos.

Tu trabajo: escribir una narrativa corta sobre la semana de ${nome} basada en los datos abajo.

REGLAS:
- NUNCA digas lo que la persona "debe" o "necesita" hacer
- NUNCA juzgues los datos como buenos o malos
- SOLO refleja patrones: "cuando X sucedió, Y apareció"
- Usa el nombre de la persona naturalmente
- Tono: cálido, humano, como alguien que se preocupa
- Escribe 3-5 párrafos cortos
- Usa español natural
- NUNCA uses markdown, asteriscos, guiones largos
- Solo puntuación común: coma, punto final, dos puntos
- Comienza con un párrafo que acoge la semana como un todo`,

    en: `You are a MIRROR — you reflect back what you see, without judging, without prescribing, without giving advice.

Your job: write a short narrative about ${nome}'s week based on the data below.

RULES:
- NEVER say what the person "should" or "needs to" do
- NEVER judge the data as good or bad
- ONLY reflect patterns: "when X happened, Y appeared"
- Use the person's name naturally
- Tone: warm, human, like someone who cares
- Write 3-5 short paragraphs
- Use natural English
- NEVER use markdown, asterisks, or em dashes
- Only common punctuation: comma, period, colon
- Start with a paragraph that embraces the week as a whole`,
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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [mealsRes, checkInsRes, diaryRes, prefsRes] = await Promise.all([
      admin.from("meals").select("*").eq("user_id", user.id).gte("data_hora", sevenDaysAgo.toISOString()).order("data_hora"),
      admin.from("check_ins").select("*").eq("user_id", user.id).gte("date", sevenDaysAgo.toISOString().slice(0, 10)).order("date"),
      admin.from("diary_entries").select("*").eq("user_id", user.id).gte("date", sevenDaysAgo.toISOString().slice(0, 10)).order("date").limit(5),
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
