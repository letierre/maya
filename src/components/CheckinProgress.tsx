"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { CheckIn } from "@/types";

const HABIT_CHIP: Record<string, [string, (ci: CheckIn) => string]> = {
  took_medication: ["💊", () => "Remédios"],
  talked_to_someone: ["🗣️", () => "Conversa"],
  meditation_prayer_breathing: ["🧘", () => "Pausa"],
  meditation: ["🧘", () => "Meditou"],
  prayer: ["🙏", () => "Orou"],
  breathing: ["🌬️", () => "Respirou"],
  creative_activity: ["🎨", () => "Criatividade"],
  ate_well: ["🍽️", () => "Comeu bem"],
  bowel_movement: ["🚽", () => "Banheiro"],
  exercise_walk: ["🏃", () => "Caminhou"],
  walked: ["🚶", () => "Caminhou"],
  ran: ["🏃", () => "Correu"],
  strength_training: ["🏋️", () => "Musculação"],
  read: ["📖", () => "Leu"],
  slept_well: ["😴", () => "Sono"],
  did_something_enjoyable: ["😊", () => "Gostou"],
  worked_on_goals: ["🎯", () => "Metas"],
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
      value: HABIT_CHIP[k]?.[1]?.(todayCheckIn) ?? k,
    }));

  return (
    <div className="px-3.5 pt-5">
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <p
          className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "#A78BFA" }}
        >
          Cuidados de hoje
        </p>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#A78BFA" }}>
          {positivePct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="px-1 mb-3">
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 10, background: "oklch(.25 .02 270)" }}
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
        <p className="m-0 mt-1 text-[10px]" style={{ color: "oklch(.55 .03 270)" }}>
          {positiveCount} cuidados feitos · {totalHabits - positiveCount} pendentes
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
          style={{
            background: "oklch(0.18 0.015 270)",
            borderColor: "oklch(0.28 0.02 270 / 0.5)",
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
              background: "oklch(0.18 0.015 270)",
              borderColor: "oklch(0.28 0.02 270 / 0.5)",
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
        Editar check-in
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
