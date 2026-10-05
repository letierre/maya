"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";
import type { CheckIn, SleepLog } from "@/types";
import {
  HABIT_ORDER,
  HABIT_COPY,
  EXERCISE_KEYS,
  MEDITATION_KEYS,
} from "@/components/CheckInEditor";
import { isLegacyExercise, isLegacyPause, habitProgress } from "@/lib/checkin-answered";
import { getMoodById } from "@/lib/checkin-moods";

const PERIODS = [7, 15, 30, 90] as const;
const PURPLE = "#7C5CFF";

// ── helpers (mesmo padrão da tela Análise) ────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function filterPeriod<T extends { date: string }>(items: T[], days: number): T[] {
  const since = daysAgo(days - 1);
  return items.filter((i) => i.date >= since);
}

function daysInWindow(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(daysAgo(i));
  return out;
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

type MoodDominant = "positive" | "negative" | "neutral" | null;

function moodDominant(ci: CheckIn): MoodDominant {
  const tags = ci.mood_tags ?? [];
  if (tags.length === 0) return null;
  let pos = 0;
  let neg = 0;
  for (const id of tags) {
    const chip = getMoodById(id);
    if (!chip) continue;
    if (chip.valence === "positive") pos++;
    else neg++;
  }
  if (pos > 0 && neg === 0) return "positive";
  if (neg > 0 && pos === 0) return "negative";
  if (pos > 0 && neg > 0) return "neutral";
  return null;
}

const EX = EXERCISE_KEYS as readonly string[];
const PAUSE = MEDITATION_KEYS as readonly string[];

/** Conjunto de hábitos "feitos" de um check-in, unificando o legado (migração 035)
 *  — exercício/pausa legados colapsam para a 1ª chave granular, igual ao score. */
function habitDoneSet(ci: CheckIn, keys: string[]): Set<string> {
  const rec = ci as unknown as Record<string, unknown>;
  const legacyEx = isLegacyExercise(ci);
  const legacyPa = isLegacyPause(ci);
  const out = new Set<string>();
  let exDone = false;
  let paDone = false;
  for (const k of keys) {
    if (legacyEx && EX.includes(k)) {
      if (!exDone) {
        if (rec.exercise_walk === true) out.add("walked");
        exDone = true;
      }
      continue;
    }
    if (legacyPa && PAUSE.includes(k)) {
      if (!paDone) {
        if (rec.meditation_prayer_breathing === true) out.add("meditation");
        paDone = true;
      }
      continue;
    }
    if (rec[k] === true) out.add(k);
  }
  return out;
}

// ── mini-charts (sem lib — SVG + divs, como o resto do app) ──────────────────

function SparkLine({ data }: { data: number[] }) {
  const W = 320;
  const H = 60;
  const P = 3;
  const max = 100;
  const xStep = (W - P * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [P + i * xStep, P + (H - P * 2) * (1 - v / max)] as const);
  const line = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  const fill = `${line} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 60, display: "block" }}>
      <defs>
        <linearGradient id="dadosScoreFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PURPLE} stopOpacity=".28" />
          <stop offset="100%" stopColor={PURPLE} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#dadosScoreFill)" />
      <path d={line} fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DayBars({ values, max, height = 48 }: { values: (number | null)[]; max: number; height?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: v == null ? 2 : Math.max(2, (v / max) * height),
            borderRadius: 2,
            background: v == null ? "var(--surface-3)" : PURPLE,
            opacity: v == null ? 0.4 : 1,
          }}
        />
      ))}
    </div>
  );
}

function MoodGrid({ days, periodDays }: { days: { date: string; dominant: MoodDominant }[]; periodDays: number }) {
  const size = periodDays > 30 ? 18 : 24;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {days.map((m, i) => (
        <div
          key={i}
          title={m.date}
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: periodDays > 30 ? 11 : 14,
            background:
              m.dominant === "positive"
                ? "rgba(34,209,139,0.15)"
                : m.dominant === "negative"
                  ? "rgba(255,92,92,0.15)"
                  : m.dominant === "neutral"
                    ? "rgba(167,139,250,0.1)"
                    : "oklch(0.2 0.01 270)",
            border:
              m.dominant === "positive"
                ? "1px solid rgba(34,209,139,0.3)"
                : m.dominant === "negative"
                  ? "1px solid rgba(255,92,92,0.3)"
                  : m.dominant === "neutral"
                    ? "1px solid rgba(167,139,250,0.2)"
                    : "1px solid transparent",
          }}
        >
          {m.dominant === "positive" ? "🙂" : m.dominant === "negative" ? "😔" : m.dominant === "neutral" ? "😐" : ""}
        </div>
      ))}
    </div>
  );
}

function HabitDots({ states, periodDays }: { states: ("done" | "miss" | "none")[]; periodDays: number }) {
  const size = periodDays > 60 ? 6 : periodDays > 30 ? 9 : 12;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      {states.map((s, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 2,
            flexShrink: 0,
            background: s === "done" ? PURPLE : s === "miss" ? "var(--surface-3)" : "oklch(0.2 0.01 270)",
            opacity: s === "none" ? 0.35 : 1,
          }}
        />
      ))}
    </div>
  );
}

// ── página ───────────────────────────────────────────────────────────────────

export default function CheckInDadosPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<number>(30);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ enabled_questions?: string[]; context?: Record<string, boolean> }>("/api/preferences"),
      cachedFetch<SleepLog[]>("/api/sleep?limit=200"),
    ])
      .then(([ci, prefs, sleep]) => {
        if (cancelled) return;
        if (Array.isArray(ci)) setCheckIns(ci);
        if (Array.isArray(sleep)) setSleepLogs(sleep);
        setEnabledKeys(prefs?.enabled_questions || []);
        setContext(prefs?.context || {});
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── dados derivados ────────────────────────────────────────────────────────

  const periodCI = useMemo(() => filterPeriod(checkIns, period), [checkIns, period]);
  const periodSleep = useMemo(() => filterPeriod(sleepLogs, period), [sleepLogs, period]);

  const byDate = useMemo(() => {
    const m = new Map<string, CheckIn>();
    for (const ci of checkIns) m.set(ci.date, ci);
    return m;
  }, [checkIns]);

  const sleepByDate = useMemo(() => {
    const m = new Map<string, SleepLog>();
    for (const s of sleepLogs) if (s.quality != null) m.set(s.date, s);
    return m;
  }, [sleepLogs]);

  const window = useMemo(() => daysInWindow(period), [period]);

  const habitKeys = useMemo(() => HABIT_ORDER.filter((k) => enabledKeys.includes(k)), [enabledKeys]);
  const scoreKeys = useMemo(() => enabledKeys.filter((k) => k !== "suicidal_thoughts"), [enabledKeys]);

  const doneByDate = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const ci of periodCI) m.set(ci.date, habitDoneSet(ci, habitKeys));
    return m;
  }, [periodCI, habitKeys]);

  // Score diário (0 quando sem check-in no dia)
  const scoreSeries = useMemo(
    () =>
      window.map((date) => {
        const ci = byDate.get(date);
        if (!ci) return 0;
        const { done, total } = habitProgress(ci, scoreKeys);
        return total > 0 ? Math.round((done / total) * 100) : 0;
      }),
    [window, byDate, scoreKeys],
  );

  const avgScore = useMemo(
    () =>
      avg(
        periodCI.map((ci) => {
          const { done, total } = habitProgress(ci, scoreKeys);
          return total > 0 ? (done / total) * 100 : 0;
        }),
      ),
    [periodCI, scoreKeys],
  );

  const moodDays = useMemo(
    () => window.map((date) => ({ date, dominant: byDate.get(date) ? moodDominant(byDate.get(date)!) : null })),
    [window, byDate],
  );

  const waterSeries = useMemo(() => window.map((date) => byDate.get(date)?.water_cups ?? null), [window, byDate]);
  const avgWater = useMemo(() => avg(periodCI.map((ci) => ci.water_cups)), [periodCI]);

  const sleepSeries = useMemo(() => window.map((date) => sleepByDate.get(date)?.quality ?? null), [window, sleepByDate]);
  const avgSleep = useMemo(
    () => avg(periodSleep.map((s) => s.quality).filter((q): q is number => q != null)),
    [periodSleep],
  );

  const periodLabel = t(`ck_dados_period_${period}`);

  const sectionLabel: React.CSSProperties = {
    margin: "0 0 6px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: "#A78BFA",
    paddingLeft: 4,
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--surface-border)",
    borderRadius: 18,
    padding: "16px 18px",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 9999,
    border: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    background: active ? PURPLE : "var(--surface-3)",
    color: active ? "#fff" : "var(--muted-foreground)",
    transition: "all .15s ease",
  });

  const habitLabel = (key: string) => {
    if (key === "creative_activity" && context.has_creative_hobby) return t("ck_habit_creative_hobby");
    return t(HABIT_COPY[key]?.labelKey ?? key);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "oklch(0.12 0.012 270)",
        color: "var(--foreground)",
        fontFamily: "var(--font-sans)",
        paddingBottom: 60,
      }}
    >
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("ck_back_history")}
        style={{
          position: "fixed",
          top: 14,
          left: 16,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 9999,
          border: 0,
          cursor: "pointer",
          background: "oklch(0.16 0.012 270 / 0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Header */}
      <div style={{ padding: "56px 20px 4px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e0d6ff", letterSpacing: "-0.02em" }}>
          {t("ck_dados_title")}
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          {t("ck_dados_sub", { count: String(periodCI.length), period: periodLabel })}
        </p>
      </div>

      {/* Period selector */}
      <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
        {PERIODS.map((p) => (
          <button key={p} type="button" style={tabStyle(period === p)} onClick={() => setPeriod(p)}>
            {t(`ck_dados_period_${p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: "#e0d6ff", fontSize: 13 }}>{t("carregando")}</p>
        </div>
      ) : periodCI.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>📊</p>
          <p style={{ color: "var(--text-muted)", fontSize: 15, margin: 0 }}>{t("ck_dados_empty")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 16px 0" }}>
          {/* Score diário */}
          <section>
            <p style={sectionLabel}>{t("ck_dados_score")}</p>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#e0d6ff", lineHeight: 1 }}>
                  {avgScore != null ? Math.round(avgScore) : 0}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ 100</span>
              </div>
              <SparkLine data={scoreSeries} />
            </div>
          </section>

          {/* Humor */}
          <section>
            <p style={sectionLabel}>{t("ck_dados_humor")}</p>
            <div style={{ ...card, padding: "12px 10px" }}>
              <MoodGrid days={moodDays} periodDays={period} />
            </div>
          </section>

          {/* Hábitos (por resposta) */}
          <section>
            <p style={sectionLabel}>{t("ck_dados_habitos")}</p>
            <div style={{ ...card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
              {habitKeys.map((key) => {
                const doneCount = periodCI.filter((ci) => doneByDate.get(ci.date)?.has(key)).length;
                const total = periodCI.length;
                const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                const states = window.map((date) => {
                  const ci = byDate.get(date);
                  if (!ci) return "none" as const;
                  return doneByDate.get(date)?.has(key) ? ("done" as const) : ("miss" as const);
                });
                return (
                  <div key={key}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{HABIT_COPY[key]?.emoji ?? "•"}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#e0d6ff", fontWeight: 500 }}>{habitLabel(key)}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                        {doneCount}/{total}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 9999, background: "var(--surface-3)", overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 9999, background: PURPLE, transition: "width .4s ease" }} />
                    </div>
                    <HabitDots states={states} periodDays={period} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Água */}
          <section>
            <p style={sectionLabel}>{t("ck_dados_agua")}</p>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#e0d6ff", lineHeight: 1 }}>
                  {avgWater != null ? avgWater.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("ck_dados_copos")}</span>
              </div>
              <DayBars values={waterSeries} max={8} />
            </div>
          </section>

          {/* Sono */}
          <section>
            <p style={sectionLabel}>{t("ck_dados_sono")}</p>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#e0d6ff", lineHeight: 1 }}>
                  {avgSleep != null ? avgSleep.toFixed(1) : "—"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ 5</span>
              </div>
              <DayBars values={sleepSeries} max={5} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
