"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { Section, CARD, FOREGROUND, MUTED, PURPLE } from "./Section";

interface RawReview { week_score: number; biggest_win?: string; }
interface RawPlan { week_start: string; weekly_reviews?: RawReview[]; }
interface WeeklyPlansResp { plans: RawPlan[]; }

export function SemanalTrend({ from, to }: { from: string; to: string }) {
  const [resp, setResp] = useState<WeeklyPlansResp | null>(null);

  useEffect(() => {
    safeCachedFetch<WeeklyPlansResp>(`/api/weekly-plans?from=${from}&to=${to}`).then((r) => {
      if (r) setResp(r);
    });
  }, [from, to]);

  if (!resp) return null;

  const entries = (resp.plans ?? [])
    .map((p) => {
      const review = p.weekly_reviews && p.weekly_reviews.length > 0 ? p.weekly_reviews[0] : null;
      return {
        week_start: p.week_start,
        score: review?.week_score ?? null,
        win: review?.biggest_win ?? null,
      };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  if (entries.filter((e) => e.score != null).length === 0) return null;

  const latestWin = [...entries].reverse().find((e) => e.win)?.win ?? null;
  // Com muitas semanas (trimestre) esconde o número sobre cada barra para não amontoar
  const showLabels = entries.length <= 8;

  return (
    <Section title="Ritmo semanal">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 64, marginBottom: 12 }}>
          {entries.map((e) => {
            const s = e.score ?? 0;
            return (
              <div
                key={e.week_start}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  height: "100%",
                }}
              >
                {showLabels && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: e.score != null ? FOREGROUND : MUTED }}>
                    {e.score ?? "–"}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max((s / 5) * 44, 3)}px`,
                    borderRadius: 5,
                    background: e.score != null ? PURPLE : "oklch(0.25 0.02 270)",
                    opacity: e.score != null ? 1 : 0.4,
                  }}
                />
              </div>
            );
          })}
        </div>
        {latestWin && (
          <p style={{ margin: 0, fontSize: 12, color: FOREGROUND, lineHeight: 1.4 }}>🏆 {latestWin}</p>
        )}
      </div>
    </Section>
  );
}
