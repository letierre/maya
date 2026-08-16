"use client";

import { getMoodLabel, getMoodById } from "@/lib/checkin-moods";
import { NEGATIVE_MOODS } from "@/lib/dashboard-constants";

function formatMood(moodId: string, gender: string): string {
  const chip = getMoodById(moodId);
  return chip ? getMoodLabel(chip, gender) : moodId;
}

export interface ThreadDay {
  date: string;
  label: string;
  sleepQuality: number | null;
  sleepHrs: number | null;
  cuidados: number | null;
  cuidadosTotal: number | null;
  mood_tags: string[];
  feeling: string;
  today: boolean;
}

interface RecentThreadProps {
  days: ThreadDay[];
  userGender: string;
}

export function RecentThread({ days, userGender }: RecentThreadProps) {
  const last3 = days.slice(-3).reverse(); // [today, yesterday, 2d ago]
  const labels = ["Hoje", "Ontem", "Anteontem"];

  return (
    <div className="px-3.5 pt-2">
      <div
        className="rounded-[18px] px-4 pt-4 pb-[18px] border"
        style={{
          background: "oklch(0.16 0.012 270)",
          borderColor: "oklch(0.28 0.02 270 / 0.5)",
        }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <p
            className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
            style={{ color: "#5EEAD4" }}
          >
            O Fio · últimos dias
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {last3.map((day, i) => {
            const isToday = i === 0;
            const moodTag = day.mood_tags?.[0];
            const extraMoods = (day.mood_tags?.length ?? 0) - 1;
            const dayScore =
              day.cuidados !== null && (day.cuidadosTotal ?? 0) > 0
                ? Math.round((day.cuidados / (day.cuidadosTotal ?? 1)) * 10)
                : null;

            const sq = day.sleepQuality;
            const sleepLabel = sq != null ? (sq >= 4 ? "🌙" : sq >= 3 ? "😐" : "😵") : "—";
            const sleepOpacity = sq != null ? 1 : 0.3;

            return (
              <div
                key={day.date}
                className="items-center px-2 py-1 rounded-lg"
                style={{
                  display: "grid",
                  gridTemplateColumns: "54px 20px 34px 80px 1fr",
                  gap: 6,
                  background: isToday ? "oklch(0.58 0.18 270 / .10)" : "transparent",
                  alignItems: "center",
                }}
              >
                <span
                  className="text-[11px] font-semibold tracking-tight"
                  style={{ color: isToday ? "#A78BFA" : "oklch(0.55 0.03 270)" }}
                >
                  {labels[i]}
                </span>

                <span className="text-[13px] leading-none text-center" style={{ opacity: sleepOpacity }}>
                  {sleepLabel}
                </span>

                <span
                  className="text-[12px] font-bold tabular-nums text-center"
                  style={{
                    color:
                      dayScore === null
                        ? "oklch(0.55 0.03 270)"
                        : dayScore >= 7
                          ? "#22D18B"
                          : dayScore >= 5
                            ? "#f59e0b"
                            : "#FF5C5C",
                  }}
                >
                  {dayScore !== null ? `${dayScore}/10` : "—"}
                </span>

                {/* Mood tag */}
                <span className="flex items-center">
                  {moodTag ? (
                    <span
                      className="px-1.5 py-px rounded-full text-[9.5px] font-semibold"
                      style={{
                        maxWidth: 74,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        background: NEGATIVE_MOODS.has(moodTag)
                          ? "oklch(.92 .05 30 / .25)"
                          : "oklch(.55 .18 270 / .2)",
                        color: NEGATIVE_MOODS.has(moodTag) ? "#FF5C5C" : "#A78BFA",
                      }}
                    >
                      {formatMood(moodTag, userGender)}
                      {extraMoods > 0 ? ` +${extraMoods}` : ""}
                    </span>
                  ) : (
                    <span className="text-[11px]" style={{ color: "oklch(0.55 0.03 270)" }}>
                      —
                    </span>
                  )}
                </span>

                {/* Feeling text */}
                <span className="text-[11px] truncate" style={{ color: "oklch(0.55 0.03 270)" }}>
                  {day.feeling || ""}
                </span>
              </div>
            );
          })}
        </div>

        <p className="m-0 mt-3 text-center text-[10px]" style={{ color: "oklch(0.4 0.03 270)" }}>
          Deslize para ver mais ↓
        </p>
      </div>
    </div>
  );
}
