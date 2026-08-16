"use client";

import { useEffect, useState, useMemo } from "react";
import { cachedFetch } from "@/lib/fetch-cache";
import { MOOD_CHIPS } from "@/lib/checkin-moods";
import { sleepScore } from "@/lib/sleep-utils";
import type { CheckIn, SleepLog, AgendaItem } from "@/types";
import { GrowthScore } from "@/components/analise/GrowthScore";
import { MetasResumo } from "@/components/analise/MetasResumo";
import { OKRProgress } from "@/components/analise/OKRProgress";
import { FinancasResumo } from "@/components/analise/FinancasResumo";
import { AreaBalance } from "@/components/analise/AreaBalance";
import { SemanalTrend } from "@/components/analise/SemanalTrend";
import { NutricaoResumo } from "@/components/analise/NutricaoResumo";
import { MovimentoResumo } from "@/components/analise/MovimentoResumo";
import { PausaResumo } from "@/components/analise/PausaResumo";
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

/** Largura (px) do viewBox do gráfico de tendência — mín. 280 p/ a semana não ficar apertada. */
function trendChartWidth(count: number): number {
  return Math.max(count * 16, 280);
}

/** X de um ponto do gráfico: espalha os dias igualmente por toda a largura do viewBox. */
function trendChartX(i: number, count: number): number {
  const w = trendChartWidth(count);
  if (count <= 1) return w / 2;
  return (i / (count - 1)) * w;
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

/** Wellness score 0–100 from a single check-in, based on enabled habit keys.
 *  Hábito cumprido = 100, não cumprido = 0. Todo hábito habilitado conta —
 *  pular = "não fez", então o pulado também entra na média como 0. */
function wellnessScore(ci: CheckIn, habitKeys: string[]): number {
  if (habitKeys.length === 0) return 50;

  let sum = 0;
  let count = 0;
  for (const k of habitKeys) {
    if (k === "suicidal_thoughts" || k === "water_cups") continue;

    // Hidratação é contínua: 0 copos = 0, 4+ copos = 100 (mesma meta da UI).
    if (k === "drank_water") {
      const cups = ci.water_cups ?? 0;
      sum += Math.min((cups / 4) * 100, 100);
      count++;
      continue;
    }

    const v = (ci as unknown as Record<string, unknown>)[k];
    if (v === undefined) continue;

    if (k === "felt_judged") {
      // Sentir-se julgado é negativo para o bem-estar: inverte a pontuação.
      sum += v === true ? 0 : 100;
    } else {
      sum += v === true ? 100 : 0;
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
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"semana" | "mes" | "trimestre">("semana");
  const [hub, setHub] = useState<"bemestar" | "crescimento">("bemestar");
  const [crescTab, setCrescTab] = useState<"semana" | "mes" | "trimestre">("trimestre");
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [ringInfo, setRingInfo] = useState(false);

  const periodDays = { semana: 7, mes: 30, trimestre: 90 }[tab];
  const crescPeriodDays = { semana: 7, mes: 30, trimestre: 90 }[crescTab];

  useEffect(() => {
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ enabled_questions?: string[] }>("/api/preferences"),
      cachedFetch<SleepLog[]>("/api/sleep?limit=200"),
    ])
      .then(([ci, prefs, sleep]) => {
        if (Array.isArray(ci)) setCheckIns(ci);
        if (Array.isArray(sleep)) setSleepLogs(sleep);
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

    // ── movimento (caminhada/corrida/musculação) ──
    const movimentoPct = periodCI.length > 0
      ? Math.round((periodCI.filter((c) => c.walked === true || c.ran === true || c.strength_training === true).length / periodCI.length) * 100)
      : 0;
    const prevMovimentoPct = prevCI.length > 0
      ? Math.round((prevCI.filter((c) => c.walked === true || c.ran === true || c.strength_training === true).length / prevCI.length) * 100)
      : 0;
    const movimentoTrend = prevMovimentoPct > 0 ? Math.round(((movimentoPct - prevMovimentoPct) / prevMovimentoPct) * 100) : 0;

    // ── pausa (meditação/oração/respiração) ──
    const pausaPct = periodCI.length > 0
      ? Math.round((periodCI.filter((c) => c.meditation === true || c.prayer === true || c.breathing === true).length / periodCI.length) * 100)
      : 0;
    const prevPausaPct = prevCI.length > 0
      ? Math.round((prevCI.filter((c) => c.meditation === true || c.prayer === true || c.breathing === true).length / prevCI.length) * 100)
      : 0;
    const pausaTrend = prevPausaPct > 0 ? Math.round(((pausaPct - prevPausaPct) / prevPausaPct) * 100) : 0;

    return {
      sono: { pct: sonoPct, trend: sonoTrend, display: sonoDisplay, sleptWellPct },
      humor: { pct: humorPct, trend: humorTrend },
      foco: { pct: focoPct, trend: focoTrend },
      movimento: { pct: movimentoPct, trend: movimentoTrend },
      pausa: { pct: pausaPct, trend: pausaTrend },
    };
  }, [periodCI, prevCI, periodSleep, prevSleep, agendaItems, periodDays]);

  // ── impact factors ────────────────────────────────────────────────────────

  const impactFactors = useMemo(() => {
    if (checkIns.length < 5 || habitKeys.length === 0) return [];

    // Compute wellness for each check-in
    const scores = checkIns.map((ci) => wellnessScore(ci, habitKeys));

    // Only behavioral, actionable habits — no bodily functions or external events
    const habitLabels: Record<string, string> = {
      slept_well: "Sono",
      ate_well: "Alimentação",
      meditation: "Meditação",
      prayer: "Oração",
      breathing: "Respiração",
      walked: "Caminhada",
      ran: "Corrida",
      strength_training: "Musculação",
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
      description: "Qualidade do sono no período, combinando duração, qualidade, interrupções e sonhos. Sem registro detalhado, usa o % de noites bem dormidas.",
    },
    {
      label: "Humor",
      pct: areas.humor.pct,
      trend: areas.humor.trend,
      positive: areas.humor.trend >= 0,
      detail: null,
      description: "Equilíbrio emocional: proporção de humores positivos em relação aos negativos registrados nos check-ins.",
    },
    {
      label: "Foco",
      pct: areas.foco.pct,
      trend: areas.foco.trend,
      positive: areas.foco.trend >= 0,
      detail: null,
      description: "Execução do que você planejou na agenda, somada a ter trabalhado nas suas metas.",
    },
    {
      label: "Movimento",
      pct: areas.movimento.pct,
      trend: areas.movimento.trend,
      positive: areas.movimento.trend >= 0,
      detail: null,
      description: "% de dias em que você se movimentou — caminhada, corrida ou musculação.",
    },
    {
      label: "Pausa",
      pct: areas.pausa.pct,
      trend: areas.pausa.trend,
      positive: areas.pausa.trend >= 0,
      detail: null,
      description: "% de dias com uma prática de pausa: meditação, oração ou respiração intencional.",
    },
  ];

  const tabLabel = tab === "semana" ? "esta semana" : tab === "mes" ? "este mês" : "este trimestre";
  const crescTabLabel = crescTab === "semana" ? "esta semana" : crescTab === "mes" ? "este mês" : "este trimestre";
  const crescFrom = daysAgo(crescPeriodDays - 1);
  const crescTo = daysAgo(0);

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
      {/* Score de bem-estar */}
      {periodCI.length >= 2 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0" }}>
          <div style={{ position: "relative" }}>
            <div style={{
              width: 140, height: 140, borderRadius: "50%",
              background: `conic-gradient(#7C5CFF ${Math.max(0, Math.min(wellnessAvg ?? 50, 100)) * 3.6}deg, oklch(0.22 0.02 270) 0deg)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 106, height: 106, borderRadius: "50%",
                background: "oklch(0.12 0.012 270)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#e0d6ff", lineHeight: 1 }}>
                  {wellnessAvg != null ? Math.round(wellnessAvg) : "—"}
                </span>
                <span style={{ fontSize: 10, color: "oklch(0.55 0.03 270)", marginTop: 2 }}>
                  Bem-estar
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRingInfo((v) => !v)}
              aria-label="O que é bem-estar"
              title="O que é bem-estar"
              style={{
                position: "absolute", top: 6, right: 6,
                width: 20, height: 20, borderRadius: "50%",
                border: "1px solid oklch(0.5 0.12 270 / 0.4)",
                background: "oklch(0.16 0.012 270)", cursor: "pointer",
                color: ringInfo ? "#7C5CFF" : "oklch(0.55 0.03 270)",
                fontSize: 11, fontWeight: 700, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0, fontFamily: "inherit",
              }}
            >
              i
            </button>
          </div>
          {evolutionPct != null && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: evolutionPct > 0 ? "#22D18B" : evolutionPct < 0 ? "#FF5C5C" : "oklch(0.55 0.03 270)",
              }}>
                {evolutionPct > 0 ? "▲ +" : evolutionPct < 0 ? "▼ " : "— "}{evolutionPct}%
              </span>
              <span style={{ fontSize: 12, color: "oklch(0.55 0.03 270)" }}>vs período anterior</span>
            </div>
          )}
          {ringInfo && (
            <p style={{
              margin: "10px 0 0", maxWidth: 320, fontSize: 11, lineHeight: 1.45,
              color: "oklch(0.62 0.03 270)",
              background: "oklch(0.2 0.02 270)",
              borderRadius: 10, padding: "8px 10px", textAlign: "center",
            }}>
              Nota de 0 a 100 que mede quanto dos seus hábitos você cumpriu no período.
              Só entram os hábitos que você realmente respondeu (os pulados não contam);
              sentir-se julgado reduz a nota e a água pontua conforme os copos.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <p style={{ color: "oklch(0.55 0.03 270)", fontSize: 14 }}>
            Registre {3 - periodCI.length} {3 - periodCI.length === 1 ? "dia" : "dias"} a mais para ver seu bem-estar.
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
            <svg viewBox={`0 0 ${trendChartWidth(trendData.length)} 120`} preserveAspectRatio="none" style={{ width: "100%", height: 120 }}>
              {/* Grid lines */}
              {[25, 50, 75].map((y) => (
                <line key={y} x1={0} x2={trendChartWidth(trendData.length)} y1={120 - y * 1.2} y2={120 - y * 1.2}
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
                  .map((p, i) => p.score == null ? null : `${trendChartX(i, trendData.length)},${120 - p.score * 1.2}`)
                  .filter(Boolean)
                  .join(" ")}
              />
              {/* Dots */}
              {trendData.map((p, i) => {
                if (p.score == null) return null;
                const x = trendChartX(i, trendData.length);
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
                      .map((p, i) => p.score != null ? `${trendChartX(i, trendData.length)},${120 - p.score * 1.2}` : null)
                      .filter(Boolean);
                    if (pts.length === 0) return "";
                    const firstI = trendData.findIndex((p) => p.score != null);
                    const lastI = trendData.length - 1 - [...trendData].reverse().findIndex((p) => p.score != null);
                    return `${trendChartX(firstI, trendData.length)},120 ${pts.join(" ")} ${trendChartX(lastI, trendData.length)},120`;
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

      {/* Áreas em destaque */}
      <div style={{ padding: "20px 16px 0" }}>
        <p style={{ margin: "0 0 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}>
          Áreas em destaque
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {areaCards.map((a, idx) => {
            const spansFull = idx === areaCards.length - 1 && areaCards.length % 2 === 1;
            const infoOpen = openInfo === a.label;
            return (
              <div key={a.label} style={{
                background: "oklch(0.16 0.012 270)",
                border: "1px solid oklch(0.28 0.02 270 / 0.5)",
                borderRadius: 16, padding: "14px 12px",
                ...(spansFull ? { gridColumn: "1 / -1" } : {}),
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "oklch(0.55 0.03 270)", fontWeight: 500 }}>{a.label}</p>
                  <button
                    type="button"
                    onClick={() => setOpenInfo(infoOpen ? null : a.label)}
                    aria-label={`O que é ${a.label}`}
                    title={`O que é ${a.label}`}
                    style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "1px solid oklch(0.5 0.12 270 / 0.4)",
                      background: "transparent", cursor: "pointer",
                      color: infoOpen ? "#7C5CFF" : "oklch(0.55 0.03 270)",
                      fontSize: 11, fontWeight: 700, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: 0, flexShrink: 0, fontFamily: "inherit",
                      transition: "color .15s ease, border-color .15s ease",
                    }}
                  >
                    i
                  </button>
                </div>
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
                    background: "linear-gradient(90deg, #7C5CFF, #A78BFA)",
                  }} />
                </div>
                {infoOpen && (
                  <p style={{
                    margin: "8px 0 0", fontSize: 11, lineHeight: 1.45,
                    color: "oklch(0.62 0.03 270)",
                    background: "oklch(0.2 0.02 270)",
                    borderRadius: 10, padding: "8px 10px",
                  }}>
                    {a.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bem-estar complementar: nutrição, movimento, leitura */}
      <NutricaoResumo from={daysAgo(periodDays - 1)} to={daysAgo(0)} />
      <MovimentoResumo from={daysAgo(periodDays - 1)} to={daysAgo(0)} checkIns={periodCI} />
      <PausaResumo checkIns={periodCI} />
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
            display: "flex", flexWrap: "wrap", gap: 3,
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

          <GrowthScore from={crescFrom} to={crescTo} />
          <MetasResumo />
          <OKRProgress period={crescTab} />
          <FinancasResumo period={crescTab} />
          <AreaBalance from={crescFrom} to={crescTo} />
          <SemanalTrend from={crescFrom} to={crescTo} />
        </>
      )}
    </div>
  );
}
