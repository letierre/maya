import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildMayaSystemPrompt, GoalSummary, WeekPlanSummary } from "@/lib/maya";
import { calculateStreak, getWeekMondayDate } from "@/lib/utils";
import { NextResponse } from "next/server";

async function callAnthropicChat(
  system: string,
  messages: { role: string; content: string }[],
  maxTokens = 500
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      temperature: 0.7,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const messages: { role: string; content: string }[] = body.messages || [];

    if (!messages.length) {
      return NextResponse.json({ error: "Mensagens vazias" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const weekStart = getWeekMondayDate();

    const [prefsRes, checkInsRes, diaryRes, memoriesRes, goalsRes, weekPlanRes] = await Promise.all([
      admin.from("user_preferences").select("context").eq("user_id", user.id).single(),
      admin.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
      admin.from("diary_entries").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(10),
      admin.from("user_memories").select("fact").eq("user_id", user.id).order("created_at", { ascending: false }),
      admin.from("goals").select(`*, goal_stages(*, goal_actions(*))`)
        .eq("user_id", user.id).eq("status", "ativa")
        .order("created_at", { ascending: true })
        .order("position", { foreignTable: "goal_stages", ascending: true }),
      admin.from("weekly_plans").select(`*, weekly_reviews(*), weekly_focus_goals(goal_id)`)
        .eq("user_id", user.id).eq("week_start", weekStart).maybeSingle(),
    ]);

    const context = (prefsRes.data?.context || {}) as Record<string, unknown>;
    const checkIns = checkInsRes.data || [];
    const diaryEntries = diaryRes.data || [];
    const memories = (memoriesRes.data || []).map((m: { fact: string }) => m.fact);
    const rawGoals = goalsRes.data || [];
    const weekPlanRaw = weekPlanRes.data;

    // Build GoalSummary[]
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeGoals: GoalSummary[] = rawGoals.map((g: Record<string, unknown>) => {
      const stages = (g.goal_stages as Record<string, unknown>[]) || [];
      const totalStages = stages.length;
      const doneStages = stages.filter((s) => s.status === "concluida").length;
      const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

      // Most recent update across goal, stages, actions
      const timestamps: number[] = [new Date(g.updated_at as string).getTime()];
      for (const s of stages) {
        timestamps.push(new Date(s.updated_at as string).getTime());
        for (const a of (s.goal_actions as Record<string, unknown>[]) || []) {
          timestamps.push(new Date(a.updated_at as string).getTime());
        }
      }
      const lastActive = new Date(Math.max(...timestamps));
      lastActive.setHours(0, 0, 0, 0);
      const daysInactive = Math.floor((today.getTime() - lastActive.getTime()) / 86_400_000);

      // Next pending action from first non-concluded stage
      let nextAction: string | null = null;
      for (const s of stages) {
        if (s.status !== "concluida") {
          const pendingAction = ((s.goal_actions as Record<string, unknown>[]) || []).find((a) => a.status === "pendente");
          if (pendingAction) { nextAction = pendingAction.title as string; break; }
          break;
        }
      }

      const daysUntilDeadline = g.target_date
        ? Math.floor((new Date(g.target_date as string).getTime() - today.getTime()) / 86_400_000)
        : null;

      return {
        title: g.title as string,
        area: g.area as string,
        pct,
        daysInactive,
        nextAction,
        daysUntilDeadline,
        guardianName: (g.guardian_name as string) || null,
        reward: (g.reward as string) || null,
        punishment: (g.punishment as string) || null,
      };
    });

    // Build WeekPlanSummary
    let weekPlan: WeekPlanSummary | null = null;
    if (weekPlanRaw) {
      const reviews = (weekPlanRaw.weekly_reviews as Record<string, unknown>[]) || [];
      const review = reviews[0] ?? null;
      weekPlan = {
        mainFocus: weekPlanRaw.main_focus as string,
        focusGoalCount: ((weekPlanRaw.weekly_focus_goals as unknown[]) || []).length,
        hasReview: !!review,
        reviewScore: review ? (review.week_score as number) : null,
      };
    }

    const streak = calculateStreak(checkIns.map((c: Record<string, unknown>) => c.date as string));

    // Hora atual no fuso brasileiro (America/Sao_Paulo)
    const brHour = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false });
    const currentHour = parseInt(brHour, 10);

    const systemPrompt = buildMayaSystemPrompt({
      currentHour,
      profile: {
        name: (user.user_metadata?.name as string) || "",
        gender: (context.gender as string) || "nao_dizer",
        has_medication: context.has_medication === true,
        has_faith: context.has_faith === true,
        has_creative_hobby: context.has_creative_hobby === true,
      },
      recentCheckIns: checkIns.map((c: Record<string, unknown>) => ({
        date: c.date as string,
        feeling: (c.feeling as string) || "",
        positives: [
          c.exercise_walk && "exercício",
          c.ate_well && "comeu bem",
          c.drank_water && "água",
          c.slept_well && "dormiu bem",
          c.meditation_prayer_breathing && "meditou/orou",
          c.creative_activity && "criatividade",
          c.did_something_enjoyable && "algo que gostou",
          c.worked_on_goals && "metas",
          c.talked_to_someone && "conversou",
        ].filter(Boolean) as string[],
        negatives: [
          !c.exercise_walk && "exercício",
          !c.ate_well && "comeu bem",
          !c.drank_water && "água",
          !c.slept_well && "dormiu bem",
          !c.did_something_enjoyable && "algo que gostou",
          !c.worked_on_goals && "metas",
        ].filter(Boolean) as string[],
      })),
      recentDiary: diaryEntries.map((d: Record<string, unknown>) => ({
        date: d.date as string,
        content: (d.content as string) || "",
        mood: d.mood as number | null,
      })),
      memories,
      porques: (context.porques as Array<{ id: string; text: string; photoPath: string | null }>) || [],
      streak,
      activeGoals,
      weekPlan,
    });

    const reply = await callAnthropicChat(systemPrompt, messages, 400);

    // Extract new facts from the conversation (fire and forget)
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      const factPrompt = buildFactExtractionPrompt(reply, lastUserMsg.content, { name: (user.user_metadata?.name as string) || "" });

      callAnthropicChat(
        "Extraia fatos pessoais como JSON array. Responda APENAS com o array JSON.",
        [{ role: "user", content: factPrompt }],
        150
      )
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
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/maya error:", error);
    return NextResponse.json(
      { error: "Erro ao conversar com Maya", detail: String(error) },
      { status: 500 }
    );
  }
}

function buildFactExtractionPrompt(mayaReply: string, userMessage: string, profile: { name: string }): string {
  return `Você é um assistente que extrai FATOS PESSOAIS sobre o usuário a partir de uma conversa.

Mensagem do usuário:
"${userMessage.slice(0, 300)}"

Resposta de Maya:
"${mayaReply.slice(0, 300)}"

## INSTRUÇÕES
1. Extraia apenas fatos NOVOS e RELEVANTES sobre a vida pessoal do usuário que Maya mencionou ou descobriu.
2. NÃO extraia dados óbvios de check-in (ex: "fez exercício 3x essa semana").
3. Extraia preferências, contexto de vida, rotinas específicas, relações, gostos pessoais.
4. Exemplos do que extrair:
   - "gosta de caminhar à noite"
   - "tem uma filha chamada Sofia"
   - "trabalha como designer"
   - "está estudando para concurso"
   - "adora cozinhar aos domingos"
   - "mora sozinho(a)"
5. Exemplos do que NÃO extrair:
   - "teve 3 dias bons essa semana"
   - "marcou exercício 5 vezes"
6. Retorne APENAS um array JSON com os fatos como strings. Se não houver fatos novos, retorne array vazio.
7. Máximo 3 fatos.

Formato: ["fato 1", "fato 2"]`;
}
