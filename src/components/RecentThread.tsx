"use client";

import { getMoodLabel, getMoodById } from "@/lib/checkin-moods";
import { NEGATIVE_MOODS } from "@/lib/dashboard-constants";
import { useTranslation } from "@/lib/useTranslation";

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

function SparkSmall({ data, color = "oklch(.58 .18 270)" }: { data: number[]; color?: string }) {
  const W = 140;
  const H = 32;
  const P = 2;
  const max = Math.max(...data, 1);
  const xStep = (W - P * 2) / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = P + i * xStep;
    const y = P + (H - P * 2) * (1 - v / max);
    return [x, y] as const;
  });
  const line = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  const fill = `${line} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 32, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="rtSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#rtSparkFill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface RecentThreadProps {
  days: ThreadDay[];
  userGender: string;
  /** Evolução 14d (fundida no rodapé do mesmo card). */
  sparkData?: number[];
}

export function RecentThread({ days, userGender, sparkData }: RecentThreadProps) {
  const { t } = useTranslation();
  const last7 = days.slice(-7).reverse(); // [today, yesterday, ... 6d ago]

  const hasSpark = !!sparkData && sparkData.some((v) => v > 0);
  const sparkAvg = hasSpark
    ? sparkData!.reduce((a, b) => a + b, 0) / sparkData!.length
    : 0;
  const sparkTrend = (() => {
    if (!hasSpark || sparkData!.filter((v) => v > 0).length < 2) return "";
    const avg1 = sparkData!.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const avg2 = sparkData!.slice(7).reduce((a, b) => a + b, 0) / 7;
    if (avg2 - avg1 > 0.5) return t("subindo");
    if (avg1 - avg2 > 0.5) return t("caindo");
    return t("estavel");
  })();

  return (
    <div className="px-3.5 pt-2">
      <div
        className="rounded-[18px] px-4 pt-4 pb-[18px] border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--surface-border)",
          boxShadow: "inset 0 1px 0 var(--surface-highlight)",
        }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <p
            className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
            style={{ color: "#5EEAD4" }}
          >
            {t("rt_titulo")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          {last7.map((day, i) => {
            const isToday = day.today;
            const moodTag = day.mood_tags?.[0];
            const extraMoods = (day.mood_tags?.length ?? 0) - 1;
            const hasScore = day.cuidados !== null && (day.cuidadosTotal ?? 0) > 0;
            const ratio = hasScore ? (day.cuidados ?? 0) / (day.cuidadosTotal ?? 1) : null;

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
                  style={{ color: isToday ? "#A78BFA" : "var(--text-muted)" }}
                >
                  {isToday ? t("rt_hoje") : day.label}
                </span>

                <span className="text-[13px] leading-none text-center" style={{ opacity: sleepOpacity }}>
                  {sleepLabel}
                </span>

                <span
                  className="text-[12px] font-bold tabular-nums text-center"
                  style={{
                    color:
                      ratio === null
                        ? "var(--text-muted)"
                        : ratio >= 0.7
                          ? "#22D18B"
                          : ratio >= 0.5
                            ? "#f59e0b"
                            : "#FF5C5C",
                  }}
                >
                  {hasScore ? `${day.cuidados}/${day.cuidadosTotal}` : "—"}
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
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      —
                    </span>
                  )}
                </span>

                {/* Feeling text */}
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  {day.feeling || ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Evolução 14d — fundida no rodapé do mesmo card */}
        {hasSpark && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--divider)" }}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-[.1em] uppercase" style={{ color: "var(--text-muted)" }}>
                {t("ev_titulo")}
              </span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#e0d6ff" }}>
                {sparkAvg.toFixed(1)} {t("ev_media")}
                {sparkTrend ? ` · ${sparkTrend}` : ""}
              </span>
            </div>
            <SparkSmall data={sparkData!} />
          </div>
        )}
      </div>
    </div>
  );
}
