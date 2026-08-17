import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildAnalysisPrompt, buildFactExtractionPrompt } from "@/lib/analyzer";
import { calculateStreak } from "@/lib/utils";
import { habitProgress } from "@/lib/checkin-answered";
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    const [prefsRes, checkInsRes, diaryRes, memoriesRes] = await Promise.all([
      admin.from("user_preferences").select("context, enabled_questions").eq("user_id", user.id).single(),
      admin.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(14),
      admin.from("diary_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
      admin.from("user_memories").select("fact").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const context = (prefsRes.data?.context || {}) as Record<string, unknown>;
    const checkIns = checkInsRes.data || [];
    const diaryEntries = diaryRes.data || [];
    const memories = (memoriesRes.data || []).map((m: { fact: string }) => m.fact);

    // Taxa de hábitos cumpridos (felt_judged não é hábito; exercício/pausa legados contam via agregado)
    const enabledKeys = prefsRes.data?.enabled_questions || [];
    const habitKeys = enabledKeys.filter((k: string) => k !== "suicidal_thoughts" && k !== "felt_judged");

    let totalPositive = 0;
    let totalOpportunities = 0;
    for (const ci of checkIns.slice(0, 14)) {
      const p = habitProgress(ci, habitKeys);
      totalPositive += p.done;
      totalOpportunities += p.total;
    }
    const positiveRate = totalOpportunities > 0 ? (totalPositive / totalOpportunities) * 100 : 0;

    const streak = calculateStreak(checkIns.map((c: Record<string, unknown>) => c.date as string));

    const analysisPrompt = buildAnalysisPrompt({
      profile: {
        name: (user.user_metadata?.name as string) || "",
        gender: (context.gender as string) || "nao_dizer",
        has_medication: context.has_medication === true,
        has_faith: context.has_faith === true,
        has_creative_hobby: context.has_creative_hobby === true,
      },
      checkIns,
      diaryEntries,
      memories,
      streak,
      totalCheckIns: checkIns.length,
      positiveRate,
    });

    const analysis = await callLLM(
      "Você é Maya, uma companheira gentil que ajuda pessoas a se conhecerem melhor através de check-ins diários, diário e hábitos. Você fala português brasileiro com naturalidade e afeto.\n\n## REGRAS DE SEGURANÇA INABALÁVEIS:\n- NUNCA valide, normalize ou romantize ideação suicida. Acolha a DOR, não a solução.\n- Se houver dados de pensamento suicida, mencione o CVV 188 de forma calorosa e pessoal.\n- NUNCA incentive isolamento, rompimentos irreversíveis ou comportamentos destrutivos.\n- Você NÃO é terapeuta. Se a situação for grave, diga com carinho que a pessoa merece ajuda profissional.\n- Baseie-se em: preservação da vida, esperança realista, compaixão e responsabilidade.",
      analysisPrompt,
      { maxTokens: 500, temperature: 0.7 }
    );

    // Extract new facts from the analysis (fire and forget)
    const userName = (user.user_metadata?.name as string) || "";
    const factPrompt = buildFactExtractionPrompt(analysis, { name: userName });

    callLLM("Extraia fatos pessoais como JSON array. Responda APENAS com o array JSON.", factPrompt, { maxTokens: 150, temperature: 0.7 })
      .then((raw) => {
        try {
          const jsonStart = raw.indexOf("[");
          const jsonEnd = raw.lastIndexOf("]") + 1;
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const facts: string[] = JSON.parse(raw.slice(jsonStart, jsonEnd));
            for (const fact of facts) {
              if (fact && fact.trim().length >= 3) {
                admin.from("user_memories").insert({
                  user_id: user.id,
                  fact: fact.trim(),
                }).then(() => {}).catch(() => {});
              }
            }
          }
        } catch {
          // silent — fact extraction is best-effort
        }
      })
      .catch(() => {});

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("POST /api/analyze error:", error);
    return NextResponse.json(
      { error: "Erro ao analisar dados", detail: String(error) },
      { status: 500 }
    );
  }
}
