import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  NEGATIVE_MOODS,
  SLEEP_QUALITY_MIN,
  SLEEP_MIN_MINUTES,
  WATER_GOAL_CUPS,
  BAD_MEAL_CLASSIFICATIONS,
} from "@/lib/maya-constants";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type CareSignalTier = "biologico" | "fisico" | "emocional";

export interface CareSignal {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tier: CareSignalTier;
  /** Dias consecutivos abaixo do mínimo (sem teto — usado na descrição). */
  streak: number;
  /** Peso ranqueável = base × (1 + min(streak, teto)). */
  weight: number;
  action?: { label: string; href: string };
}

// ── Constantes (defaults informados por evidência — NÃO são limiares clínicos) ──
// Ordem confirmada com o usuário: biológico → físico → emocional/social.

const STREAK_CAP = 5;      // saturação do peso por negligência
const LOOKBACK_ROWS = 16;  // nº de registros recentes analisados por sinal

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Conta registros "ruins" consecutivos a partir do mais recente.
 *  A lista já vem ordenada do mais recente para o mais antigo. */
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

function plural(n: number, singular: string, pluralSuffix = "s"): string {
  return `${n} ${n === 1 ? singular : singular + pluralSuffix}`;
}

// ── Definição dos sinais ───────────────────────────────────────────────────────

interface SignalContext {
  checkIns: any[];       // ordenado por date desc
  sleepLogs: any[];      // ordenado por date desc (dedup por data)
  meals: any[];          // ordenado por data_hora desc
  hasMedication: boolean;
}

interface SignalDef {
  id: string;
  emoji: string;
  title: string;
  tier: CareSignalTier;
  basePriority: number;
  minStreak: number;
  action?: { label: string; href: string };
  describe: (streak: number) => string;
  compute: (ctx: SignalContext) => number; // devolve o streak (0 = não dispara)
}

const SIGNAL_DEFS: SignalDef[] = [
  {
    id: "medication",
    emoji: "💊",
    title: "Medicação",
    tier: "biologico",
    basePriority: 95,
    minStreak: 1,
    action: { label: "Marcar no check-in", href: "/check-in" },
    describe: (s) => `Você deixou de tomar seus remédios nos últimos ${plural(s, "dia")}.`,
    compute: (ctx) => {
      if (!ctx.hasMedication) return 0;
      return consecutiveBad(ctx.checkIns.map((c) => ({ bad: c.took_medication === false })));
    },
  },
  {
    id: "sleep",
    emoji: "😴",
    title: "Sono",
    tier: "biologico",
    basePriority: 90,
    minStreak: 2,
    action: { label: "Registrar sono", href: "/sono" },
    describe: (s) => `Seu sono tem ficado curto ou ruim nos últimos ${plural(s, "dia")}.`,
    compute: (ctx) => {
      const records = ctx.sleepLogs
        .map((log) => {
          const q = log.quality as number | null;
          const d = log.duration_min as number | null;
          if (q == null && d == null) return null;
          return {
            bad: (q != null && q < SLEEP_QUALITY_MIN) || (d != null && d < SLEEP_MIN_MINUTES),
          };
        })
        .filter((r): r is { bad: boolean } => r != null);
      return consecutiveBad(records);
    },
  },
  {
    id: "hydration",
    emoji: "💧",
    title: "Água",
    tier: "biologico",
    basePriority: 80,
    minStreak: 2,
    action: { label: "Marcar água", href: "/check-in" },
    describe: (s) => `Você tem bebido menos de 1 litro de água por dia nos últimos ${plural(s, "dia")}.`,
    compute: (ctx) =>
      consecutiveBad(ctx.checkIns.map((c) => ({ bad: (c.water_cups ?? 0) < WATER_GOAL_CUPS }))),
  },
  {
    id: "nutrition",
    emoji: "🍬",
    title: "Alimentação",
    tier: "biologico",
    basePriority: 75,
    minStreak: 3,
    action: { label: "Registrar refeição", href: "/nutricao/registrar" },
    describe: (s) => `Refeições com muito açúcar, gordura ou sal em ${plural(s, "dia")} recente${s === 1 ? "" : "s"}.`,
    compute: (ctx) => {
      // Um dia é "ruim" se teve ≥1 refeição com classificação negativa.
      // Dias sem refeição analisada são ignorados (não contam, não quebram).
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
    id: "exercise",
    emoji: "🏃",
    title: "Movimento",
    tier: "fisico",
    basePriority: 65,
    minStreak: 4,
    action: { label: "Registrar atividade", href: "/corrida" },
    describe: (s) => `Você não tem se movimentado (caminhada, corrida ou musculação) há ${plural(s, "dia")}.`,
    compute: (ctx) =>
      consecutiveBad(
        ctx.checkIns.map((c) => ({
          bad: c.walked !== true && c.ran !== true && c.strength_training !== true && c.exercise_walk !== true,
        }))
      ),
  },
  {
    id: "mood",
    emoji: "🌧️",
    title: "Humor",
    tier: "emocional",
    basePriority: 60,
    minStreak: 2,
    action: { label: "Conversar com a Maya", href: "/insights" },
    describe: (s) => `Seu humor tem ficado mais pesado nos últimos ${plural(s, "dia")}.`,
    compute: (ctx) => {
      const records = ctx.checkIns
        .filter((c) => (c.mood_tags?.length ?? 0) > 0)
        .map((c) => ({ bad: NEGATIVE_MOODS.has(c.mood_tags[0]) }));
      return consecutiveBad(records);
    },
  },
  {
    id: "social",
    emoji: "🗣️",
    title: "Conexão",
    tier: "emocional",
    basePriority: 58,
    minStreak: 4,
    action: { label: "Ver comunidade", href: "/comunidade" },
    describe: (s) => `Você tem ficado sem conversar pessoalmente com alguém há ${plural(s, "dia")}.`,
    compute: (ctx) =>
      consecutiveBad(ctx.checkIns.map((c) => ({ bad: c.talked_to_someone === false }))),
  },
];

// ── Computação principal ───────────────────────────────────────────────────────

/**
 * Calcula os sinais de "negligência" do usuário e devolve a lista ranqueada
 * por peso (maior primeiro). Computado on-the-fly — sem tabela nova.
 *
 * Semântica de "streak": registros ruins consecutivos a partir do mais recente.
 * Cada sinal define o que é "ruim" a partir dos dados que o usuário registrou.
 */
export async function computeCareSignals(userId: string): Promise<CareSignal[]> {
  const admin = getSupabaseAdmin();

  const [
    { data: checkIns },
    { data: sleepLogs },
    { data: meals },
    { data: prefs },
  ] = await Promise.all([
    admin
      .from("check_ins")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(LOOKBACK_ROWS),
    admin
      .from("sleep_logs")
      .select("date, quality, duration_min")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LOOKBACK_ROWS * 2),
    admin
      .from("meals")
      .select("data_hora, classificacao")
      .eq("user_id", userId)
      .order("data_hora", { ascending: false })
      .limit(120),
    admin.from("user_preferences").select("context").eq("user_id", userId).single(),
  ]);

  // Dedup de sono por data (pode haver mais de uma fonte por dia)
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
    hasMedication: (prefs?.context as any)?.has_medication === true,
  };

  const signals: CareSignal[] = [];
  for (const def of SIGNAL_DEFS) {
    const streak = def.compute(ctx);
    if (streak < def.minStreak) continue;
    signals.push({
      id: def.id,
      emoji: def.emoji,
      title: def.title,
      description: def.describe(streak),
      tier: def.tier,
      streak,
      weight: weightFor(def.basePriority, streak),
      action: def.action,
    });
  }

  signals.sort((a, b) => b.weight - a.weight);
  return signals;
}
