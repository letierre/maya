"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CheckIn } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const HABIT_EMOJI: Record<string, string> = {
  drank_water:                 "💧",
  slept_well:                  "😴",
  took_medication:             "💊",
  talked_to_someone:           "🗣️",
  meditation_prayer_breathing: "🧘",
  creative_activity:           "🎨",
  exercise_walk:               "🏃",
  did_something_enjoyable:     "😊",
  worked_on_goals:             "🎯",
  bowel_movement:              "🚽",
  felt_judged:                 "⚖️",
  ate_well:                    "🍽️",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStart(checkIns: CheckIn[]): string {
  if (checkIns.length === 0) return "";
  const oldest = [...checkIns].sort((a, b) => a.date.localeCompare(b.date))[0];
  const d = new Date(oldest.date + "T12:00:00");
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${month}/${d.getFullYear()}`;
}

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
  return scoreKeys.filter((k) => (ci as Record<string, unknown>)[k] === true).length;
}

function scoreColor(score: number, total: number): string {
  if (total === 0) return "var(--muted-foreground)";
  const ratio = score / total;
  if (ratio >= 0.7) return "#7C5CFF";
  if (ratio >= 0.5) return "oklch(.55 .12 70)";
  return "oklch(.5 .16 20)";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoricoPage() {
  const router = useRouter();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/check-ins").then((r) => r.json()).catch(() => []),
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
    ]).then(([data, prefs]) => {
      setEnabledKeys(prefs.enabled_questions ?? []);
      if (Array.isArray(data)) {
        setCheckIns(
          [...data].sort((a: CheckIn, b: CheckIn) => b.date.localeCompare(a.date))
        );
      }
      setLoading(false);
    });
  }, []);

  const scoreKeys = useMemo(
    () => enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged"),
    [enabledKeys]
  );
  const habitKeys = useMemo(
    () => enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged"),
    [enabledKeys]
  );
  const monthGroups = useMemo(() => groupByMonth(checkIns), [checkIns]);
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
          {checkIns.length} {checkIns.length === 1 ? "check-in" : "check-ins"}
          {checkIns.length > 0 && ` · desde ${formatStart(checkIns)}`}
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
          {/* Month header */}
          <div
            className="px-6 pb-3.5 flex items-baseline justify-between"
            style={{ opacity: group.muted ? 0.7 : 1 }}
          >
            <h2 className="text-[11px] font-bold tracking-[.16em] uppercase m-0">
              {group.label}
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {group.entries.length} {group.entries.length === 1 ? "check-in" : "check-ins"}
            </span>
          </div>

          {/* Entries */}
          <div style={{ opacity: group.muted ? 0.75 : 1 }}>
            {group.entries.map((ci) => {
              const d = new Date(ci.date + "T12:00:00");
              const day = d.getDate().toString().padStart(2, "0");
              const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase().replace(".", "");
              const isToday = ci.date === today;
              const score = getScore(ci, scoreKeys);
              const color = scoreColor(score, scoreKeys.length);

              return (
                <button
                  key={ci.id}
                  type="button"
                  onClick={() => router.push(`/check-in/${ci.id}`)}
                  className="w-full text-left transition-colors hover:bg-white/30"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 1fr",
                    padding: "14px 24px",
                    borderTop: "1px solid oklch(.5 .12 270 / .1)",
                    background: isToday ? "oklch(.5 .12 270 / .04)" : "transparent",
                  }}
                >
                  {/* Date col */}
                  <div>
                    <div
                      className="text-lg font-bold leading-none tabular-nums tracking-tight"
                      style={{ color: isToday ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {day}
                    </div>
                    <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mt-1">
                      {wk}
                    </div>
                  </div>

                  {/* Content col */}
                  <div className="min-w-0">
                    {/* Score + habits row */}
                    <div className="flex items-center gap-2 mb-1">
                      {/* Habit emoji strip */}
                      <div className="flex items-center gap-[4px] flex-1 min-w-0">
                        {habitKeys.map((key) => {
                          const done = (ci as Record<string, unknown>)[key] === true;
                          return done ? (
                            <span key={key} style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>
                              {HABIT_EMOJI[key] ?? "•"}
                            </span>
                          ) : (
                            <span
                              key={key}
                              style={{
                                display: "inline-block", width: 7, height: 7,
                                borderRadius: "50%", flexShrink: 0,
                                background: "oklch(.5 .02 270 / .22)",
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Score */}
                      <span
                        style={{
                          fontSize: 12, fontWeight: 700, tabularNums: "true",
                          color, flexShrink: 0,
                          fontFamily: "var(--font-mono, ui-monospace)",
                          letterSpacing: "-.01em",
                        } as React.CSSProperties}
                      >
                        {score}/{scoreKeys.length}
                      </span>
                    </div>

                    {/* Feeling excerpt */}
                    {ci.feeling && (
                      <p
                        className="m-0 text-[12.5px] text-muted-foreground italic"
                        style={{
                          overflow: "hidden", whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ci.feeling}
                      </p>
                    )}

                    {/* No feeling, no gratitude — show muted placeholder */}
                    {!ci.feeling && !ci.gratitude && (
                      <p className="m-0 text-[12px] text-muted-foreground" style={{ opacity: 0.5 }}>
                        Sem anotação
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
