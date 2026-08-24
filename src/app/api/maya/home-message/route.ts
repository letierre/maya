import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildHomeMessagePrompt, type GoalSummary, type WeekPlanSummary, type SpecialistSummaries } from "@/lib/maya";
import { computeCareSignals } from "@/lib/care-signals";
import { callLLM } from "@/lib/llm";
import { getLocalDate, getUserTimezone } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

// ── Helpers ─────────────────────────────────────────────────────────────

const NEGATIVE_MOODS = new Set([
  "ansiosa", "triste", "cansada", "sobrecarregada", "irritada", "frustrada",
]);

function detectState(input: {
  hasTodayCheckIn: boolean;
  todayMood: string | null;
  lastSleepQuality: number | null;
  anyNegativePattern: boolean;
}): string {
  // Celebration: slept well + check-in done + positive mood
  if (
    input.hasTodayCheckIn &&
    input.lastSleepQuality !== null &&
    input.lastSleepQuality >= 4 &&
    input.todayMood &&
    !NEGATIVE_MOODS.has(input.todayMood)
  ) {
    return "celebration";
  }
  // Concern: negative pattern detected (bad sleep, bad mood, etc.)
  if (input.anyNegativePattern) return "concern";
  // Default
  return "greeting";
}

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const userTz = req.nextUrl.searchParams.get("tz") || getUserTimezone();
  const today = getLocalDate(userTz);
  const currentHour = new Date().getHours();

  try {
    // ── Check cache ──
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const cached = context.maya_home_message as
      | { message: string; state: string; date: string; generatedAt?: string }
      | undefined;

    if (cached?.date === today && cached.message) {
      // Continuidade: se a pessoa conversou no chat DEPOIS de esta mensagem
      // ter sido gerada, regenera — para a Maya da home não contradizer o chat.
      const { data: latestChat } = await admin
        .from("chat_messages")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastChatAt = latestChat?.[0]?.created_at;
      const generatedAt = cached.generatedAt ? new Date(cached.generatedAt).getTime() : 0;
      if (!lastChatAt || new Date(lastChatAt).getTime() <= generatedAt) {
        return NextResponse.json({ message: cached.message, state: cached.state });
      }
      // senão, cai no fluxo de regeneração abaixo com o contexto do chat fresco
    }

    // ── Fetch user data ──
    const userName = (user.user_metadata?.name as string) || "";
    const firstName = userName.split(" ")[0];
    const gender = (context.gender as string) || "nao_dizer";
    const hasMedication = (context.has_medication as boolean) || false;
    const hasFaith = !!(context.faith_practice as string);
    const hasCreativeHobby = !!(context.creative_hobby as string);
    const porques = (context.porques as any[]) || [];
    const language = (context.language as string) || undefined;

    const [
      { data: recentCheckIns },
      { data: recentDiary },
      { data: memories },
      { data: activeGoals },
      { data: currentPlan },
      { data: recentSleep },
      { data: specialistInsights },
      { data: recentChatMessages },
      careSignals,
    ] = await Promise.all([
      admin.from("check_ins").select("*").eq("user_id", user.id)
        .order("date", { ascending: false }).limit(3),
      admin.from("diary_entries").select("date, content, mood").eq("user_id", user.id)
        .order("date", { ascending: false }).limit(3),
      admin.from("user_memories").select("fact").eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      admin.from("goals").select("*, goal_stages(*), goal_actions(*)")
        .eq("user_id", user.id).eq("status", "ativa")
        .order("created_at", { ascending: true }),
      admin.from("weekly_plans").select("*, weekly_tasks(*), weekly_reviews(*)")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false }).limit(1),
      admin.from("sleep_logs").select("*").eq("user_id", user.id)
        .order("date", { ascending: false }).limit(1),
      admin.from("specialist_insights").select("*").eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00Z`).limit(1),
      admin.from("chat_messages").select("role, content").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(8),
      computeCareSignals(user.id),
    ]);

    const checks = (recentCheckIns || []) as any[];
    const diaries = (recentDiary || []) as any[];
    const memFacts = ((memories || []) as any[]).map((m: any) => m.fact as string);
    const sleepLogs = (recentSleep || []) as any[];
    const specialists = specialistInsights?.[0] as any;

    // ── Build specialist summaries ──
    let specialistSummaries: SpecialistSummaries | undefined;
    if (specialists?.insights && typeof specialists.insights === "object") {
      specialistSummaries = {};
      const ins = specialists.insights as Record<string, any>;
      if (ins.psychology?.summary) specialistSummaries.psychology = ins.psychology.summary;
      if (ins.sleep?.summary) specialistSummaries.sleep = ins.sleep.summary;
      if (ins.nutrition?.summary) specialistSummaries.nutrition = ins.nutrition.summary;
      if (ins.physical?.summary) specialistSummaries.physical = ins.physical.summary;
      if (ins.goals?.summary) specialistSummaries.goals = ins.goals.summary;
      if (ins.finance?.summary) specialistSummaries.finance = ins.finance.summary;
      if (ins.spirituality?.summary) specialistSummaries.spirituality = ins.spirituality.summary;
      if (ins.philosophy?.summary) specialistSummaries.philosophy = ins.philosophy.summary;
    }

    // ── Build goal summaries ──
    const goalSummaries: GoalSummary[] = (activeGoals || []).map((g: any) => {
      const stages = (g.goal_stages || []) as any[];
      const actions = (g.goal_actions || []) as any[];
      const totalStages = stages.length;
      const doneStages = stages.filter((s: any) => s.status === "concluida").length;
      const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

      const allTimestamps = [new Date(g.updated_at).getTime()];
      for (const s of stages) allTimestamps.push(new Date(s.updated_at).getTime());
      for (const a of actions) allTimestamps.push(new Date(a.updated_at).getTime());
      const daysInactive = Math.floor((Date.now() - Math.max(...allTimestamps)) / 86_400_000);

      const nextAction = actions.find((a: any) => a.status === "pendente")?.title || null;
      const daysUntilDeadline = g.deadline
        ? Math.floor((new Date(g.deadline).getTime() - Date.now()) / 86_400_000)
        : null;

      return {
        title: g.title,
        area: g.area || "saude",
        pct,
        daysInactive,
        nextAction,
        daysUntilDeadline,
        guardianName: g.guardian_name || null,
        reward: g.reward || null,
        punishment: g.punishment || null,
      };
    });

    // ── Build week plan summary ──
    let weekPlan: WeekPlanSummary | null = null;
    if (currentPlan?.[0]) {
      const plan = currentPlan[0] as any;
      const reviews = (plan.weekly_reviews || []) as any[];
      const focusGoals = (plan.weekly_focus_goals || []) as any[];
      weekPlan = {
        mainFocus: plan.main_focus || "",
        focusGoalCount: focusGoals.length,
        hasReview: reviews.length > 0,
        reviewScore: reviews[0]?.score ?? null,
      };
    }

    // ── Detect greeting label ──
    const greetingLabels: Record<string, string> = {
      celebration: "Celebre algo positivo — use o que você sabe sobre a pessoa",
      concern: "Seja acolhedora — note que a pessoa pode estar num momento difícil",
    };

    const todayCheckIn = checks.find((c: any) => c.date === today);
    const hasTodayCheckIn = !!todayCheckIn;
    const todayMood = todayCheckIn?.mood_tags?.[0] || null;
    const lastSleepQuality = sleepLogs[0]?.quality ?? null;
    const badSleepCount = checks.slice(0, 3).filter((c: any) => c.slept_well === false).length;
    const anyNegativePattern = badSleepCount >= 2 ||
      (checks.slice(0, 3).filter((c: any) =>
        c.mood_tags?.length > 0 && NEGATIVE_MOODS.has(c.mood_tags[0])
      ).length >= 2);

    const state = detectState({ hasTodayCheckIn, todayMood, lastSleepQuality, anyNegativePattern });

    // ── Recent chat topics (for continuity) ──
    // Transcrição das últimas trocas em ordem cronológica, com papéis explícitos,
    // para a home "lembrar" o que foi dito e não parecer outra Maya.
    const recentChatTopics = (recentChatMessages || [])
      .filter((m: any) => m.role === "assistant" || m.role === "user")
      .reverse()
      .map((m: any) => `${m.role === "assistant" ? "Maya" : "Usuário"}: ${m.content?.slice(0, 200)}`)
      .join("\n");

    // ── Build MayaInput ──
    const mayaInput = {
      profile: {
        name: firstName,
        gender,
        has_medication: hasMedication,
        has_faith: hasFaith,
        has_creative_hobby: hasCreativeHobby,
      },
      recentCheckIns: checks.map((c: any) => {
        return {
          date: c.date,
          positives: Object.entries(c)
            .filter(([k, v]) => v === true && k !== "suicidal_thoughts" && k !== "felt_judged")
            .map(([k]) => k),
          negatives: Object.entries(c)
            .filter(([k, v]) => v === false && k !== "suicidal_thoughts" && k !== "felt_judged")
            .map(([k]) => k),
          feeling: c.feeling || "",
        };
      }),
      recentDiary: diaries.map((d: any) => ({
        date: d.date,
        content: d.content || "",
        mood: d.mood ?? null,
      })),
      memories: memFacts,
      porques,
      streak: checks.length, // simplified
      currentHour,
      currentDate: today,
      activeGoals: goalSummaries,
      weekPlan,
      language,
      specialistSummaries,
      recentChatTopics: recentChatTopics || undefined,
      greetingLabel: greetingLabels[state] || undefined,
      careSignals: (careSignals ?? []).slice(0, 3).map((s) => ({
        title: s.title,
        description: s.description,
        emoji: s.emoji,
      })),
    };

    // ── Generate message via LLM ──
    const { system, user: userPrompt } = buildHomeMessagePrompt(mayaInput);

    let message: string;
    let usedFallback = false;

    try {
      message = await callLLM(system, userPrompt, { maxTokens: 150, temperature: 0.75 });
      // Clean up common LLM artifacts
      message = message.replace(/^["']|["']$/g, "").trim();
      if (!message || message.length < 10) {
        throw new Error("Empty or too-short LLM response");
      }
    } catch (llmError) {
      console.error("LLM home-message failed, using fallback:", String(llmError).slice(0, 100));
      usedFallback = true;
      // ── Fallback: simple template (same spirit as old MayaHero but simpler) ──
      const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";
      if (!hasTodayCheckIn) {
        if (badSleepCount >= 2) {
          message = `${greeting}, ${firstName}! Vi que você não dormiu bem de novo. Se quiser conversar sobre isso, estou aqui. 💜`;
        } else {
          message = `${greeting}, ${firstName}! Ainda não fez seu check-in hoje. Como está se sentindo?`;
        }
      } else if (todayMood && NEGATIVE_MOODS.has(todayMood)) {
        message = `${greeting}, ${firstName}. Vi que hoje não está fácil. Quer conversar sobre o que está pesando?`;
      } else {
        message = `${greeting}, ${firstName}! Que bom ter você aqui. Como está sendo seu dia?`;
      }
    }

    // ── Cache ──
    await cacheHomeMessage(admin, user.id, context, message, state, today);

    // Log if fallback was used (helps monitoring)
    if (usedFallback) {
      console.log(`[home-message] Used fallback for user ${user.id.slice(0, 8)}`);
    }

    return NextResponse.json({ message, state });
  } catch (error) {
    console.error("GET /api/maya/home-message error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar mensagem", detail: String(error) },
      { status: 500 }
    );
  }
}

// ── Cache helper ──────────────────────────────────────────────────────────

async function cacheHomeMessage(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  context: Record<string, unknown>,
  message: string,
  state: string,
  date: string,
) {
  try {
    await admin
      .from("user_preferences")
      .update({
        context: {
          ...context,
          maya_home_message: { message, state, date, generatedAt: new Date().toISOString() },
        },
      })
      .eq("user_id", userId);
  } catch {
    /* best-effort */
  }
}
