import type { CheckIn } from "@/types";
import { calculateStreak, formatLocalDate } from "@/lib/utils";
import { answeredKeys } from "@/lib/checkin-answered";

export interface AchievementDef {
  type: string;
  label: string;
  icon: string;
  tier: number;
  description: string;
}

export const ACHIEVEMENTS_BY_TYPE: Record<string, Omit<AchievementDef, "tier"> & { tiers: number[] }> = {
  first_checkin: {
    type: "first_checkin",
    label: "Primeiro passo",
    icon: "🌱",
    tiers: [1],
    description: "Fez seu primeiro check-in",
  },
  streak: {
    type: "streak",
    label: "Sequencia",
    icon: "🔥",
    tiers: [3, 7, 14, 30, 60, 90],
    description: "{N} dias consecutivos de check-in",
  },
  all_habits: {
    type: "all_habits",
    label: "Dia perfeito",
    icon: "⭐",
    tiers: [1],
    description: "Marcou todos os habitos positivos em um dia",
  },
  week_complete: {
    type: "week_complete",
    label: "Semana cheia",
    icon: "📅",
    tiers: [1],
    description: "Check-in todos os dias por uma semana",
  },
  total_checkins: {
    type: "total_checkins",
    label: "Marco",
    icon: "🏆",
    tiers: [10, 50, 100],
    description: "{N} check-ins registrados",
  },
};


function hasWeekComplete(checkIns: CheckIn[]): boolean {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = formatLocalDate(d);
    if (!checkIns.some((ci) => ci.date === dateStr)) return false;
  }
  return true;
}

export function detectNewAchievements(
  checkIns: CheckIn[],
  enabledKeys: string[],
  existingAchievements: { achievement_type: string; tier: number }[]
): AchievementDef[] {
  const unlocked: AchievementDef[] = [];

  const add = (def: Omit<AchievementDef, "tier">, tier: number) => {
    const key = `${def.type}:${tier}`;
    if (
      !existingAchievements.some(
        (a) => a.achievement_type === def.type && a.tier === tier
      )
    ) {
      unlocked.push({
        ...def,
        tier,
        description: def.description.replace("{N}", String(tier)),
      });
    }
  };

  // first check-in
  if (checkIns.length >= 1) {
    add(ACHIEVEMENTS_BY_TYPE.first_checkin, 1);
  }

  // streak tiers
  const streak = calculateStreak(checkIns.map((c) => c.date));
  for (const tier of ACHIEVEMENTS_BY_TYPE.streak.tiers) {
    if (streak >= tier) {
      add(ACHIEVEMENTS_BY_TYPE.streak, tier);
    }
  }

  // total check-ins tiers
  for (const tier of ACHIEVEMENTS_BY_TYPE.total_checkins.tiers) {
    if (checkIns.length >= tier) {
      add(ACHIEVEMENTS_BY_TYPE.total_checkins, tier);
    }
  }

  // all habits day — só conta hábitos efetivamente respondidos (pulado ≠ não feito)
  const habitKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged");
  if (
    checkIns.some((ci) => {
      const answered = answeredKeys(ci, habitKeys);
      return answered.length > 0 && answered.every((k) => (ci as Record<string, unknown>)[k] === true);
    })
  ) {
    add(ACHIEVEMENTS_BY_TYPE.all_habits, 1);
  }

  // week complete
  if (hasWeekComplete(checkIns)) {
    add(ACHIEVEMENTS_BY_TYPE.week_complete, 1);
  }

  return unlocked;
}
