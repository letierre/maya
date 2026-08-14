"use client";

import { useEffect, useState, useMemo } from "react";
import { cachedFetch } from "@/lib/fetch-cache";
import { MOOD_CHIPS } from "@/lib/checkin-moods";
import { sleepScore } from "@/lib/sleep-utils";
import type { CheckIn, SleepLog, FinancialTransaction, AgendaItem } from "@/types";
import { MetasResumo } from "@/components/analise/MetasResumo";
import { OKRProgress } from "@/components/analise/OKRProgress";
import { AreaBalance } from "@/components/analise/AreaBalance";
import { SemanalTrend } from "@/components/analise/SemanalTrend";
import { NutricaoResumo } from "@/components/analise/NutricaoResumo";
import { MovimentoResumo } from "@/components/analise/MovimentoResumo";
import { LeituraResumo } from "@/components/analise/LeituraResumo";

// ── helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD for N days ago (in local time) */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Filter array to entries within the last `days` (inclusive of today) */
function filterPeriod<T extends { date: string }>(items: T[], days: number): T[] {
  const since = daysAgo(days - 1);
  return items.filter((i) => i.date >= since);
}

/** Previous equal-length period (e.g. last 7 days → the 7 days before that) */
function filterPrevPeriod<T extends { date: string }>(items: T[], days: number): T[] {
  const from = daysAgo(days * 2 - 1);
  const to = daysAgo(days);
  return items.filter((i) => i.date >= from && i.date <= to);
}

/** Safe average, returns null if empty */
function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Wellness score 0–100 from a single check-in, based on enabled habit keys */
function wellnessScore(ci: CheckIn, habitKeys: string[]): number {
  if (habitKeys.length === 0) return 50;
  let sum = 0;
  let count = 0;
  for (const k of habitKeys) {
    if (k === "suicidal_thoughts" || k === "water_cups") continue;
    const v = (ci as unknown as Record<string, unknown>)[k];
    if (k === "drank_water") {
      sum += (ci.water_cups ?? 0) >= 4 ? 100 : (ci.water_cups ?? 0) > 0 ? 50 : 0;
    } else {
      sum += v === true ? 100 : v === false ? 0 : 50;
    }
    count++;
  }
  return count > 0 ? Math.round(sum / count) : 50;
}

/** Get mood valence from chip ID — works for both gender forms */
function getMoodValence(chipId: string): "positive" | "negative" | null {
  const chip = MOOD_CHIPS.find((c) => c.id === chipId);
  return chip?.valence ?? null;
}

// ── component ────────────────────────────────────────────────────────────────

export default function AnalisePage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"semana" | "mes" | "trimestre">("semana");
  const [hub, setHub] = useState<"bemestar" | "crescimento">("bemestar");
  const [crescTab, setCrescTab] = useState<"semana" | "mes" | "trimestre">("trimestre");

  const periodDays = { semana: 7, mes: 30, trimestre: 90 }[tab];
  const crescPeriodDays = { semana: 7, mes: 30, trimestre: 90 }[crescTab];

  useEffect(() => {
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ enabled_questions?: string[] }>("/api/preferences"),
      cachedFetch<SleepLog[]>("/api/sleep?limit=200"),
      cachedFetch<FinancialTransaction[]>("/api/financas/transactions"),
    ])
      .then(([ci, prefs, sleep, fin]) => {
        if (Array.isArray(ci)) setCheckIns(ci);
        if (Array.isArray(sleep)) setSleepLogs(sleep);
        if (Array.isArray(fin)) setTransactions(fin);
        setEnabledKeys(prefs.enabled_questions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch agenda items for the period (re-fetches on tab change)
  useEffect(() => {
    const from = daysAgo(periodDays - 1);
    const to = daysAgo(0);
    cachedFetch<AgendaItem[]>(`/api/agenda?from=${from}&to=${to}`)
      .then((data) => {
        if (Array.isArray(data)) setAgendaItems(data);
      })
      .catch(() => {});
  }, [periodDays]);

  // ── filtered data ────────────────────────────────────────────────────────

  const periodCI = useMemo(() => filterPeriod(checkIns, periodDays), [checkIns, periodDays]);
  const prevCI = useMemo(() => filterPrevPeriod(checkIns, periodDays), [checkIns, periodDays]);

  const periodSleep = useMemo(() => filterPeriod(sleepLogs, periodDays), [sleepLogs, periodDays]);
  const prevSleep = useMemo(() => filterPrevPeriod(sleepLogs, periodDays), [sleepLogs, periodDays]);

  const periodFin = useMemo(() => filterPeriod(transactions, periodDays), [transactions, periodDays]);
  const prevFin = useMemo(() => filterPrevPeriod(transactions, periodDays), [transactions, periodDays]);

  // ── wellness score 0–100 ─────────────────────────────────────────────────

  const habitKeys = useMemo(
    () => enabledKeys.filter((k) => k !== "suicidal_thoughts"),
    [enabledKeys],
  );

  const wellnessAvg = useMemo(
    () => avg(periodCI.map((ci) => wellnessScore(ci, habitKeys))),
    [periodCI, habitKeys],
  );

  const prevWellnessAvg = useMemo(
    () => avg(prevCI.map((ci) => wellnessScore(ci, habitKeys))),
    [prevCI, habitKeys],
  );

  // ── evolution % ───────────────────────────────────────────────────────────

  const evolutionPct = useMemo(() => {
    if (wellnessAvg == null || prevWellnessAvg == null) return null;
    if (prevWellnessAvg === 0) return wellnessAvg > 0 ? 100 : 0;
    return Math.round(((wellnessAvg - prevWellnessAvg) / prevWellnessAvg) * 100);
  }, [wellnessAvg, prevWellnessAvg]);

  // ── areas ─────────────────────────────────────────────────────────────────

  const areas = useMemo(() => {
    // ── sono ──
    const sleepDurations = periodSleep
      .map((s) => s.duration_min)
      .filter((d): d is number => d != null && d > 0);
    const sleepHrs = sleepDurations.length > 0
      ? sleepDurations.reduce((a, b) => a + b, 0) / sleepDurations.length / 60
      : null;
    // fallback: slept_well % from check-ins
    const sleptWellPct = periodCI.length > 0
      ? Math.round((periodCI.filter((c) => c.slept_well === true).length / periodCI.length) * 100)
      : null;
    const sonoDisplay = sleepHrs != null ? Math.round(sleepHrs * 10) / 10 : null; // hours with 1 decimal

    // Score de sono 0–100 (duração + qualidade + interrupções + sonhos)
    const sonoScores = periodSleep.map((s) => sleepScore(s));
    const sonoPct = sonoScores.length > 0 ? Math.round(avg(sonoScores) ?? 0) : (sleptWellPct ?? 0);
    const prevSonoScores = prevSleep.map((s) => sleepScore(s));
    const prevSonoPct = prevSonoScores.length > 0 ? Math.round(avg(prevSonoScores) ?? 0) : 0;
    const sonoTrend = prevSonoPct > 0 ? Math.round(((sonoPct - prevSonoPct) / prevSonoPct) * 100) : 0;

    // ── humor (uses chip valence, works for both gender forms) ──
    const calcHumor = (ci: CheckIn) => {
      const tags = ci.mood_tags ?? [];
      if (tags.length === 0) return 50;
      let pos = 0, neg = 0;
      for (const t of tags) {
        const v = getMoodValence(t);
        if (v === "positive") pos++;
        else if (v === "negative") neg++;
      }
      if (pos + neg === 0) return 50;
      return Math.round((pos / (pos + neg)) * 100);
    };
    const humorScores = periodCI.map(calcHumor);
    const humorPct = Math.round(avg(humorScores) ?? 50);
    const prevHumorScores = prevCI.map(calcHumor);
    const prevHumorPct = Math.round(avg(prevHumorScores) ?? 50);
    const humorTrend = prevHumorPct > 0 ? Math.round(((humorPct - prevHumorPct) / prevHumorPct) * 100) : 0;

    // ── foco (execução real da agenda + autoavaliação de metas) ──
    const totalAgenda = agendaItems.length;
    const doneAgenda = agendaItems.filter((a) => a.status === "concluida").length;
    const execPct = totalAgenda > 0 ? Math.round((doneAgenda / totalAgenda) * 100) : null;
    const metasPct = periodCI.length > 0
      ? Math.round((periodCI.filter((c) => c.worked_on_goals === true).length / periodCI.length) * 100)
      : 0;
    // Combina execução objetiva (agenda) + percepção subjetiva (check-in)
    const focoPct = execPct != null ? Math.round((execPct + metasPct) / 2) : metasPct;

    // prev period foco
    const prevAgenda = agendaItems.filter((a) => {
      const from = daysAgo(periodDays * 2 - 1);
      const to = daysAgo(periodDays);
      return a.date >= from && a.date <= to;
    });
    const prevTotalAgenda = prevAgenda.length;
    const prevDoneAgenda = prevAgenda.filter((a) => a.status === "concluida").length;
    const prevExecPct = prevTotalAgenda > 0 ? Math.round((prevDoneAgenda / prevTotalAgenda) * 100) : null;
    const prevMetasPct = prevCI.length > 0
      ? Math.round((prevCI.filter((c) => c.worked_on_goals === true).length / prevCI.length) * 100)
      : 0;
    const prevFocoPct = prevExecPct != null ? Math.round((prevExecPct + prevMetasPct) / 2) : prevMetasPct;
    const focoTrend = prevFocoPct > 0 ? Math.round(((focoPct - prevFocoPct) / prevFocoPct) * 100) : 0;

    // ── gastos ──
    const despesas = periodFin
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const prevDespesas = prevFin
      .filter((t) => t.type === "despesa")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    // Normalize by days so comparison is fair
    const despesasDaily = periodDays > 0 ? despesas / periodDays : despesas;
    const prevDespesasDaily = periodDays > 0 ? prevDespesas / periodDays : prevDespesas;
    const gastosTrend = prevDespesasDaily > 0
      ? Math.round(((prevDespesasDaily - despesasDaily) / prevDespesasDaily) * 100)
      : 0; // positive = spending less (good)

    return {
      sono: { pct: sonoPct, trend: sonoTrend, display: sonoDisplay, sleptWellPct },
      humor: { pct: humorPct, trend: humorTrend },
      foco: { pct: focoPct, trend: focoTrend },
      gastos: { pct: Math.round(despesas), trend: gastosTrend },
    };
  }, [periodCI, prevCI, periodSleep, prevSleep, periodFin, prevFin, periodDays]);

  // ── maya insight ──────────────────────────────────────────────────────────

  const mayaInsight = useMemo(() => {
    if (checkIns.length < 5) return null;

    // Split all check-ins into good-sleep and bad-sleep days
    const goodSleepCI = checkIns.filter((c) => c.slept_well === true);
    const badSleepCI = checkIns.filter((c) => c.slept_well === false);

    if (goodSleepCI.length < 2 || badSleepCI.length < 2) {
      // Not enough data to compare — fall back to a simpler insight
      const hasSleepLogs = sleepLogs.length > 0;
      if (hasSleepLogs) {
        const avgHrs = sleepLogs
          .map((s) => s.duration_min)
          .filter((d): d is number => d != null)
          .reduce((a, b) => a + b, 0) / sleepLogs.filter((s) => s.duration_min != null).length / 60;
        return {
          title: `Você dorme em média ${avgHrs.toFixed(1)}h por noite.`,
          detail: "Acompanhar o sono é o primeiro passo para entender seu bem-estar.",
          pct: null,
        };
      }
      return {
        title: "Continue registrando seu dia para eu encontrar padrões.",
        detail: "Quanto mais check-ins você fizer, mais insights como este aparecerão.",
        pct: null,
      };
    }

    // Compute wellness per group
    const goodAvg = goodSleepCI.reduce((s, c) => s + wellnessScore(c, habitKeys), 0) / goodSleepCI.length;
    const badAvg = badSleepCI.reduce((s, c) => s + wellnessScore(c, habitKeys), 0) / badSleepCI.length;
    const diff = Math.round(((goodAvg - badAvg) / Math.max(badAvg, 1)) * 100);

    if (diff <= 5) {
      return {
        title: "Seu bem-estar não varia muito com o sono.",
        detail: "Outros fatores podem estar impactando mais. Vamos continuar observando.",
        pct: null,
      };
    }

    return {
      title: `Seu bem-estar melhora ${diff}% quando você dorme bem.`,
      detail: `Baseado em ${goodSleepCI.length + badSleepCI.length} check-ins. O sono é um dos fatores que mais impactam sua qualidade de vida.`,
      pct: diff,
    };
  }, [checkIns, sleepLogs, habitKeys]);

  // ── impact factors ────────────────────────────────────────────────────────

  const impactFactors = useMemo(() => {
    if (checkIns.length < 5 || habitKeys.length === 0) return [];

    // Compute wellness for each check-in
    const scores = checkIns.map((ci) => wellnessScore(ci, habitKeys));

    // Only behavioral, actionable habits — no bodily functions or external events
    const habitLabels: Record<string, string> = {
      slept_well: "Sono",
      ate_well: "Alimentação",
      exercise_walk: "Exercício",
      meditation_prayer_breathing: "Meditação",
      worked_on_goals: "Foco",
      creative_activity: "Criatividade",
      did_something_enjoyable: "Lazer",
      talked_to_someone: "Conexão social",
      drank_water: "Hidratação",
    };

    const factors: { label: string; pct: number; negative: boolean }[] = [];

    for (const k of habitKeys) {
      if (k === "water_cups" || k === "suicidal_thoughts" || k === "feeling" || k === "mood_tags" || k === "gratitude" || k === "gratitude_photos") continue;
      if (!habitLabels[k]) continue; // skips bowel_movement, felt_judged, took_medication

      // Split into days with this habit true vs false
      const trueScores: number[] = [];
      const falseScores: number[] = [];
      checkIns.forEach((ci, i) => {
        let val: boolean;
        if (k === "drank_water") {
          val = (ci.water_cups ?? 0) >= 4;
        } else {
          val = (ci as unknown as Record<string, unknown>)[k] === true;
        }
        if (val) trueScores.push(scores[i]);
        else falseScores.push(scores[i]);
      });

      if (trueScores.length < 2 || falseScores.length < 2) continue;

      const trueAvg = trueScores.reduce((a, b) => a + b, 0) / trueScores.length;
      const falseAvg = falseScores.reduce((a, b) => a + b, 0) / falseScores.length;
      const impact = Math.round(Math.abs(trueAvg - falseAvg));

      if (impact >= 3) {
        factors.push({
          label: habitLabels[k],
          pct: Math.min(impact, 100),
          negative: trueAvg < falseAvg, // negative if having this habit makes score lower (unusual)
        });
      }
    }

    // Sort by impact desc, take top 4
    factors.sort((a, b) => b.pct - a.pct);
    return factors.slice(0, 4);
  }, [checkIns, habitKeys]);

  // ── streak ─────────────────────────────────────────────────────────────────

  const streak = useMemo(() => {
    if (checkIns.length === 0) return 0;
    const today = daysAgo(0);
    const dates = new Set(checkIns.map((c) => c.date));
    let count = 0;
    const d = new Date();
    while (true) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dates.has(ds)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [checkIns]);

  // ── trend data (wellness per day) ──────────────────────────────────────────

  const trendData = useMemo(() => {
    const points: { date: string; label: string; score: number | null }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const ds = daysAgo(i);
      const ci = checkIns.find((c) => c.date === ds);
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
      points.push({
        date: ds,
        label: periodDays > 14 ? (i % 3 === 0 ? label : "") : label, // fewer labels for longer periods
        score: ci ? wellnessScore(ci, habitKeys) : null,
      });
    }
    return points;
  }, [checkIns, periodDays, habitKeys]);

  // ── mood timeline ──────────────────────────────────────────────────────────

  const moodTimeline = useMemo(() => {
    return trendData.map((p) => {
      const ci = checkIns.find((c) => c.date === p.date);
      if (!ci) return { ...p, dominant: null as string | null };
      const tags = ci.mood_tags ?? [];
      if (tags.length === 0) return { ...p, dominant: null };
      let pos = 0, neg = 0;
      for (const t of tags) {
        const v = getMoodValence(t);
        if (v === "positive") pos++;
        else if (v === "negative") neg++;
      }
      if (pos > neg) return { ...p, dominant: "positive" };
      if (neg > pos) return { ...p, dominant: "negative" };
      return { ...p, dominant: "neutral" };
    });
  }, [trendData, checkIns]);

  // ── heatmap ────────────────────────────────────────────────────────────────

  const heatmapData = useMemo(() => {
    const dates = new Set(checkIns.map((c) => c.date));
    const cells: { date: string; label: string; filled: boolean }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const ds = daysAgo(i);
      const d = new Date();
      d.setDate(d.getDate() - i);
      cells.push({
        date: ds,
        label: String(d.getDate()),
        filled: dates.has(ds),
      });
    }
    return cells;
  }, [checkIns, periodDays]);

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px",
    borderRadius: 9999,
    border: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    background: active ? "#7C5CFF" : "oklch(0.22 0.02 270)",
    color: active ? "#fff" : "oklch(0.6 0.03 270)",
    transition: "all .15s ease",
  });

  const areaCards = [
    {
      label: "Sono",
      pct: areas.sono.pct,
      trend: areas.sono.trend,
      positive: areas.sono.trend >= 0,
      detail: areas.sono.display != null ? `${areas.sono.display}h` : `${areas.sono.sleptWellPct ?? 0}%`,
    },
    {
      label: "Humor",
      pct: areas.humor.pct,
      trend: areas.humor.trend,
      positive: areas.humor.trend >= 0,
      detail: null,
    },
    {
      label: "Foco",
      pct: areas.foco.pct,
      trend: areas.foco.trend,
      positive: areas.foco.trend >= 0,
      detail: null,
    },
    {
      label: "Gastos",
      pct: typeof areas.gastos.pct === "number" && areas.gastos.pct > 0 ? areas.gastos.pct : 0,
      trend: areas.gastos.trend,
      positive: areas.gastos.trend >= 0, // trending down = good (spending less)
      detail: typeof areas.gastos.pct === "number" && areas.gastos.pct > 0
        ? `R$${areas.gastos.pct}`
        : "—",
    },
  ];

  const tabLabel = tab === "semana" ? "esta semana" : tab === "mes" ? "este mês" : "este trimestre";
  const crescTabLabel = crescTab === "semana" ? "esta semana" : crescTab === "mes" ? "este mês" : "este trimestre";
  const crescFrom = daysAgo(crescPeriodDays - 1);
  const crescTo = daysAgo(0);

  const exercisePct = periodCI.length > 0
    ? Math.round((periodCI.filter((c) => c.exercise_walk === true).length / periodCI.length) * 100)
    : null;

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.12 0.012 270)", paddingBottom: 110 }}>
      <div style={{ padding: "22px 20px 4px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#e0d6ff", letterSpacing: "-0.02em" }}>
          {hub === "bemestar" ? "Bem-estar" : "Crescimento pessoal"}
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "oklch(0.55 0.03 270)" }}>
          {hub === "bemestar"
            ? `${periodCI.length} check-ins em ${tabLabel}`
            : `Seu crescimento em ${crescTabLabel}`}
        </p>
      </div>

      {/* Hub switcher */}
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{
          display: "flex", borderRadius: 14, background: "#1a1530",
          border: "1px solid rgba(167,139,250,0.15)", padding: 3,
        }}>
          {([
            { key: "bemestar", icon: "🌿", label: "Bem-estar" },
            { key: "crescimento", icon: "📈", label: "Crescimento" },
          ] as const).map(({ key, icon, label }) => (
            <button key={key} type="button" onClick={() => setHub(key)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: 0,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6, fontFamily: "inherit",
                fontSize: 13, fontWeight: 700,
                background: hub === key ? "linear-gradient(135deg, #7C5CFF, #A78BFA)" : "transparent",
                color: hub === key ? "#fff" : "#9e96b5",
                transition: "all 0.2s ease",
              }}>
              <span style={{ fontSize: 14 }}>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Streak */}
      {hub === "bemestar" && streak > 0 && (
        <div style={{ padding: "0 20px", marginBottom: 4 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "oklch(0.18 0.02 270)", borderRadius: 9999,
            padding: "8px 16px", border: "1px solid oklch(0.28 0.02 270 / 0.5)",
          }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>
              {streak} {streak === 1 ? "dia" : "dias"} seguidos
            </span>
          </div>
        </div>
      )}

      {/* Tabs (período) — apenas no hub de bem-estar */}
      {hub === "bemestar" && (
        <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
          {(["semana", "mes", "trimestre"] as const).map((t) => (
            <button key={t} type="button" style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t === "semana" ? "Semana" : t === "mes" ? "Mês" : "Trimestre"}
            </button>
          ))}
        </div>
      )}

      {/* ── HUB: BEM-ESTAR ── */}
      {hub === "bemestar" && (
        <>
      {/* Evolution ring */}
      {periodCI.length >= 2 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
          <div style={{
            width: 140, height: 140, borderRadius: "50%",
            background: evolutionPct != null
              ? `conic-gradient(#7C5CFF ${Math.max(0, Math.min(evolutionPct + 50, 100)) * 3.6}deg, #22D18B ${Math.abs(evolutionPct) * 3.6}deg, oklch(0.22 0.02 270) 0deg)`
              : `conic-gradient(#7C5CFF ${(wellnessAvg ?? 50) * 3.6}deg, oklch(0.22 0.02 270) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <div style={{
              width: 106, height: 106, borderRadius: "50%",
              background: "oklch(0.12 0.012 270)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#e0d6ff", lineHeight: 1 }}>
                {evolutionPct != null
                  ? (evolutionPct > 0 ? "+" : "") + evolutionPct
                  : wellnessAvg != null
                    ? Math.round(wellnessAvg)
                    : "—"}
              </span>
              <span style={{ fontSize: 10, color: "oklch(0.55 0.03 270)", marginTop: 2 }}>
                {evolutionPct != null ? "vs anterior" : "Bem-estar"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <p style={{ color: "oklch(0.55 0.03 270)", fontSize: 14 }}>
            Registre {3 - periodCI.length} {3 - periodCI.length === 1 ? "dia" : "dias"} a mais para ver sua evolução.
          </p>
        </div>
      )}

      {/* Trend chart */}
      {trendData.filter((p) => p.score != null).length >= 3 && (
        <div style={{ padding: "4px 16px 0" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
            Tendência de bem-estar
          </p>
          <div style={{
            background: "oklch(0.16 0.012 270)",
            border: "1px solid oklch(0.28 0.02 270 / 0.5)",
            borderRadius: 18, padding: "16px 8px 8px",
            overflow: "hidden",
          }}>
            <svg viewBox={`0 0 ${Math.max(trendData.length * 16, 280)} 120`} style={{ width: "100%", height: 120 }}>
              {/* Grid lines */}
              {[25, 50, 75].map((y) => (
                <line key={y} x1={0} x2={Math.max(trendData.length * 16, 280)} y1={120 - y * 1.2} y2={120 - y * 1.2}
                  stroke="oklch(0.22 0.02 270)" strokeWidth={0.5} strokeDasharray="4 3" />
              ))}
              {/* Line */}
              <polyline
                fill="none"
                stroke="#7C5CFF"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trendData
                  .map((p, i) => {
                    if (p.score == null) return null;
                    const x = i * 16 + 8;
                    const y = 120 - p.score * 1.2;
                    return `${x},${y}`;
                  })
                  .filter(Boolean)
                  .join(" ")}
              />
              {/* Dots */}
              {trendData.map((p, i) => {
                if (p.score == null) return null;
                const x = i * 16 + 8;
                const y = 120 - p.score * 1.2;
                return (
                  <circle key={i} cx={x} cy={y} r={3} fill="#7C5CFF"
                    style={{ filter: "drop-shadow(0 0 3px rgba(124,92,255,0.5))" }} />
                );
              })}
              {/* Area fill */}
              <polygon
                fill="url(#trendGrad)"
                points={
                  (() => {
                    const pts = trendData
                      .map((p, i) => p.score != null ? `${i * 16 + 8},${120 - p.score * 1.2}` : null)
                      .filter(Boolean);
                    if (pts.length === 0) return "";
                    const firstX = trendData.findIndex((p) => p.score != null) * 16 + 8;
                    const lastX = (trendData.length - 1 - [...trendData].reverse().findIndex((p) => p.score != null)) * 16 + 8;
                    return `${firstX},120 ${pts.join(" ")} ${lastX},120`;
                  })()
                }
              />
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0} />
                </linearGradient>
              </defs>
            </svg>
            {/* X-axis labels */}
            {periodDays <= 14 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 6px 0" }}>
                {trendData.filter((_, i) => periodDays > 14 ? i % 3 === 0 : true).map((p, i) => (
                  <span key={i} style={{ fontSize: 9, color: "oklch(0.5 0.02 270)", minWidth: 20, textAlign: "center" }}>
                    {p.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maya detectou */}
      {mayaInsight && (
        <div style={{ padding: "0 16px", marginTop: 8 }}>
          <div style={{
            background: "oklch(0.16 0.012 270)",
            border: "1px solid oklch(0.28 0.02 270 / 0.5)",
            borderRadius: 18, padding: "16px 18px",
          }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#A78BFA" }}>
              💡 Maya detectou
            </p>
            <p style={{ margin: "6px 0 4px", fontSize: 15, fontWeight: 700, color: "#e0d6ff", lineHeight: 1.3 }}>
              {mayaInsight.title}
              {mayaInsight.pct != null && (
                <span style={{ color: "#22D18B", marginLeft: 4 }}>↑{mayaInsight.pct}%</span>
              )}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "oklch(0.55 0.03 270)", lineHeight: 1.4 }}>
              {mayaInsight.detail}
            </p>
          </div>
        </div>
      )}

      {/* Áreas em destaque */}
      <div style={{ padding: "20px 16px 0" }}>
        <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
          Áreas em destaque
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {areaCards.map((a) => (
            <div key={a.label} style={{
              background: "oklch(0.16 0.012 270)",
              border: "1px solid oklch(0.28 0.02 270 / 0.5)",
              borderRadius: 16, padding: "14px 12px",
            }}>
              <p style={{ margin: 0, fontSize: 11, color: "oklch(0.55 0.03 270)", fontWeight: 500 }}>{a.label}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#e0d6ff" }}>
                  {a.label === "Sono" && a.detail ? a.detail : `${a.pct}%`}
                </span>
                {a.trend !== 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: a.positive ? "#22D18B" : "#FF5C5C" }}>
                    {a.trend > 0 ? "+" : ""}{a.trend}%
                  </span>
                )}
              </div>
              {/* Mini bar */}
              <div style={{
                height: 3, borderRadius: 9999, marginTop: 8,
                background: "oklch(0.25 0.02 270)", overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${Math.min(a.pct, 100)}%`, borderRadius: 9999,
                  background: a.label === "Gastos" && areas.gastos.trend < 0
                    ? "#FF5C5C"
                    : a.label === "Gastos"
                      ? "#22D18B"
                      : "linear-gradient(90deg, #7C5CFF, #A78BFA)",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bem-estar complementar: nutrição, movimento, leitura */}
      <NutricaoResumo from={daysAgo(periodDays - 1)} to={daysAgo(0)} />
      <MovimentoResumo from={daysAgo(periodDays - 1)} to={daysAgo(0)} exercisePct={exercisePct} />
      <LeituraResumo from={daysAgo(periodDays - 1)} to={daysAgo(0)} />

      {/* Mood timeline */}
      {moodTimeline.some((m) => m.dominant != null) && (
        <div style={{ padding: "4px 16px 0" }}>
          <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
            Humor · {tabLabel}
          </p>
          <div style={{
            background: "oklch(0.16 0.012 270)",
            border: "1px solid oklch(0.28 0.02 270 / 0.5)",
            borderRadius: 18, padding: "12px 10px",
            display: "flex", alignItems: "center", gap: 2,
            overflowX: "auto",
          }}>
            {moodTimeline.map((m, i) => (
              <div key={i} style={{
                width: periodDays > 30 ? 18 : 24,
                height: periodDays > 30 ? 18 : 24,
                borderRadius: 6,
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: periodDays > 30 ? 10 : 13,
                background: m.dominant === "positive" ? "rgba(34,209,139,0.15)"
                  : m.dominant === "negative" ? "rgba(255,92,92,0.15)"
                  : m.dominant === "neutral" ? "rgba(167,139,250,0.1)"
                  : "oklch(0.2 0.01 270)",
                border: m.dominant === "positive" ? "1px solid rgba(34,209,139,0.3)"
                  : m.dominant === "negative" ? "1px solid rgba(255,92,92,0.3)"
                  : m.dominant === "neutral" ? "1px solid rgba(167,139,250,0.2)"
                  : "1px solid transparent",
              }}
                title={m.date}
              >
                {m.dominant === "positive" ? "🙂"
                  : m.dominant === "negative" ? "😔"
                  : m.dominant === "neutral" ? "😐"
                  : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div style={{ padding: "4px 16px 0" }}>
        <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
          Consistência · {tabLabel}
        </p>
        <div style={{
          background: "oklch(0.16 0.012 270)",
          border: "1px solid oklch(0.28 0.02 270 / 0.5)",
          borderRadius: 18, padding: "12px 10px",
          display: "flex", flexWrap: "wrap", gap: 3,
        }}>
          {heatmapData.map((cell, i) => (
            <div key={i} style={{
              width: periodDays > 30 ? 11 : 14,
              height: periodDays > 30 ? 11 : 14,
              borderRadius: 3,
              flexShrink: 0,
              background: cell.filled ? "#7C5CFF" : "oklch(0.22 0.02 270)",
              opacity: cell.filled ? 1 : 0.5,
              transition: "transform 0.15s ease",
            }}
              title={`${cell.date}${cell.filled ? " ✓" : ""}`}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 8px 0" }}>
          <span style={{ fontSize: 9, color: "oklch(0.5 0.02 270)" }}>
            {heatmapData.filter((c) => c.filled).length}/{periodDays} dias
          </span>
          <span style={{ fontSize: 9, color: "oklch(0.5 0.02 270)" }}>
            {periodDays > 0 ? Math.round((heatmapData.filter((c) => c.filled).length / periodDays) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Fatores de impacto */}
      {impactFactors.length > 0 && (
        <div style={{ padding: "20px 16px 0" }}>
          <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
            O que mais impacta seu bem-estar
          </p>
          <div style={{
            background: "oklch(0.16 0.012 270)",
            border: "1px solid oklch(0.28 0.02 270 / 0.5)",
            borderRadius: 18, padding: "16px 18px",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#e0d6ff", lineHeight: 1.4 }}>
              {impactFactors[0]?.label
                ? `${impactFactors[0].label} é o hábito que mais acompanha seus dias bons.`
                : "Continue registrando para ver seus padrões."}
            </p>
            {impactFactors.map((f) => (
              <div key={f.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#e0d6ff" }}>{f.label}</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: f.negative ? "#FF5C5C" : "#A78BFA",
                  }}>
                    {f.pct} pts
                  </span>
                </div>
                <div style={{
                  height: 4, borderRadius: 9999,
                  background: "oklch(0.25 0.02 270)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${Math.min(f.pct, 100)}%`,
                    borderRadius: 9999,
                    background: f.negative ? "#FF5C5C" : "#7C5CFF",
                    boxShadow: f.negative ? "none" : "0 0 6px rgba(124,92,255,0.35)",
                    transition: "width 0.7s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no data at all */}
      {checkIns.length === 0 && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ color: "oklch(0.55 0.03 270)", fontSize: 15, margin: "0 0 8px" }}>
            Nenhum check-in ainda
          </p>
          <p style={{ color: "oklch(0.45 0.02 270)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Faça seu primeiro check-in para começar a ver sua evolução por aqui.
          </p>
        </div>
      )}
        </>
      )}

      {/* ── HUB: CRESCIMENTO PESSOAL ── */}
      {hub === "crescimento" && (
        <>
          {/* Tabs (período) — crescimento */}
          <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
            {(["semana", "mes", "trimestre"] as const).map((t) => (
              <button key={t} type="button" style={tabStyle(crescTab === t)} onClick={() => setCrescTab(t)}>
                {t === "semana" ? "Semana" : t === "mes" ? "Mês" : "Trimestre"}
              </button>
            ))}
          </div>

          <MetasResumo />
          <OKRProgress period={crescTab} />
          <AreaBalance from={crescFrom} to={crescTo} />
          <SemanalTrend from={crescFrom} to={crescTo} />
        </>
      )}
    </div>
  );
}
