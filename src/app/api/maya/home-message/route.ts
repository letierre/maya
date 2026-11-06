import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { buildHomeMessagePrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput, buildRecentChatTopics } from "@/lib/maya-context";
import { computeCareSignals } from "@/lib/care-signals";
import { callLLM } from "@/lib/llm";
import { getLocalDate, getUserTimezone, getCurrentHour } from "@/lib/utils";
import { NEGATIVE_MOODS } from "@/lib/maya-constants";
import { NextRequest, NextResponse } from "next/server";
import { getMayaPersona } from "@/lib/maya-persona";

// Previne "cache stampede": requisições concorrentes do MESMO usuário (ex.: mount
// + remount do router.refresh) compartilham UMA única geração. Sem isso, cada
// requisição gera uma fala diferente (temperature 0.75) e a home "pisca" várias
// mensagens até uma delas vencer.
const inFlight = new Map<string, Promise<{ message: string; state: string }>>();

// ── Helpers ─────────────────────────────────────────────────────────────

function detectState(input: {
  hasTodayCheckIn: boolean;
  todayMood: string | null;
  lastSleepQuality: number | null;
  anyNegativePattern: boolean;
  anyPersistentConcern: boolean;
}): string {
  // Concern vence: padrão negativo recente OU um padrão que já dura dias/semanas.
  if (input.anyNegativePattern || input.anyPersistentConcern) return "concern";
  // Celebration: dormiu bem + check-in feito + humor positivo.
  if (
    input.hasTodayCheckIn &&
    input.lastSleepQuality !== null &&
    input.lastSleepQuality >= 4 &&
    input.todayMood &&
    !NEGATIVE_MOODS.has(input.todayMood)
  ) {
    return "celebration";
  }
  // Default
  return "greeting";
}

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

  const admin = getSupabaseAdmin();
  const userTz = req.nextUrl.searchParams.get("tz") || getUserTimezone();
  const today = getLocalDate(userTz);
  const currentHour = getCurrentHour(userTz);
  const firstName = ((user.user_metadata?.name as string) || "").split(" ")[0];
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

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

    // Regenera sob dedup: se outra requisição deste usuário já está gerando,
    // compartilha a MESMA promessa (uma única fala do LLM, um único cache).
    const key = user.id;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = regenerateHomeMessage({ admin, userId: user.id, userTz, today, currentHour, firstName, context });
      inFlight.set(key, pending);
      pending.finally(() => {
        if (inFlight.get(key) === pending) inFlight.delete(key);
      });
    }
    const { message, state } = await pending;

    return NextResponse.json({ message, state });
  } catch (error) {
    console.error("GET /api/maya/home-message error:", error);
    // Nunca deixa a home "carregando" para sempre: devolve uma saudação simples
    // mesmo que o contexto, os sinais ou o LLM tenham falhado.
    return NextResponse.json({
      message: firstName
        ? `${greeting}, ${firstName}! Como está se sentindo hoje? 💜`
        : `${greeting}! Como está se sentindo hoje? 💜`,
      state: "greeting",
    });
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

// ── Geração (extraída para dedup por usuário) ───────────────────────────

async function regenerateHomeMessage(opts: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  userTz: string;
  today: string;
  currentHour: number;
  firstName: string;
  context: Record<string, unknown>;
}): Promise<{ message: string; state: string }> {
  const { admin, userId, userTz, today, currentHour, firstName, context } = opts;
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

  // ── Fetch shared context + care signals ──
  const [ctx, careSignals] = await Promise.all([
    fetchMayaContext(userId, { checkInLimit: 7, diaryLimit: 10, sleepLimit: 1, chatLimit: 30, tz: userTz }),
    computeCareSignals(userId),
  ]);

  const gender = (context.gender as string) || "nao_dizer";
  const checks = ctx.checkIns as any[];
  const sleepLogs = ctx.sleepLogs as any[];

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

  const anyPersistentConcern = (careSignals ?? []).some(
    (s) => s.recurrence && (s.recurrence.stage === "persistente" || s.recurrence.stage === "cronico"),
  );
  const state = detectState({ hasTodayCheckIn, todayMood, lastSleepQuality, anyNegativePattern, anyPersistentConcern });

  // ── Recent chat topics (for continuity) ──
  const recentChatTopics = buildRecentChatTopics(ctx.chatMessages, today, userTz) || undefined;

  // ── Build MayaInput (fonte única: mesma persona/contexto do chat) ──
  const mayaInput = {
    ...toMayaInput(ctx, {
      name: firstName,
      gender,
      language: (context.language as string) || undefined,
      currentHour,
      currentDate: today,
      tz: userTz,
    }),
    recentChatTopics,
    greetingLabel: greetingLabels[state],
    careSignals: (careSignals ?? []).slice(0, 3).map((s) => ({
      title: s.title,
      description: s.description,
      emoji: s.emoji,
      recurrence: s.recurrence
        ? { stage: s.recurrence.stage, consecutiveDays: s.recurrence.consecutiveDays }
        : undefined,
    })),
  };

  mayaInput.persona = await getMayaPersona(admin, userId, { tz: userTz });

  // ── Generate message via LLM ──
  const { system, user: userPrompt } = buildHomeMessagePrompt(mayaInput);

  let message: string;
  let usedFallback = false;

  try {
    const llmPromise = callLLM(system, userPrompt, { maxTokens: 150, temperature: 0.75, feature: "maya_home", userId });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout")), 12000),
    );
    message = await Promise.race([llmPromise, timeoutPromise]);
    // Clean up common LLM artifacts
    message = message.replace(/^["']|["']$/g, "").trim();
    if (!message || message.length < 10) {
      throw new Error("Empty or too-short LLM response");
    }
  } catch (llmError) {
    console.error("LLM home-message failed, using fallback:", String(llmError).slice(0, 100));
    usedFallback = true;
    // ── Fallback: simple template (same spirit as old MayaHero but simpler) ──
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
  await cacheHomeMessage(admin, userId, context, message, state, today);

  // Log if fallback was used (helps monitoring)
  if (usedFallback) {
    console.log(`[home-message] Used fallback for user ${userId.slice(0, 8)}`);
  }

  return { message, state };
}
