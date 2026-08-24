import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLatestInsights, type SpecialistInsights } from "@/lib/specialists";
import { calculateStreak, getWeekMondayDate, getLocalDate } from "@/lib/utils";
import { habitAnswered } from "@/lib/checkin-answered";
import { getMoodById, getMoodLabel } from "@/lib/checkin-moods";
import type {
  GoalSummary,
  WeekPlanSummary,
  SpecialistSummaries,
  MayaInput,
} from "@/lib/maya";

/**
 * Fonte única de contexto da Maya. Cada superfície (chat, home, planejamento,
 * nudge) busca o mesmo conjunto de dados daqui — em vez de cada uma montar o
 * próprio `Promise.all` e repetir o mapeamento de metas/semana/check-in.
 */

// ── Tipos ───────────────────────────────────────────────────────────

export interface FetchMayaContextOptions {
  checkInLimit?: number;
  diaryLimit?: number;
  sleepLimit?: number;      // 0 = não busca sono
  chatLimit?: number;       // 0 = não busca chat recente
  weekStart?: string;       // semana atual (default: semana de hoje)
  weekPlanWithTasks?: boolean;
  includeFinancials?: boolean;
  includeAreaVisions?: boolean;
  includeQuarterly?: boolean;
}

export interface MayaContext {
  prefs: Record<string, unknown> | null;
  checkIns: Record<string, unknown>[];
  diaryEntries: Record<string, unknown>[];
  memories: string[];
  rawGoals: Record<string, unknown>[];
  weekPlanRaw: Record<string, unknown> | null;
  sleepLogs: Record<string, unknown>[];
  chatMessages: { role: string; content: string }[];
  financialTransactions: Record<string, unknown>[];
  areaVisions: Record<string, unknown>[];
  quarterlyCycle: Record<string, unknown> | null;
  latestInsights: SpecialistInsights | null;
}

// ── Fetch (uma única rajada de queries compartilhadas) ───────────────

export async function fetchMayaContext(
  userId: string,
  opts: FetchMayaContextOptions = {},
): Promise<MayaContext> {
  const admin = getSupabaseAdmin();
  const today = getLocalDate();
  const weekStart = opts.weekStart || getWeekMondayDate();

  const keys: string[] = [];
  const tasks: any[] = [];
  const add = (key: string, p: any) => { keys.push(key); tasks.push(p); };

  // Núcleo compartilhado por todas as Mayas.
  add("prefs", admin.from("user_preferences").select("context").eq("user_id", userId).single());
  add("checkIns", admin.from("check_ins").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(opts.checkInLimit ?? 7));
  add("diaryEntries", admin.from("diary_entries").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(opts.diaryLimit ?? 10));
  add("memories", admin.from("user_memories").select("fact").eq("user_id", userId).order("created_at", { ascending: false }));
  add("rawGoals", admin.from("goals")
    .select("*, goal_stages(*, goal_actions(*))")
    .eq("user_id", userId).eq("status", "ativa")
    .order("created_at", { ascending: true })
    .order("position", { foreignTable: "goal_stages", ascending: true }));
  add("weekPlanRaw", admin.from("weekly_plans")
    .select(opts.weekPlanWithTasks ? "*, weekly_tasks(*), weekly_reviews(*)" : "*, weekly_reviews(*), weekly_focus_goals(goal_id)")
    .eq("user_id", userId).eq("week_start", weekStart).maybeSingle());
  add("latestInsights", getLatestInsights(userId).catch(() => null));

  // Extras opcionais (por superfície).
  const sleepLimit = opts.sleepLimit ?? 0;
  if (sleepLimit > 0) {
    add("sleepLogs", admin.from("sleep_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(sleepLimit));
  }
  const chatLimit = opts.chatLimit ?? 0;
  if (chatLimit > 0) {
    add("chatMessages", admin.from("chat_messages").select("role, content").eq("user_id", userId)
      .or("chat_type.is.null,chat_type.eq.maya")
      .order("created_at", { ascending: false }).limit(chatLimit));
  }
  if (opts.includeFinancials) {
    add("financialTransactions", admin.from("financial_transactions")
      .select("amount, type").eq("user_id", userId)
      .gte("date", `${today.slice(0, 7)}-01`).lte("date", `${today.slice(0, 7)}-31`));
  }
  if (opts.includeAreaVisions) {
    add("areaVisions", admin.from("area_visions").select("*").eq("user_id", userId).order("area", { ascending: true }));
  }
  if (opts.includeQuarterly) {
    add("quarterlyCycle", admin.from("quarterly_cycles")
      .select("*, key_results(*), quarterly_reviews(*)")
      .eq("user_id", userId).eq("status", "active")
      .order("position", { foreignTable: "key_results", ascending: true }).maybeSingle());
  }

  const results = await Promise.all(tasks);

  const ctx: MayaContext = {
    prefs: null,
    checkIns: [],
    diaryEntries: [],
    memories: [],
    rawGoals: [],
    weekPlanRaw: null,
    sleepLogs: [],
    chatMessages: [],
    financialTransactions: [],
    areaVisions: [],
    quarterlyCycle: null,
    latestInsights: null,
  };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const res = results[i];
    switch (key) {
      case "prefs": ctx.prefs = res?.data ?? null; break;
      case "checkIns": ctx.checkIns = res?.data ?? []; break;
      case "diaryEntries": ctx.diaryEntries = res?.data ?? []; break;
      case "memories": ctx.memories = (res?.data ?? []).map((m: any) => m.fact as string); break;
      case "rawGoals": ctx.rawGoals = res?.data ?? []; break;
      case "weekPlanRaw": ctx.weekPlanRaw = res?.data ?? null; break;
      case "latestInsights": ctx.latestInsights = res ?? null; break;
      case "sleepLogs": ctx.sleepLogs = res?.data ?? []; break;
      case "chatMessages": ctx.chatMessages = res?.data ?? []; break;
      case "financialTransactions": ctx.financialTransactions = res?.data ?? []; break;
      case "areaVisions": ctx.areaVisions = res?.data ?? []; break;
      case "quarterlyCycle": ctx.quarterlyCycle = res?.data ?? null; break;
    }
  }

  return ctx;
}

// ── Mapeamentos unificados ──────────────────────────────────────────

/** Resumo de metas ativas (unifica os 3 cálculos anteriores; usa `target_date`). */
export function buildGoalSummaries(rawGoals: Record<string, unknown>[]): GoalSummary[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rawGoals.map((g) => {
    const stages = (g.goal_stages as Record<string, unknown>[]) || [];
    const totalStages = stages.length;
    const doneStages = stages.filter((s) => s.status === "concluida").length;
    const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

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
}

/** Resumo da semana atual (usa `week_score` — corrige o bug `score`). */
export function buildWeekPlanSummary(weekPlanRaw: Record<string, unknown> | null): WeekPlanSummary | null {
  if (!weekPlanRaw) return null;
  const reviews = (weekPlanRaw.weekly_reviews as Record<string, unknown>[]) || [];
  const review = reviews[0] ?? null;
  return {
    mainFocus: weekPlanRaw.main_focus as string,
    focusGoalCount: ((weekPlanRaw.weekly_focus_goals as unknown[]) || []).length,
    hasReview: !!review,
    reviewScore: review ? (review.week_score as number) : null,
  };
}

/** Transcrição da conversa recente do chat (papéis explícitos, ordem cronológica). */
export function buildRecentChatTopics(messages: { role: string; content: string }[]): string {
  return (messages || [])
    .filter((m) => m.role === "assistant" || m.role === "user")
    .reverse()
    .map((m) => `${m.role === "assistant" ? "Maya" : "Usuário"}: ${m.content?.slice(0, 200)}`)
    .join("\n");
}

/** Streak de check-ins consecutivos (delega a `calculateStreak`). */
export function computeStreak(checkIns: Record<string, unknown>[]): number {
  return calculateStreak(checkIns.map((c) => c.date as string));
}

/** Resumos dos especialistas (extrai `.summary` — corrige o cast errado do planejamento). */
export function buildSpecialistSummaries(insights: SpecialistInsights | null): SpecialistSummaries | undefined {
  if (!insights || typeof insights !== "object") return undefined;
  const summaries: SpecialistSummaries = {};
  if (insights.psychology?.summary) summaries.psychology = insights.psychology.summary;
  if (insights.sleep?.summary) summaries.sleep = insights.sleep.summary;
  if (insights.nutrition?.summary) summaries.nutrition = insights.nutrition.summary;
  if (insights.physical?.summary) summaries.physical = insights.physical.summary;
  if (insights.goals?.summary) summaries.goals = insights.goals.summary;
  if (insights.finance?.summary) summaries.finance = insights.finance.summary;
  if (insights.spirituality?.summary) summaries.spirituality = insights.spirituality.summary;
  if (insights.philosophy?.summary) summaries.philosophy = insights.philosophy.summary;
  return Object.keys(summaries).length > 0 ? summaries : undefined;
}

function buildCheckInRecord(c: Record<string, unknown>, gender: string) {
  return {
    date: c.date as string,
    feeling: (c.feeling as string) || "",
    moodTags: ((c.mood_tags as string[]) || []).map((id) => {
      const chip = getMoodById(id);
      return chip ? getMoodLabel(chip, gender) : id;
    }),
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
      !c.exercise_walk && habitAnswered(c, "exercise_walk") && "exercício",
      !c.ate_well && habitAnswered(c, "ate_well") && "comeu bem",
      !c.drank_water && habitAnswered(c, "drank_water") && "água",
      !c.slept_well && habitAnswered(c, "slept_well") && "dormiu bem",
      !c.did_something_enjoyable && habitAnswered(c, "did_something_enjoyable") && "algo que gostou",
      !c.worked_on_goals && habitAnswered(c, "worked_on_goals") && "metas",
    ].filter(Boolean) as string[],
  };
}

// ── Monta o MayaInput (shape do prompt) a partir do contexto ─────────

export interface MayaInputProfile {
  name: string;
  gender: string;
  language?: string;
  currentHour?: number;
  currentDate?: string;
}

export function toMayaInput(ctx: MayaContext, p: MayaInputProfile): MayaInput {
  // `ctx.prefs` é a linha `user_preferences` (`{ context: {...} }`); o contexto
  // real (perfil, porquês, cache de nudge/home) vive dentro de `context`.
  const context = (ctx.prefs?.context ?? {}) as Record<string, unknown>;
  return {
    profile: {
      name: p.name,
      gender: p.gender,
      has_medication: context.has_medication === true,
      has_faith: context.has_faith === true,
      has_creative_hobby: context.has_creative_hobby === true,
    },
    recentCheckIns: ctx.checkIns.map((c) => buildCheckInRecord(c, p.gender)),
    recentDiary: ctx.diaryEntries.map((d) => ({
      date: d.date as string,
      content: (d.content as string) || "",
      mood: (d.mood as number) ?? null,
    })),
    memories: ctx.memories,
    porques: ((context.porques as Array<Record<string, unknown>>) || []).map((q) => ({
      id: (q.id as string) || "",
      text: (q.text as string) || "",
      photoPath: (q.photo_path as string) || (q.photoPath as string) || null,
    })),
    streak: computeStreak(ctx.checkIns),
    currentHour: p.currentHour,
    currentDate: p.currentDate,
    activeGoals: buildGoalSummaries(ctx.rawGoals),
    weekPlan: buildWeekPlanSummary(ctx.weekPlanRaw),
    language: p.language,
    specialistSummaries: buildSpecialistSummaries(ctx.latestInsights),
    areaVisions: (ctx.areaVisions || [])
      .map((v) => ({ area: v.area as string, statement: (v.statement as string) || "" }))
      .filter((v) => v.statement.trim()),
  };
}
