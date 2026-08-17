"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CheckIn } from "@/types";
import { effectiveHabitKeys } from "@/lib/checkin-answered";
import { getMoodById, getMoodLabel } from "@/lib/checkin-moods";
import { NEGATIVE_MOODS } from "@/lib/dashboard-constants";

// ── Constants ─────────────────────────────────────────────────────────────────

const HABIT_EMOJI: Record<string, string> = {
  drank_water:                 "💧",
  slept_well:                  "😴",
  took_medication:             "💊",
  talked_to_someone:           "🗣️",
  meditation_prayer_breathing: "🧘",
  meditation:                  "🧘",
  prayer:                      "🙏",
  breathing:                   "🌬️",
  creative_activity:           "🎨",
  exercise_walk:               "🏃",
  walked:                      "🚶",
  ran:                         "🏃",
  strength_training:           "🏋️",
  did_something_enjoyable:     "😊",
  worked_on_goals:             "🎯",
  bowel_movement:              "🚽",
  felt_judged:                 "⚖️",
  ate_well:                    "🍽️",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByMonth(checkIns: CheckIn[]) {
  const now = new Date();
  const groups = new Map<string, { label: string; entries: CheckIn[]; key: string }>();
  checkIns.forEach((ci) => {
    const d = new Date(ci.date + "T12:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups.has(key)) {
      const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      groups.set(key, { label: raw.charAt(0).toUpperCase() + raw.slice(1), entries: [], key });
    }
    groups.get(key)!.entries.push(ci);
  });
  return Array.from(groups.values()).map((g) => {
    const [y, m] = g.key.split("-").map(Number);
    const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() - m);
    return { ...g, muted: monthsAgo >= 2 };
  });
}

function getScore(ci: CheckIn, scoreKeys: string[]) {
  return scoreKeys.filter((k) => (ci as unknown as Record<string, unknown>)[k] === true).length;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoricoPage() {
  const router = useRouter();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [gender, setGender] = useState<string>("nao_dizer");
  const [loading, setLoading] = useState(true);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/api/check-ins").then((r) => r.json()).catch(() => []),
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
    ]).then(([data, prefs]) => {
      setEnabledKeys(prefs.enabled_questions ?? []);
      setGender((prefs.context?.gender as string) ?? "nao_dizer");
      if (Array.isArray(data)) {
        setCheckIns(
          [...data].sort((a: CheckIn, b: CheckIn) => b.date.localeCompare(a.date))
        );
      }
      // Open current month by default
      const now = new Date();
      setOpenMonths(new Set([`${now.getFullYear()}-${now.getMonth()}`]));
      setLoading(false);
    });
  }, []);

  const scoreKeys = useMemo(
    () => enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged"),
    [enabledKeys]
  );
  const monthGroups = useMemo(() => groupByMonth(checkIns), [checkIns]);
  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: `radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.47 .18 270 / .20) 0%, transparent 50%),
                     linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-32"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.47 .18 270 / .20) 0%, transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.5 .14 270 / .15) 0%, transparent 60%),
          linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)
        `,
        fontFamily: "var(--font-sans)",
        color: "var(--foreground)",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Seu progresso
        </p>
        <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">
          Histórico
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {monthGroups.length} {monthGroups.length === 1 ? "mês" : "meses"} de registro
          {checkIns.length > 0 && ` · ${checkIns.length} check-ins ao todo`}
        </p>
      </div>

      {/* Empty state */}
      {checkIns.length === 0 && (
        <div className="px-8 pt-16 pb-20 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-bold mb-2">Nenhum check-in ainda</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
            Quando você fizer seu primeiro check-in ele aparece aqui — junto com todos os próximos.
          </p>
          <button
            type="button"
            onClick={() => router.push("/check-in")}
            style={{
              height: 44, padding: "0 22px", borderRadius: 14, border: 0, cursor: "pointer",
              background: "var(--primary)", color: "#fff",
              fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              boxShadow: "0 4px 12px -4px oklch(.5 .12 270 / .4)",
            }}
          >
            Fazer primeiro check-in
          </button>
        </div>
      )}

      {/* Timeline */}
      {monthGroups.map((group, gi) => (
        <div key={group.key} style={{ paddingTop: gi === 0 ? 24 : 36 }}>
          {/* Month header — clickable */}
          <button
            type="button"
            onClick={() => toggleMonth(group.key)}
            className="w-full px-6 pb-2.5 flex items-center gap-2.5"
            style={{
              background: "transparent", border: 0, cursor: "pointer",
              fontFamily: "inherit", opacity: group.muted ? 0.7 : 1,
            }}
          >
            <span style={{
              fontSize: 10, color: "#A78BFA", transition: "transform .2s",
              display: "inline-block",
              transform: openMonths.has(group.key) ? "rotate(90deg)" : "rotate(0deg)",
            }}>▶</span>
            <h2 className="text-[11px] font-bold tracking-[.16em] uppercase m-0 flex-1 text-left">
              {group.label}
            </h2>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#A78BFA", fontVariantNumeric: "tabular-nums",
              background: "rgba(124,92,255,0.14)",
              padding: "2px 9px", borderRadius: 9999,
            }}>
              {group.entries.length}
            </span>
          </button>

          {/* Entries */}
          {openMonths.has(group.key) && (
            <div className="px-5" style={{ opacity: group.muted ? 0.75 : 1 }}>
              {group.entries.map((ci) => {
                const d = new Date(ci.date + "T12:00:00");
                const day = d.getDate().toString().padStart(2, "0");
                const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase().replace(".", "");
                const isToday = ci.date === today;
                const answered = effectiveHabitKeys(ci, scoreKeys);
                const score = getScore(ci, answered);
                const total = answered.length;
                const ratio = total > 0 ? score / total : 0;

                const accent = total === 0 ? "#9e96b5"
                  : ratio >= 0.7 ? "#A78BFA"
                  : ratio >= 0.5 ? "#f59e0b"
                  : "#FF5C5C";
                const accentBg = total === 0 ? "rgba(158,150,181,0.12)"
                  : ratio >= 0.7 ? "rgba(124,92,255,0.18)"
                  : ratio >= 0.5 ? "rgba(245,158,11,0.16)"
                  : "rgba(255,92,92,0.16)";

                const moodTag = ci.mood_tags?.[0];
                const moodChip = moodTag ? getMoodById(moodTag) : undefined;

                return (
                  <button
                    key={ci.id}
                    type="button"
                    onClick={() => router.push(`/check-in/${ci.id}`)}
                    className="w-full text-left block transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0"
                    style={{
                      background: isToday ? "oklch(0.5 0.12 270 / .08)" : "oklch(0.16 0.012 270 / 0.7)",
                      border: isToday ? "1px solid oklch(0.5 0.12 270 / .28)" : "1px solid oklch(0.5 0.12 270 / .12)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Date box */}
                      <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 20, fontWeight: 700, lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                            color: isToday ? "var(--primary)" : "var(--foreground)",
                          }}
                        >
                          {day}
                        </div>
                        <div
                          style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: ".12em",
                            color: "var(--muted-foreground)", marginTop: 5,
                          }}
                        >
                          {wk}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Mood chip + score */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          {moodChip && (
                            <span
                              style={{
                                fontSize: 10, fontWeight: 600,
                                padding: "1px 8px", borderRadius: 9999,
                                background: NEGATIVE_MOODS.has(moodTag!)
                                  ? "oklch(.92 .05 30 / .25)"
                                  : "oklch(.55 .18 270 / .2)",
                                color: NEGATIVE_MOODS.has(moodTag!) ? "#FF5C5C" : "#A78BFA",
                              }}
                            >
                              {moodChip.emoji} {getMoodLabel(moodChip, gender)}
                            </span>
                          )}
                          <div style={{ flex: 1 }} />
                          <span
                            style={{
                              fontSize: 11.5, fontWeight: 700, tabularNums: "true",
                              color: accent, background: accentBg,
                              padding: "2px 9px", borderRadius: 9999,
                              fontFamily: "var(--font-mono, ui-monospace)",
                              letterSpacing: "-.01em",
                            } as React.CSSProperties}
                          >
                            {score}/{total}
                          </span>
                        </div>

                        {/* Feeling / gratitude excerpt */}
                        {ci.feeling ? (
                          <p
                            className="m-0 text-[12.5px] text-muted-foreground italic"
                            style={{
                              overflow: "hidden", whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {ci.feeling}
                          </p>
                        ) : ci.gratitude ? (
                          <p
                            className="m-0 text-[12.5px] text-muted-foreground"
                            style={{
                              overflow: "hidden", whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                            }}
                          >
                            🙏 {ci.gratitude}
                          </p>
                        ) : (
                          <p className="m-0 text-[12px] text-muted-foreground" style={{ opacity: 0.5 }}>
                            Sem anotação
                          </p>
                        )}

                        {/* Habit emoji strip */}
                        <div className="flex items-center gap-[5px] mt-2">
                          {answered.map((key) => {
                            const done = (ci as unknown as Record<string, unknown>)[key] === true;
                            return done ? (
                              <span key={key} style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
                                {HABIT_EMOJI[key] ?? "•"}
                              </span>
                            ) : (
                              <span
                                key={key}
                                style={{
                                  display: "inline-block", width: 6, height: 6,
                                  borderRadius: "50%", flexShrink: 0,
                                  background: "oklch(.5 .02 270 / .22)",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
