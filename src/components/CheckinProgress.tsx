"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { CheckIn } from "@/types";
import { useTranslation } from "@/lib/useTranslation";

const HABIT_CHIP: Record<string, [string, string]> = {
  took_medication: ["💊", "cp_habit_remedios"],
  talked_to_someone: ["🗣️", "cp_habit_conversa"],
  meditation_prayer_breathing: ["🧘", "cp_habit_pausa"],
  meditation: ["🧘", "cp_habit_meditou"],
  prayer: ["🙏", "cp_habit_orou"],
  breathing: ["🌬️", "cp_habit_respirou"],
  creative_activity: ["🎨", "cp_habit_criatividade"],
  ate_well: ["🍽️", "cp_habit_comeu_bem"],
  bowel_movement: ["🚽", "cp_habit_banheiro"],
  exercise_walk: ["🏃", "cp_habit_caminhou"],
  walked: ["🚶", "cp_habit_caminhou"],
  ran: ["🏃", "cp_habit_correu"],
  strength_training: ["🏋️", "cp_habit_musculacao"],
  read: ["📖", "cp_habit_leu"],
  slept_well: ["😴", "cp_habit_sono"],
  did_something_enjoyable: ["😊", "cp_habit_gostou"],
  worked_on_goals: ["🎯", "cp_habit_metas"],
};

interface CheckinProgressProps {
  todayCheckIn: CheckIn;
  enabledNonSuicidal: string[];
  positivePct: number;
  positiveCount: number;
  totalHabits: number;
}

export function CheckinProgress({
  todayCheckIn,
  enabledNonSuicidal,
  positivePct,
  positiveCount,
  totalHabits,
}: CheckinProgressProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const waterLabel = (() => {
    const ml = (todayCheckIn.water_cups ?? 0) * 250;
    if (ml === 0) return "0ml";
    if (ml < 1000) return `${ml}ml`;
    return `${(ml / 1000).toFixed(1).replace(".0", "")}L`;
  })();

  const completedHabitsChips = enabledNonSuicidal
    .filter(
      (k) =>
        k !== "drank_water" &&
        (todayCheckIn as unknown as Record<string, unknown>)[k] === true
    )
    .map((k) => ({
      emoji: HABIT_CHIP[k]?.[0] ?? "•",
      value: HABIT_CHIP[k]?.[1] ? t(HABIT_CHIP[k][1]) : k,
    }));

  return (
    <div className="px-3.5 pt-5">
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <p
          className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "#A78BFA" }}
        >
          {t("cuidados_de_hoje")}
        </p>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#A78BFA" }}>
          {positivePct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-1 mb-3">
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 10, background: "var(--surface-3)" }}
        >
          <div
            className="h-full rounded-full relative overflow-hidden"
            style={{
              width: `${positivePct}%`,
              background: "linear-gradient(90deg, #7C5CFF, #A78BFA)",
              boxShadow: "0 0 8px rgba(124,92,255,0.4)",
              transition: "width 0.7s ease",
            }}
          >
            {/* Nitro shimmer */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background:
                  "linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
                animation: "nitroShimmer 2.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>
        <p className="m-0 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          {t(positiveCount === 1 ? "cp_cuidado_feito" : "cp_cuidados_feitos", { n: String(positiveCount) })} · {t(totalHabits - positiveCount === 1 ? "dash_pendente" : "dash_pendentes", { n: String(totalHabits - positiveCount) })}
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--surface-border)",
            color: "#e0d6ff",
          }}
        >
          💧 {waterLabel}
        </span>
        {completedHabitsChips.map(({ emoji, value }) => (
          <span
            key={value}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--surface-border)",
              color: "#e0d6ff",
            }}
          >
            {emoji} {value}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push("/check-in")}
        className="mt-2.5 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[12px] font-semibold"
        style={{ color: "#A78BFA" }}
      >
        <Pencil className="w-3 h-3" />
        {t("cp_editar_checkin")}
      </button>

      {/* Nitro shimmer keyframes */}
      <style>{`
        @keyframes nitroShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
