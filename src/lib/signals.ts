import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate, getWeekMondayDate } from "@/lib/utils";
import { t as tt, type Lang } from "@/lib/i18n";
import {
  NEGATIVE_MOODS,
  SLEEP_QUALITY_MIN,
  SLEEP_MIN_MINUTES,
  WATER_GOAL_CUPS,
  BAD_MEAL_CLASSIFICATIONS,
  SPENDING_THRESHOLD,
} from "@/lib/maya-constants";

/**
 * Motor ÚNICO de sinais da Maya. Todas as superfícies (care-list "o que cuidar",
 * nudge da home, plan-insight do planejamento) leem daqui — em vez de cada uma
 * detectar o próprio jeito. O mesmo fato vira UM sinal com vários `feed`s,
 * então as Mayas não se contradizem.
 */

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type SignalTier = "biologico" | "fisico" | "emocional" | "contexto" | "planejamento";
export type SignalFeed = "care" | "nudge" | "plan";

export interface Signal {
  id: string;
  tier: SignalTier;
  /** Peso de ranqueamento p/ o care-list (base × (1 + min(streak, teto))). */
  weight: number;
  /** Prioridade p/ nudge (1 = mais alto) e p/ plan-insight. */
  priority: number;
  /** Dias/registros consecutivos abaixo do mínimo. */
  streak: number;
  emoji: string;
  title: string;
  /** Texto canônico (care-list e plan-insight). */
  description: string;
  /** Template de nudge (caloroso, com saudação). Só em sinais que alimentam nudge. */
  message?: string;
  action?: { label: string; href: string };
  feed: SignalFeed[];
}

export interface PlanAnalytics {
  strongest: string;
  weakest: string;
  balance: number;   // 0–100
  variation: number; // % vs semana passada
}

export interface SignalResult {
  signals: Signal[];
  plan: PlanAnalytics | null;
}

// ── Helpers compartilhados ─────────────────────────────────────────────────────

const STREAK_CAP = 5;
const LOOKBACK_ROWS = 16;

function consecutiveBad(records: { bad: boolean }[]): number {
  let streak = 0;
  for (const r of records) {
    if (r.bad) streak++;
    else break;
  }
  return streak;
}

function weightFor(basePriority: number, streak: number): number {
  return Math.round(basePriority * (1 + Math.min(streak, STREAK_CAP)));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Fragmentos localizados (plural/gênero) ──────────────────────────────────

function diasStr(n: number, lang: Lang): string {
  if (lang === "es") return `${n} ${n === 1 ? "día" : "días"}`;
  if (lang === "en") return `${n} ${n === 1 ? "day" : "days"}`;
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

function periodoRecente(n: number, lang: Lang): string {
  if (lang === "es") return `${n} ${n === 1 ? "día" : "días"} ${n === 1 ? "reciente" : "recientes"}`;
  if (lang === "en") return `${n} ${n === 1 ? "recent day" : "recent days"}`;
  return `${n} ${n === 1 ? "dia" : "dias"} ${n === 1 ? "recente" : "recentes"}`;
}

function temTarefas(n: number, lang: Lang): string {
  if (lang === "es") return n === 1 ? "hay una tarea" : `hay ${n} tareas`;
  if (lang === "en") return n === 1 ? "there's one task" : `there are ${n} tasks`;
  return n === 1 ? "tem uma tarefa" : `tem ${n} tarefas`;
}

function ficaramWord(n: number, lang: Lang): string {
  if (lang === "es") return n === 1 ? "quedó" : "quedaron";
  if (lang === "en") return n === 1 ? "was" : "were";
  return n === 1 ? "ficou" : "ficaram";
}

function feitoWord(n: number, lang: Lang): string {
  if (lang === "es") return n === 1 ? "se hizo" : "se hicieron";
  if (lang === "en") return n === 1 ? "was done" : "were done";
  return n === 1 ? "foi feito" : "foram feitos";
}

function naoCulpa(n: number, lang: Lang): string {
  if (n <= 2) return "";
  if (lang === "es") return "No te culpes, pasa. ";
  if (lang === "en") return "Don't blame yourself, it happens. ";
  return "Não se culpe, isso acontece. ";
}

function perdidoWord(gender: string, lang: Lang): string {
  if (lang === "es") return gender === "feminino" ? "perdida" : "perdido";
  if (lang === "en") return "feeling lost";
  return gender === "feminino" ? "perdida" : "perdido";
}

function juntoWord(gender: string, lang: Lang): string {
  if (lang === "es") return gender === "feminino" ? "juntas" : "juntos";
  if (lang === "en") return "together";
  return gender === "feminino" ? "junta" : "junto";
}

function sozinhoWord(gender: string, lang: Lang): string {
  if (lang === "es") return gender === "feminino" ? "sola" : "solo";
  if (lang === "en") return "alone";
  return gender === "feminino" ? "sozinha" : "sozinho";
}

function diaSemana(dow3: number, lang: Lang): string {
  const idx = dow3 - 3;
  if (lang === "es") return ["miércoles", "jueves", "viernes"][idx] ?? "";
  if (lang === "en") return ["Wednesday", "Thursday", "Friday"][idx] ?? "";
  return ["quarta-feira", "quinta-feira", "sexta-feira"][idx] ?? "";
}

function saludo(firstName: string, lang: Lang): string {
  return tt(lang, "sg_ola", { name: firstName ? `, ${firstName}` : "" });
}

// ── Contexto bruto (um único fetch superset) ──────────────────────────────────

interface SignalContext {
  checkIns: any[];       // date desc (até LOOKBACK_ROWS)
  sleepLogs: any[];      // date desc, dedup por data
  meals: any[];
  goals: any[];          // metas ativas (+ goal_stages)
  financial: any[];      // transações do mês
  lastDiaryDate: string | null;
  currentPlan: any | null;   // weekly_plan atual (+ weekly_tasks)
  planHistory: any[];        // 4 semanas anteriores (+ weekly_tasks), mais recente primeiro
  hasMedication: boolean;
  today: string;
}

// ── Care: 7 sinais de negligência (biológico → físico → emocional) ────────────

const CARE_DEFS: {
  id: string;
  emoji: string;
  titleKey: string;
  tier: SignalTier;
  basePriority: number;
  minStreak: number;
  action?: { labelKey: string; href: string };
  describe: (streak: number, lang: Lang) => string;
  compute: (ctx: SignalContext) => number;
}[] = [
  {
    id: "medication", emoji: "💊", titleKey: "care_medication_title", tier: "biologico",
    basePriority: 95, minStreak: 1,
    action: { labelKey: "care_action_checkin", href: "/check-in" },
    describe: (s, lang) => tt(lang, "care_medication_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => ctx.hasMedication
      ? consecutiveBad(ctx.checkIns.map((c) => ({ bad: c.took_medication === false })))
      : 0,
  },
  {
    id: "sleep", emoji: "😴", titleKey: "care_sleep_title", tier: "biologico",
    basePriority: 90, minStreak: 2,
    action: { labelKey: "care_action_sleep", href: "/sono" },
    describe: (s, lang) => tt(lang, "care_sleep_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => consecutiveBad(
      ctx.sleepLogs
        .map((log) => {
          const q = log.quality as number | null;
          const d = log.duration_min as number | null;
          if (q == null && d == null) return null;
          return { bad: (q != null && q < SLEEP_QUALITY_MIN) || (d != null && d < SLEEP_MIN_MINUTES) };
        })
        .filter((r): r is { bad: boolean } => r != null)
    ),
  },
  {
    id: "hydration", emoji: "💧", titleKey: "care_hydration_title", tier: "biologico",
    basePriority: 80, minStreak: 2,
    action: { labelKey: "care_action_water", href: "/check-in" },
    describe: (s, lang) => tt(lang, "care_hydration_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => consecutiveBad(ctx.checkIns.map((c) => ({ bad: (c.water_cups ?? 0) < WATER_GOAL_CUPS }))),
  },
  {
    id: "nutrition", emoji: "🍬", titleKey: "care_nutrition_title", tier: "biologico",
    basePriority: 75, minStreak: 3,
    action: { labelKey: "care_action_meal", href: "/nutricao/registrar" },
    describe: (s, lang) => tt(lang, "care_nutrition_desc", { periodo: periodoRecente(s, lang) }),
    compute: (ctx) => {
      const dayBad = new Map<string, boolean>();
      for (const m of ctx.meals) {
        const cls = (m.classificacao as string) || "";
        if (!cls || cls === "nao_identificada") continue;
        const day = String(m.data_hora).slice(0, 10);
        const bad = BAD_MEAL_CLASSIFICATIONS.has(cls);
        if (!dayBad.has(day)) dayBad.set(day, bad);
        else if (bad) dayBad.set(day, true);
      }
      const days = [...dayBad.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, bad]) => ({ bad }));
      return consecutiveBad(days);
    },
  },
  {
    id: "exercise", emoji: "🏃", titleKey: "care_exercise_title", tier: "fisico",
    basePriority: 65, minStreak: 4,
    action: { labelKey: "care_action_exercise", href: "/corrida" },
    describe: (s, lang) => tt(lang, "care_exercise_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => consecutiveBad(
      ctx.checkIns.map((c) => ({
        bad: c.walked !== true && c.ran !== true && c.strength_training !== true && c.exercise_walk !== true,
      }))
    ),
  },
  {
    id: "mood", emoji: "🌧️", titleKey: "care_mood_title", tier: "emocional",
    basePriority: 60, minStreak: 2,
    action: { labelKey: "care_action_chat", href: "/insights" },
    describe: (s, lang) => tt(lang, "care_mood_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => consecutiveBad(
      ctx.checkIns
        .filter((c) => (c.mood_tags?.length ?? 0) > 0)
        .map((c) => ({ bad: NEGATIVE_MOODS.has(c.mood_tags[0]) }))
    ),
  },
  {
    id: "social", emoji: "🗣️", titleKey: "care_social_title", tier: "emocional",
    basePriority: 58, minStreak: 4,
    // Comunidade está oculta (redireciona pra home); aponta pro check-in, onde
    // a pergunta "conversei pessoalmente com alguém" é respondida.
    action: { labelKey: "care_action_checkin", href: "/check-in" },
    describe: (s, lang) => tt(lang, "care_social_desc", { dias: diasStr(s, lang) }),
    compute: (ctx) => consecutiveBad(ctx.checkIns.map((c) => ({ bad: c.talked_to_someone === false }))),
  },
];

function detectCare(ctx: SignalContext, lang: Lang): Signal[] {
  const signals: Signal[] = [];
  for (const def of CARE_DEFS) {
    const streak = def.compute(ctx);
    if (streak < def.minStreak) continue;
    signals.push({
      id: def.id,
      tier: def.tier,
      weight: weightFor(def.basePriority, streak),
      priority: 0,
      streak,
      emoji: def.emoji,
      title: tt(lang, def.titleKey),
      description: def.describe(streak, lang),
      action: def.action ? { label: tt(lang, def.action.labelKey), href: def.action.href } : undefined,
      feed: ["care"],
    });
  }
  signals.sort((a, b) => b.weight - a.weight);
  return signals;
}

// ── Nudge: triggers de contexto/planejamento (sem sleep/mood/burnout, que são
//    derivados dos sinais de care/plan no merge). ───────────────────────────────

function detectNudge(ctx: SignalContext, firstName: string, gender: string, lang: Lang): Signal[] {
  const checks = ctx.checkIns;
  const activeGoals = ctx.goals;
  const todayTx = ctx.financial;
  const lastDiaryDate = ctx.lastDiaryDate;
  const currentPlan = ctx.currentPlan;
  const today = ctx.today;

  const greet = saludo(firstName, lang);
  const andWord = lang === "es" ? " y " : lang === "en" ? " and " : " e ";

  const hasTodayCheckIn = checks.length > 0 && checks[0]?.date === today;
  const results: Signal[] = [];

  // ── STREAK IN RISK ──
  if (checks.length >= 3 && !hasTodayCheckIn) {
    let streak = 0;
    const todayDate = new Date(today + "T12:00:00");
    for (let i = 0; i < checks.length; i++) {
      const checkDate = new Date(checks[i].date + "T12:00:00");
      const expected = new Date(todayDate);
      expected.setDate(expected.getDate() - i);
      if (checkDate.getTime() === expected.getTime()) streak++;
      else break;
    }
    if (streak >= 5) {
      results.push({
        id: "streak_risk", tier: "contexto", weight: 0, priority: 1, streak,
        emoji: "🔥", title: "Sequência em risco",
        description: `Você está há ${streak} dias sem falhar no check-in e ainda não fez o de hoje.`,
        message: tt(lang, pick(["nudge_streak_1", "nudge_streak_2", "nudge_streak_3"]), { greet, dias: diasStr(streak, lang) }),
        action: { label: tt(lang, "nudge_action_checkin"), href: "/check-in" },
        feed: ["nudge"],
      });
    }
  }

  // ── DIARY ABANDONED ──
  if (lastDiaryDate) {
    const lastDiary = new Date(lastDiaryDate + "T12:00:00");
    const now = new Date(today + "T12:00:00");
    const daysSince = Math.floor((now.getTime() - lastDiary.getTime()) / 86_400_000);
    if (daysSince >= 5) {
      results.push({
        id: "diary_abandoned", tier: "emocional", weight: 0, priority: 3, streak: daysSince,
        emoji: "📖", title: "Diário parado",
        description: `Faz ${daysSince} dias que você não escreve no diário.`,
        message: tt(lang, pick(["nudge_diary_1", "nudge_diary_2", "nudge_diary_3"]), { greet, dias: diasStr(daysSince, lang) }),
        action: { label: tt(lang, "nudge_action_diary"), href: "/diario/novo" },
        feed: ["nudge"],
      });
    }
  }

  // ── GOAL STAGNATION ──
  if (activeGoals.length > 0) {
    const nowDate = new Date();
    for (const g of activeGoals) {
      const stages = (g.goal_stages as any[]) || [];
      const timestamps = [new Date(g.updated_at).getTime()];
      for (const s of stages) timestamps.push(new Date(s.updated_at).getTime());
      const lastActive = Math.max(...timestamps);
      const daysInactive = Math.floor((nowDate.getTime() - lastActive) / 86_400_000);
      if (daysInactive >= 7) {
        const rawTitle: string = g.title || "";
        const summary = rawTitle
          .replace(/\d+\s*(kg|kilos|quilos|meses|dias|semanas)/gi, "")
          .replace(/em\s+\d+\s+\w+/gi, "")
          .replace(/[\(\)]/g, "")
          .trim()
          .slice(0, 40) || "melhorar";
        results.push({
          id: "goal_stale", tier: "planejamento", weight: 0, priority: 3, streak: daysInactive,
          emoji: "🎯", title: "Meta parada",
          description: `Sua meta de ${summary} está parada há ${daysInactive} dias.`,
          message: tt(lang, pick(["nudge_goal_1", "nudge_goal_2", "nudge_goal_3"]), { greet, meta: summary, dias: diasStr(daysInactive, lang) }),
          action: { label: tt(lang, "nudge_action_goals"), href: "/agenda" },
          feed: ["nudge"],
        });
        break; // só o primeiro gol estagnado
      }
    }
  }

  // ── SPENDING ALERT ──
  const totalSpent = todayTx.filter((t: any) => t.type === "despesa").reduce((s: number, t: any) => s + (t.amount || 0), 0);
  if (totalSpent > SPENDING_THRESHOLD) {
    const valor = totalSpent.toFixed(0).replace(".", ",");
    results.push({
      id: "spending", tier: "contexto", weight: 0, priority: 4, streak: 0,
      emoji: "💰", title: "Gastos",
      description: `Você já gastou R$ ${valor} este mês.`,
      message: tt(lang, pick(["nudge_spending_1", "nudge_spending_2", "nudge_spending_3"]), { greet, valor }),
      action: { label: tt(lang, "nudge_action_financas"), href: "/financas" },
      feed: ["nudge"],
    });
  }

  // ── PLAN: OVERDUE TASKS ──
  if (currentPlan) {
    const weekTasks = (currentPlan.weekly_tasks || []) as any[];
    const todayDow = new Date(today + "T12:00:00").getDay();
    const todayIdx = todayDow === 0 ? 6 : todayDow - 1;
    const overdue = weekTasks.filter((t: any) =>
      t.day_of_week != null && t.day_of_week >= 0 &&
      t.day_of_week < todayIdx &&
      t.status !== "concluida"
    );
    if (overdue.length > 0) {
      const names = overdue.slice(0, 2).map((t: any) => `"${t.title.slice(0, 30)}"`).join(andWord);
      const extra = overdue.length > 2
        ? (lang === "es" ? ` y ${overdue.length - 2} más` : lang === "en" ? ` and ${overdue.length - 2} more` : ` e mais ${overdue.length - 2}`)
        : "";
      const nomes = `${names}${extra}`;
      results.push({
        id: "plan_overdue", tier: "planejamento", weight: 0, priority: 1, streak: overdue.length,
        emoji: "📌", title: "Tarefas atrasadas",
        description: `${overdue.length} tarefa${overdue.length > 1 ? "s" : ""} pendente${overdue.length > 1 ? "s" : ""} de dias anteriores: ${nomes}.`,
        message: tt(lang, pick(["nudge_overdue_1", "nudge_overdue_2", "nudge_overdue_3"]), {
          greet,
          tarefas: temTarefas(overdue.length, lang),
          nomes,
          ficaram: ficaramWord(overdue.length, lang),
          feito: feitoWord(overdue.length, lang),
          nao_culpa: naoCulpa(overdue.length, lang),
        }),
        action: { label: tt(lang, "nudge_action_plan"), href: "/agenda?tab=semana" },
        feed: ["nudge"],
      });
    }
  }

  // ── PLAN: EMPTY WEEK ──
  if (!currentPlan || ((currentPlan.weekly_tasks || []) as any[]).length === 0) {
    const dow = new Date(today + "T12:00:00").getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) {
      results.push({
        id: "plan_empty_weekend", tier: "planejamento", weight: 0, priority: 3, streak: 0,
        emoji: "🗓️", title: "Semana sem plano",
        description: `Fim de semana chegando e nenhum plano semanal criado.`,
        message: tt(lang, pick(["nudge_empty_weekend_1", "nudge_empty_weekend_2", "nudge_empty_weekend_3"]), { greet, perdido: perdidoWord(gender, lang) }),
        action: { label: tt(lang, "nudge_action_plan_week"), href: "/agenda?tab=semana" },
        feed: ["nudge"],
      });
    }
  }

  // ── PLAN: PROCRASTINATION ──
  if (currentPlan) {
    const weekTasks = (currentPlan.weekly_tasks || []) as any[];
    const doneTasks = weekTasks.filter((t: any) => t.status === "concluida");
    const total = weekTasks.length;
    const pct = total > 0 ? Math.round((doneTasks.length / total) * 100) : 0;
    const dow3 = new Date(today + "T12:00:00").getDay();
    const undoneTasks = weekTasks.filter((t: any) => t.status !== "concluida");
    if (dow3 >= 3 && dow3 <= 5 && total >= 5 && pct < 30) {
      results.push({
        id: "plan_procrastination", tier: "planejamento", weight: 0, priority: 2, streak: 0,
        emoji: "⏳", title: "Semana atrasada",
        description: `Já é ${["quarta", "quinta", "sexta"][dow3 - 3]}-feira e só ${pct}% da semana foi concluído.`,
        message: tt(lang, pick(["nudge_procrast_1", "nudge_procrast_2", "nudge_procrast_3"]), {
          greet,
          dia: diaSemana(dow3, lang),
          pct: String(pct),
          n: String(undoneTasks.length),
        }),
        action: { label: tt(lang, "nudge_action_week"), href: "/agenda?tab=semana" },
        feed: ["nudge"],
      });
    }
    if (dow3 === 6 || dow3 === 0) {
      if (total >= 3 && pct === 0) {
        results.push({
          id: "plan_week_wasted", tier: "planejamento", weight: 0, priority: 2, streak: 0,
          emoji: "🌙", title: "Semana em branco",
          description: `Fim de semana e nada concluído essa semana.`,
          message: tt(lang, pick(["nudge_wasted_1", "nudge_wasted_2"]), { greet, junto: juntoWord(gender, lang) }),
          action: { label: tt(lang, "nudge_action_plan_next"), href: "/agenda?tab=semana" },
          feed: ["nudge"],
        });
      }
    }
  }

  // ── NO CHECK-IN TODAY ──
  if (!hasTodayCheckIn) {
    results.push({
      id: "checkin_miss", tier: "contexto", weight: 0, priority: 1, streak: 0,
      emoji: "👋", title: "Check-in pendente",
      description: `Você ainda não fez seu check-in hoje.`,
      message: tt(lang, pick(["nudge_checkin_miss_1", "nudge_checkin_miss_2", "nudge_checkin_miss_3"]), { greet }),
      action: { label: tt(lang, "nudge_action_checkin"), href: "/check-in" },
      feed: ["nudge"],
    });
  }

  return results;
}

// ── Plan: insights de planejamento (semana a semana) ──────────────────────────

const AREA_KEYS: Record<string, string> = {
  saude: "area_saude", carreira: "area_carreira", financas: "area_financas",
  relacionamentos: "area_relacionamentos", familia: "area_familia",
  desenvolvimento: "area_desenvolvimento", lazer: "area_lazer",
  espiritualidade: "area_espiritualidade", outros: "area_outros",
};

function areaLabel(key: string, lang: Lang): string {
  const k = AREA_KEYS[key];
  return k ? tt(lang, k) : key;
}

interface WeekData {
  weekStart: string;
  tasks: any[];
  doneByArea: Record<string, number>;
  totalByArea: Record<string, number>;
  totalDone: number;
  totalTasks: number;
}

function computeAreaStats(tasks: any[]) {
  const doneByArea: Record<string, number> = {};
  const totalByArea: Record<string, number> = {};
  let totalDone = 0;
  for (const t of tasks) {
    const area = t.area || "outros";
    totalByArea[area] = (totalByArea[area] || 0) + 1;
    if (t.status === "concluida") {
      doneByArea[area] = (doneByArea[area] || 0) + 1;
      totalDone++;
    }
  }
  return { doneByArea, totalByArea, totalDone, totalTasks: tasks.length };
}

function detectPlan(
  current: WeekData,
  history: WeekData[],
  activeGoals: any[],
  sleepLogs: any[],
  lang: Lang,
): Signal[] {
  const results: Signal[] = [];

  // ── OVERLOAD ──
  const areasWithTasks = Object.keys(current.totalByArea).filter((k) => current.totalByArea[k] > 0);
  const historicalAreaAvg = history.length > 0
    ? history.reduce((sum, w) => sum + Object.keys(w.totalByArea).filter((k) => w.totalByArea[k] > 0).length, 0) / history.length
    : 3;

  if (areasWithTasks.length > historicalAreaAvg + 1 && areasWithTasks.length >= 5) {
    const narrowWeeks = history.filter((w) => Object.keys(w.totalByArea).filter((k) => w.totalByArea[k] > 0).length <= 3);
    const wideWeeks = history.filter((w) => Object.keys(w.totalByArea).filter((k) => w.totalByArea[k] > 0).length >= 5);
    const narrowRate = narrowWeeks.length > 0
      ? Math.round(narrowWeeks.reduce((s, w) => s + (w.totalTasks > 0 ? w.totalDone / w.totalTasks : 0), 0) / narrowWeeks.length * 100)
      : 70;
    const wideRate = wideWeeks.length > 0
      ? Math.round(wideWeeks.reduce((s, w) => s + (w.totalTasks > 0 ? w.totalDone / w.totalTasks : 0), 0) / wideWeeks.length * 100)
      : 40;
    const diff = narrowRate - wideRate;
    if (diff >= 15) {
      results.push({
        id: "overload", tier: "planejamento", weight: 0, priority: 1, streak: 0,
        emoji: "🧭", title: "Muitas áreas",
        description: tt(lang, "plan_overload_desc", { n: String(areasWithTasks.length), diff: String(diff) }),
        action: { label: tt(lang, "plan_overload_action"), href: "/agenda?tab=semana" },
        feed: ["plan"],
      });
    }
  }

  // ── ABANDONED AREA ──
  const historicalAreas = new Set<string>();
  for (const w of history) {
    for (const k of Object.keys(w.totalByArea)) {
      if (w.totalByArea[k] > 0) historicalAreas.add(k);
    }
  }
  const abandoned = [...historicalAreas].filter((a) => !current.totalByArea[a] && a !== "outros");
  if (abandoned.length > 0) {
    results.push({
      id: "abandoned", tier: "planejamento", weight: 0, priority: 2, streak: 0,
      emoji: "🕳️", title: "Área de fora",
      description: tt(lang, "plan_abandoned_desc", {
        area: areaLabel(abandoned[0], lang),
        e_area: abandoned.length > 1
          ? (lang === "es" ? ` y ${areaLabel(abandoned[1], lang)}` : lang === "en" ? ` and ${areaLabel(abandoned[1], lang)}` : ` e ${areaLabel(abandoned[1], lang)}`)
          : "",
        ficaram: ficaramWord(abandoned.length, lang),
      }),
      action: { label: tt(lang, "plan_abandoned_action"), href: "/agenda?tab=semana" },
      feed: ["plan"],
    });
  }

  // ── ORPHAN GOAL ──
  if (activeGoals.length > 0) {
    const linkedGoalIds = new Set(current.tasks.filter((t: any) => t.linked_goal_id).map((t: any) => t.linked_goal_id));
    const orphanGoals = activeGoals.filter((g: any) => !linkedGoalIds.has(g.id));
    if (orphanGoals.length > 0) {
      const g = orphanGoals[0];
      results.push({
        id: "orphan_goal", tier: "planejamento", weight: 0, priority: 2, streak: 0,
        emoji: "🎯", title: "Meta órfã",
        description: tt(lang, "plan_orphan_desc", { meta: (g.title || "").slice(0, 40) }),
        action: { label: tt(lang, "plan_orphan_action"), href: "/agenda?tab=metas" },
        feed: ["plan"],
      });
    }
  }

  // ── IMBALANCE ──
  if (current.totalTasks >= 5) {
    const areaEntries = Object.entries(current.totalByArea)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
    const total = areaEntries.reduce((s, [, v]) => s + v, 0);
    const top = areaEntries[0];
    if (top && total > 0 && top[1] / total > 0.4) {
      results.push({
        id: "imbalance", tier: "planejamento", weight: 0, priority: 1, streak: 0,
        emoji: "⚖️", title: "Semana desequilibrada",
        description: tt(lang, "plan_imbalance_desc", { area: areaLabel(top[0], lang), pct: String(Math.round(top[1] / total * 100)) }),
        action: { label: tt(lang, "plan_imbalance_action"), href: "/agenda?tab=semana" },
        feed: ["plan"],
      });
    }
  }

  // ── POSITIVE TREND ──
  for (const area of Object.keys(current.totalByArea)) {
    if (!current.totalByArea[area] || area === "outros") continue;
    const pct = current.totalByArea[area] > 0 ? (current.doneByArea[area] || 0) / current.totalByArea[area] : 0;
    const historicalDone = history.filter((w) => w.totalByArea[area] > 0);
    const allFull = historicalDone.length >= 2 && historicalDone.every((w) => (w.totalByArea[area] || 0) > 0 && (w.doneByArea[area] || 0) === (w.totalByArea[area] || 0));
    if (allFull && pct >= 0.8) {
      results.push({
        id: "streak", tier: "planejamento", weight: 0, priority: 3, streak: 0,
        emoji: "👏", title: "Disciplina",
        description: tt(lang, "plan_streak_desc", { area: areaLabel(area, lang), semanas: String(historicalDone.length + 1) }),
        feed: ["plan"],
      });
      break;
    }
  }

  // ── NEGATIVE TREND ──
  for (const area of Object.keys(current.totalByArea)) {
    if (!current.totalByArea[area] || area === "outros") continue;
    const consecutiveLow = history.filter((w) => w.totalByArea[area] > 0 && (w.doneByArea[area] || 0) === 0);
    if (consecutiveLow.length >= 2 && (current.doneByArea[area] || 0) === 0) {
      results.push({
        id: "decline", tier: "planejamento", weight: 0, priority: 2, streak: 0,
        emoji: "📉", title: "Área não executada",
        description: tt(lang, "plan_decline_desc", { area: areaLabel(area, lang), semanas: String(consecutiveLow.length + 1) }),
        action: { label: tt(lang, "plan_decline_action"), href: "/agenda?tab=semana" },
        feed: ["plan"],
      });
      break;
    }
  }

  // ── BURNOUT RISK (também alimenta o nudge) ──
  const badSleep = sleepLogs.filter((s: any) => s.quality != null && s.quality <= 2).length;
  const growthTasks = current.tasks.filter((t: any) => t.task_type === "crescimento" && t.status !== "concluida").length;
  if (badSleep >= 2 && growthTasks >= 3) {
    results.push({
      id: "burnout_risk", tier: "planejamento", weight: 0, priority: 1, streak: badSleep,
      emoji: "🪫", title: "Risco de burnout",
      description: tt(lang, "plan_burnout_desc", { noites: String(badSleep), n_tarefas: String(growthTasks) }),
      action: { label: tt(lang, "plan_burnout_action"), href: "/insights" },
      feed: ["plan", "nudge"],
    });
  }

  return results;
}

function calculateMetrics(current: WeekData, history: WeekData[], lang: Lang): PlanAnalytics {
  const areaEntries = Object.entries(current.totalByArea).filter(([, v]) => v > 0);
  const total = areaEntries.reduce((s, [, v]) => s + v, 0);

  let strongest = "—";
  let weakest = "—";
  let bestPct = -1;
  let worstPct = Infinity;
  for (const [key, tot] of Object.entries(current.totalByArea)) {
    if (key === "outros" || tot === 0) continue;
    const pct = (current.doneByArea[key] || 0) / tot;
    if (pct > bestPct) { bestPct = pct; strongest = areaLabel(key, lang); }
    if (pct < worstPct) { worstPct = pct; weakest = areaLabel(key, lang); }
  }

  let balance = 50;
  const areaCount = areaEntries.length;
  if (areaCount > 0 && total > 0) {
    const ideal = 1 / areaCount;
    const deviations = areaEntries.map(([, v]) => Math.abs(v / total - ideal));
    const avgDeviation = deviations.reduce((s, d) => s + d, 0) / areaCount;
    balance = Math.round(Math.max(0, 100 - avgDeviation * 200));
  }

  let variation = 0;
  if (history.length > 0 && current.totalTasks > 0) {
    const lastWeek = history[0];
    if (lastWeek.totalTasks > 0) {
      variation = Math.round((current.totalTasks - lastWeek.totalTasks) / lastWeek.totalTasks * 100);
    }
  }

  return { strongest, weakest, balance, variation };
}

// ── Merge + dedup ──────────────────────────────────────────────────────────────

/** Sinais de care/nudge que também alimentam nudge (derivados no merge). */
function nudgeMessageFor(id: string, greet: string, gender: string, streak: number, lang: Lang): string | undefined {
  switch (id) {
    case "sleep":
      return tt(lang, pick(["nudge_sleep_1", "nudge_sleep_2", "nudge_sleep_3"]), { greet, dias: diasStr(streak, lang) });
    case "mood":
      return tt(lang, pick(["nudge_mood_1", "nudge_mood_2", "nudge_mood_3"]), { greet, sozinho: sozinhoWord(gender, lang) });
    default:
      return undefined;
  }
}

function mergeSignals(care: Signal[], nudge: Signal[], plan: Signal[], firstName: string, gender: string, lang: Lang): Signal[] {
  const byId = new Map<string, Signal>();

  for (const s of care) {
    byId.set(s.id, { ...s });
    // Sono e humor também alimentam o nudge (mesmo fato = um sinal).
    if (s.id === "sleep" || s.id === "mood") {
      byId.get(s.id)!.feed = ["care", "nudge"];
      byId.get(s.id)!.priority = 2;
      byId.get(s.id)!.message = nudgeMessageFor(s.id, saludo(firstName, lang), gender, s.streak, lang);
    }
  }

  for (const s of nudge) {
    byId.set(s.id, { ...s });
  }

  for (const s of plan) {
    if (byId.has(s.id)) {
      const existing = byId.get(s.id)!;
      existing.feed = [...new Set([...existing.feed, ...s.feed])];
      existing.description = s.description;
      existing.emoji = s.emoji;
      existing.title = s.title;
      existing.action = s.action ?? existing.action;
      existing.streak = s.streak;
      // burnout_risk também gera nudge: prioridade 2 + template próprio.
      if (s.id === "burnout_risk") {
        existing.priority = 2;
        existing.message = tt(lang, pick(["nudge_burnout_1", "nudge_burnout_2", "nudge_burnout_3"]), { greet: saludo(firstName, lang) });
      }
      byId.set(s.id, existing);
    } else {
      byId.set(s.id, { ...s });
    }
  }

  return [...byId.values()];
}

// ── Compute principal ──────────────────────────────────────────────────────────

export async function computeSignals(
  userId: string,
  profile?: { firstName?: string; gender?: string; language?: string },
  opts?: { weekStart?: string },
): Promise<SignalResult> {
  const admin = getSupabaseAdmin();
  const today = getLocalDate();
  const weekStart = opts?.weekStart || getWeekMondayDate();
  const firstName = profile?.firstName || "";
  const gender = profile?.gender || "nao_dizer";
  const lang: Lang = (profile?.language as Lang) || "pt";

  // 5 semanas: atual + 4 anteriores.
  const weekStarts: string[] = [];
  const d = new Date(weekStart + "T12:00:00");
  for (let i = 0; i < 5; i++) {
    const mon = new Date(d);
    mon.setDate(d.getDate() - i * 7);
    weekStarts.push(`${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`);
  }

  const [
    { data: checkIns },
    { data: sleepLogs },
    { data: meals },
    { data: goals },
    { data: financial },
    { data: lastDiary },
    { data: prefs },
    currentPlanRes,
    ...planRes
  ] = await Promise.all([
    admin.from("check_ins").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(LOOKBACK_ROWS),
    admin.from("sleep_logs").select("date, quality, duration_min").eq("user_id", userId).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(LOOKBACK_ROWS * 2),
    admin.from("meals").select("data_hora, classificacao").eq("user_id", userId).order("data_hora", { ascending: false }).limit(120),
    admin.from("goals").select("*, goal_stages(*)").eq("user_id", userId).eq("status", "ativa").order("created_at", { ascending: true }),
    admin.from("financial_transactions").select("amount, type").eq("user_id", userId).gte("date", `${today.slice(0, 7)}-01`).lte("date", `${today.slice(0, 7)}-31`),
    admin.from("diary_entries").select("date").eq("user_id", userId).order("date", { ascending: false }).limit(1),
    admin.from("user_preferences").select("context").eq("user_id", userId).single(),
    admin.from("weekly_plans").select("*, weekly_tasks(*)").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    ...weekStarts.slice(1).map((ws) =>
      admin.from("weekly_plans").select("*, weekly_tasks(*)").eq("user_id", userId).eq("week_start", ws).maybeSingle()
    ),
  ]);

  // Dedup de sono por data (mais de uma fonte por dia).
  const seenSleepDates = new Set<string>();
  const dedupedSleep: any[] = [];
  for (const s of (sleepLogs ?? []) as any[]) {
    if (seenSleepDates.has(s.date)) continue;
    seenSleepDates.add(s.date);
    dedupedSleep.push(s);
  }

  const ctx: SignalContext = {
    checkIns: (checkIns ?? []) as any[],
    sleepLogs: dedupedSleep,
    meals: (meals ?? []) as any[],
    goals: (goals ?? []) as any[],
    financial: (financial ?? []) as any[],
    lastDiaryDate: (lastDiary?.[0]?.date as string) ?? null,
    currentPlan: currentPlanRes.data ?? null,
    planHistory: planRes.map((r) => r.data).filter(Boolean) as any[],
    hasMedication: (prefs?.context as any)?.has_medication === true,
    today,
  };

  // ── Semana atual + histórico para os sinais de planejamento ──
  const buildWeek = (plan: any | null, ws: string): WeekData => {
    const tasks = (plan?.weekly_tasks || []) as any[];
    const stats = computeAreaStats(tasks);
    return { weekStart: ws, tasks, ...stats };
  };
  const current = buildWeek(ctx.currentPlan, weekStart);
  const history = ctx.planHistory
    .map((plan, i) => buildWeek(plan, weekStarts[i + 1]))
    .filter((w) => w.totalTasks > 0);

  const care = detectCare(ctx, lang);
  const nudge = detectNudge(ctx, firstName, gender, lang);
  const plan = detectPlan(current, history, ctx.goals, ctx.sleepLogs, lang);

  const signals = mergeSignals(care, nudge, plan, firstName, gender, lang);
  const metrics = calculateMetrics(current, history, lang);

  return { signals, plan: metrics };
}
