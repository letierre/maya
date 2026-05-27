"use client";

import { useEffect, useState, useMemo } from "react";
import { getLocalDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cachedFetch } from "@/lib/fetch-cache";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { photoUrl } from "@/lib/photo-storage";
import { sumMacros, nutritionScore, getDailyKcalGoal, DEFAULT_DAILY_KCAL } from "@/lib/meal-utils";
import { ArrowRight, ChevronRight, Pencil } from "lucide-react";
import type { CheckIn, Meal } from "@/types";
import { getMoodById, getMoodLabel } from "@/lib/checkin-moods";

const HABIT_DISPLAY: Record<string, [string, string]> = {
  took_medication: ["💊", "Remédios"],
  talked_to_someone: ["🗣️", "Conversou"],
  meditation_prayer_breathing: ["🧘", "Meditou/Orou"],
  creative_activity: ["🎨", "Criatividade"],
  ate_well: ["🍽️", "Comeu bem"],
  bowel_movement: ["🚽", "Intestino OK"],
  exercise_walk: ["🏃", "Exercício"],
  // drank_water shown as ml chip separately
  slept_well: ["😴", "Sono"],
  did_something_enjoyable: ["😊", "Algo que gostou"],
  worked_on_goals: ["🎯", "Metas"],
};


function greetingTimeOfDay(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("bom_dia");
  if (h < 18) return t("boa_tarde");
  return t("boa_noite");
}

function formatDayNum(dateStr: string) {
  return new Date(dateStr + "T12:00:00").getDate().toString();
}

function formatWeekdayShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00")
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .toUpperCase()
    .replace(".", "");
}

// ── Helpers ────────────────────────────────────────────────────

function Section({
  label,
  extra,
  children,
}: {
  label: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 pt-7 relative">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11px] font-bold tracking-[.12em] uppercase text-muted-foreground">
          {label}
        </span>
        {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function SoftRow({
  accent,
  accentText,
  tag,
  body,
  onClick,
}: {
  accent: string;
  accentText: string;
  tag: string;
  body: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 py-3.5 border-b text-left hover:bg-white/30 transition-colors"
      style={{ borderColor: "oklch(.5 .12 160 / .12)" }}
    >
      <span
        className="w-1 h-8 rounded-full flex-none mt-0.5"
        style={{ background: accent }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-[10.5px] font-bold tracking-[.08em] uppercase m-0"
          style={{ color: accentText }}
        >
          {tag}
        </p>
        <p className="mt-1 text-sm leading-[1.5]">{body}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-none mt-1" />
    </button>
  );
}

function NutritionRing({ score }: { score: number }) {
  const ringLen = 94.2;
  const dashLen = (score / 100) * ringLen;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const textColor = score >= 80 ? "#047857" : score >= 60 ? "#b45309" : "#be123c";

  return (
    <div className="w-[42px] h-[42px] relative flex-none">
      <svg
        viewBox="0 0 36 36"
        className="w-full h-full"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke="oklch(.25 .02 160 / .12)"
          strokeWidth="2.5"
        />
        <circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={`${dashLen} ${ringLen}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
        style={{ color: textColor }}
      >
        {score}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

interface Porque {
  id: string;
  text: string;
  photoPath: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [gender, setGender] = useState<string>("nao_dizer");
  const [loading, setLoading] = useState(true);
  const [todayDisplay, setTodayDisplay] = useState("");

  // New state
  const [mayaNudgeText, setMayaNudgeText] = useState<string | null>(null); // null = loading
  const [porques, setPorques] = useState<Porque[]>([]);
  const [porqueIndex, setPorqueIndex] = useState(0);
  const [porquePhoto, setPorquePhoto] = useState<string | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [kcalGoal, setKcalGoal] = useState(DEFAULT_DAILY_KCAL);
  const [portraitNarrative, setPortraitNarrative] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const d = new Date();
    const wk = d
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .toUpperCase()
      .replace(".", "");
    const dn = d
      .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
      .toUpperCase()
      .replace(".", "");
    setTodayDisplay(`${wk} · ${dn}`);
  }, []);

  useEffect(() => {
    const today = getLocalDate();

    // Main data — loads immediately, no AI dependency
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ onboarding_completed?: boolean; enabled_questions?: string[]; context?: Record<string, unknown> }>("/api/preferences"),
      fetch("/api/profile").then((r) => r.json()).catch(() => ({})),
      cachedFetch<Meal[]>(`/api/meals?date=${today}`),
      cachedFetch<Meal[]>("/api/meals"),
    ])
      .then(([checkInsData, prefsData, profileData, todayMealsData, allMealsData]) => {
        if (!prefsData.onboarding_completed) {
          router.push("/onboarding");
          return;
        }
        setEnabledKeys(prefsData.enabled_questions || []);
        setGender((prefsData.context as Record<string, unknown>)?.gender as string || "nao_dizer");
        setKcalGoal(getDailyKcalGoal((prefsData.context || {}) as Record<string, unknown>));

        if (Array.isArray(checkInsData)) {
          setCheckIns(checkInsData);
          setTodayCheckIn(checkInsData.find((c: CheckIn) => c.date === today) || null);
        }

        if (profileData.name) setUserName(profileData.name);
        if (profileData.porques?.length > 0) {
          setPorques(profileData.porques);
          const idx = Math.floor(Math.random() * profileData.porques.length);
          setPorqueIndex(idx);
          const pq = profileData.porques[idx];
          if (pq.photoPath) setPorquePhoto(photoUrl(pq.photoPath));
        }

        if (Array.isArray(todayMealsData)) setTodayMeals(todayMealsData);
        if (Array.isArray(allMealsData)) setAllMeals(allMealsData);

        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Maya nudge — independent fetch, doesn't block the dashboard
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((nudgeData) => {
        setMayaNudgeText(nudgeData.nudges?.[0]?.message ?? "");
      })
      .catch(() => setMayaNudgeText(""));
  }, [router]);

  // Portrait — fetch monthly
  useEffect(() => {
    const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const cacheKey = `monthly_portrait_${monthKey}_pt`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setPortraitNarrative(cached);
      return;
    }
    fetch("/api/reflect/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "pt" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.narrative) {
          setPortraitNarrative(data.narrative);
          localStorage.setItem(cacheKey, data.narrative);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-rotate porquê
  useEffect(() => {
    if (porques.length <= 1) return;
    const t = setInterval(() => {
      setPorqueIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * porques.length);
        } while (next === prev && porques.length > 1);
        const pq = porques[next];
        setPorquePhoto(pq.photoPath ? photoUrl(pq.photoPath) : null);
        return next;
      });
    }, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [porques]);

  // ── Compute ──────────────────────────────────────────────────

  const firstName = userName.split(" ")[0];

  const enabledNonSuicidal = enabledKeys.filter(
    (k) => k !== "suicidal_thoughts" && k !== "felt_judged",
  );
  const totalHabits = enabledNonSuicidal.length;

  const positiveCount = todayCheckIn
    ? enabledNonSuicidal.filter(
        (k) => (todayCheckIn as Record<string, unknown>)[k] === true,
      ).length
    : 0;

  const positivePct = totalHabits > 0 ? Math.round((positiveCount / totalHabits) * 100) : 0;

  const completedHabits = todayCheckIn
    ? enabledNonSuicidal
        .filter((k) => (todayCheckIn as Record<string, unknown>)[k] === true)
        .map((k) => HABIT_DISPLAY[k] || ["•", k])
    : [];

  // ── Fio da Semana ────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const mealsByDay = new Map<string, Meal[]>();
    for (const m of allMeals) {
      const d = new Date(m.data_hora);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = mealsByDay.get(ds) || [];
      arr.push(m);
      mealsByDay.set(ds, arr);
    }

    const today = getLocalDate();
    const habitKeys = enabledKeys.filter(
      (k) => k !== "suicidal_thoughts" && k !== "felt_judged",
    );

    const days: {
      label: string;
      energy: number | null;
      sleep: boolean | null;
      meals: number;
      kcal: number;
      cuidados: number | null;
      today: boolean;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);
      const dayMeals = mealsByDay.get(ds) || [];
      const analyzed = dayMeals.filter((m) => m.macros && m.status_analise === "analisado");
      const total = sumMacros(analyzed);

      days.push({
        label: d
          .toLocaleDateString("pt-BR", { weekday: "short" })
          .replace(".", ""),
        energy: (ci as any)?.energy_level ?? null,
        sleep: ci?.slept_well ?? null,
        meals: analyzed.length,
        kcal: Math.round(total.calorias_kcal),
        cuidados: ci
          ? habitKeys.filter((k) => (ci as Record<string, unknown>)[k] === true).length
          : null,
        today: ds === today,
      });
    }
    return days;
  }, [checkIns, allMeals, enabledKeys]);

  // ── Evolução ─────────────────────────────────────────────────

  const scoreKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts");

  const sparkData = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const points: { date: string; score: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);
      const score = ci
        ? scoreKeys.filter((k) => (ci as Record<string, unknown>)[k] === true).length
        : 0;
      points.push({
        date: d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", ""),
        score,
      });
    }
    return points;
  }, [checkIns, scoreKeys]);

  const sparkScores = sparkData.map((p) => p.score);
  const sparkHasData = sparkData.some((p) => p.score > 0);
  const sparkAvg =
    sparkData.filter((p) => p.score > 0).length > 0
      ? sparkScores.reduce((a, b) => a + b, 0) / sparkData.length
      : 0;

  const sparkTrend =
    sparkData.filter((p) => p.score > 0).length >= 2
      ? (() => {
          const firstHalf = sparkData.slice(0, 7);
          const secondHalf = sparkData.slice(7);
          const avg1 = firstHalf.reduce((a, b) => a + b.score, 0) / firstHalf.length;
          const avg2 = secondHalf.reduce((a, b) => a + b.score, 0) / secondHalf.length;
          if (avg2 - avg1 > 0.5) return t("subindo");
          if (avg1 - avg2 > 0.5) return t("caindo");
          return t("estavel");
        })()
      : "";

  const sparkDateLabels = useMemo(() => {
    if (sparkData.length === 0) return ["", "", ""];
    const first = sparkData[0].date;
    const mid = sparkData[Math.floor(sparkData.length / 2)].date;
    const last = sparkData[sparkData.length - 1].date;
    return [first, mid, last];
  }, [sparkData]);

  // ── Testemunha ───────────────────────────────────────────────

  const testemunhaMsg = useMemo(() => {
    if (checkIns.length < 2) return null;
    const recent = checkIns.slice(0, 7);
    const NEGATIVE_TAGS = new Set(["cansada", "ansiosa", "triste", "irritada", "sobrecarregada"]);
    const hardDays = recent.filter((ci) => {
      const energy = (ci as any).energy_level;
      const feeling = (ci.feeling || "").toLowerCase();
      const tags: string[] = ci.mood_tags ?? [];
      return (
        (energy !== null && energy !== undefined && energy <= 4) ||
        tags.some((t) => NEGATIVE_TAGS.has(t)) ||
        feeling.includes("triste") ||
        feeling.includes("ansios") ||
        feeling.includes("cansad") ||
        feeling.includes("mal") ||
        feeling.includes("ruim")
      );
    });

    if (hardDays.length >= 2) {
      return (
        <>
          {t("testemunha_hard_days_plural", { n: String(hardDays.length) })}{" "}
          <span className="text-muted-foreground">{t("testemunha_presence", { n: String(recent.length) })}</span>
        </>
      );
    }
    if (hardDays.length === 1) {
      return (
        <>
          {t("testemunha_hard_days_single")}{" "}
          <span className="text-muted-foreground">{t("testemunha_presence", { n: String(recent.length) })}</span>
        </>
      );
    }
    return null;
  }, [checkIns, t]);

  // ── Nutrição ─────────────────────────────────────────────────

  const nutritionData = useMemo(() => {
    const analyzed = todayMeals.filter((m) => m.macros && m.status_analise === "analisado");
    const total = sumMacros(analyzed);
    const score = analyzed.length > 0 ? nutritionScore(analyzed) : null;
    return { analyzed, total, score };
  }, [todayMeals]);

  // ── Últimos check-ins ────────────────────────────────────────

  const recentCheckins = checkIns.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("carregando")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .55) 0%, transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.85 .07 160 / .35) 0%, transparent 60%),
          linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.94 .025 160) 100%)
        `,
      }}
    >

      {/* ── GREETING ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          {greetingTimeOfDay(t)}
        </p>
        <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">
          {firstName || "—"}
        </h1>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground uppercase">
          {todayDisplay}
        </p>
      </div>

      {/* ── MAYA PRESENCE BLOCK ─────────────────────────────────── */}
      <div className="mx-4 mt-3.5">
        <div
          className="relative rounded-[22px] overflow-hidden border p-5"
          style={{
            background: "linear-gradient(135deg, oklch(.5 .12 160 / .08) 0%, oklch(.5 .12 160 / .02) 100%)",
            borderColor: "oklch(.5 .12 160 / .15)",
          }}
        >
          {/* Decorative rings */}
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full border pointer-events-none"
            style={{ borderColor: "oklch(.5 .12 160 / .12)" }} />
          <div className="absolute -right-5 -top-5 w-[120px] h-[120px] rounded-full border pointer-events-none"
            style={{ borderColor: "oklch(.5 .12 160 / .08)" }} />

          <div className="relative flex gap-3.5 items-start">
            <span className="w-14 h-14 rounded-full overflow-hidden flex-none border-2 border-white shadow-lg">
              <img src="/Maya.png" alt="Maya" className="w-full h-full object-cover" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-bold tracking-wider uppercase text-primary m-0">
                {t("maya_agora")}
              </p>
              {mayaNudgeText === null ? (
                /* Skeleton while nudge loads */
                <div className="mt-2 space-y-2">
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[90%]" />
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[75%]" />
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[55%]" />
                </div>
              ) : (
                <p className="mt-1.5 text-base leading-[1.4] font-medium tracking-tight whitespace-pre-wrap">
                  {mayaNudgeText || t("nudge_boas_vindas")}
                </p>
              )}
            </div>
          </div>

          <Button
            className="mt-3.5 w-full h-[38px] rounded-xl text-[13px] font-semibold gap-1.5"
            onClick={() => router.push("/insights")}
          >
            {t("conversar_com_maya")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── MEU PORQUÊ ────────────────────────────────────────── */}
      {porques.length > 0 && (
        <Section label={t("meu_porque_label")}>
          <div className="grid grid-cols-[92px_1fr] gap-3.5 items-center py-1">
            <div
              className="w-[92px] h-[92px] rounded-2xl overflow-hidden shadow-md bg-gradient-to-br from-pink-200 to-pink-50 flex items-center justify-center"
            >
              {porquePhoto ? (
                <img
                  src={porquePhoto}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="#fb7185"
                  opacity=".6"
                >
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  <path d="M3 21a9 9 0 0 1 18 0Z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-base italic font-medium leading-[1.4] tracking-tight m-0">
                &ldquo;{porques[porqueIndex]?.text || "—"}&rdquo;
              </p>
              <div className="flex gap-1.5 mt-2.5">
                {porques.map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        i === porqueIndex
                          ? "var(--primary)"
                          : "oklch(.5 .12 160 / .25)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── CUIDADOS DE HOJE ──────────────────────────────────── */}
      <Section
        label={t("cuidados_de_hoje")}
        extra={
          <button
            type="button"
            onClick={() => router.push("/check-in")}
            className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            aria-label="Editar check-in"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        }
      >
        {!todayCheckIn ? (
          /* ── SEM CHECK-IN HOJE: CTA proeminente ─── */
          <button
            type="button"
            onClick={() => router.push("/check-in")}
            className="w-full py-5 rounded-2xl flex flex-col items-center gap-2 border-2 border-dashed transition-colors hover:opacity-80"
            style={{
              borderColor: "oklch(.5 .12 160 / .35)",
              background: "oklch(.5 .12 160 / .04)",
            }}
          >
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "oklch(.5 .12 160 / .1)" }}
            >
              <Pencil className="w-4 h-4 text-primary" />
            </span>
            <span className="text-[14px] font-semibold text-primary leading-tight">
              Registrar check-in de hoje
            </span>
            <span className="text-[11px] text-muted-foreground">
              Seu bem-estar começa aqui
            </span>
          </button>
        ) : (
          /* ── COM CHECK-IN: mostrar dados + editar ─ */
          <>
            <div className="flex items-baseline gap-1.5 mb-3.5">
              <span className="text-[36px] font-bold tracking-tight leading-none tabular-nums">
                {positiveCount}
              </span>
              <span className="text-[22px] text-muted-foreground font-normal">
                / {totalHabits}
              </span>
              <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                {totalHabits > 0 ? positivePct : 0}%
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {completedHabits.map(([emoji, label]) => (
                <span
                  key={label}
                  className="px-2.5 py-[5px] rounded-full text-[11.5px] font-medium border bg-white/70 inline-flex items-center gap-1"
                >
                  {emoji} {label}
                </span>
              ))}
              {/* Water chip — always shows actual ml consumed */}
              {todayCheckIn && (
                <span
                  className="px-2.5 py-[5px] rounded-full text-[11.5px] font-medium border inline-flex items-center gap-1"
                  style={{
                    background: (todayCheckIn.water_cups ?? 0) >= 4
                      ? "oklch(.5 .12 160 / .12)"
                      : "oklch(1 0 0 / .7)",
                    borderColor: (todayCheckIn.water_cups ?? 0) >= 4
                      ? "oklch(.5 .12 160 / .3)"
                      : undefined,
                    color: (todayCheckIn.water_cups ?? 0) >= 4
                      ? "oklch(.35 .1 160)"
                      : undefined,
                  }}
                >
                  💧 {(todayCheckIn.water_cups ?? 0) * 250}ml
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/check-in")}
              className="mt-3 flex items-center gap-1.5 text-[11.5px] text-primary hover:opacity-70 transition-opacity"
            >
              <Pencil className="w-3 h-3" />
              Editar check-in
            </button>
          </>
        )}
      </Section>

      {/* ── O FIO DA SEMANA ───────────────────────────────────── */}
      <Section label={t("fio_titulo")}>
        <div className="relative">
          <div
            className="absolute left-[22px] top-3.5 bottom-3.5 w-[1.5px]"
            style={{ background: "oklch(.5 .12 160 / .15)" }}
          />
          {weekDays.map((day) => {
            const energyColor =
              day.energy !== null
                ? day.energy >= 7
                  ? "#059669"
                  : day.energy >= 5
                    ? "#b45309"
                    : "#dc2626"
                : "var(--muted-foreground)";
            return (
              <div
                key={day.label}
                className="flex items-center gap-3.5 py-2 relative"
                style={{ opacity: day.today ? 1 : 0.85 }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-none z-10 relative"
                  style={{
                    marginLeft: 16,
                    background: day.today ? "var(--primary)" : "#fff",
                    border: `2px solid ${
                      day.today ? "var(--primary)" : "oklch(.5 .12 160 / .35)"
                    }`,
                    boxShadow: day.today
                      ? "0 0 0 4px oklch(.5 .12 160 / .12)"
                      : "none",
                  }}
                />
                <span
                  className="text-[11.5px] uppercase tracking-[.05em] w-[30px]"
                  style={{
                    fontWeight: day.today ? 700 : 500,
                    color: day.today
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                  }}
                >
                  {day.label}
                </span>
                <span className="text-sm leading-none" style={{ visibility: day.sleep === true ? "visible" : "hidden" }}>🌙</span>
                {day.energy !== null && (
                  <span
                    className="text-[13px] font-bold tabular-nums w-[32px]"
                    style={{ color: energyColor }}
                  >
                    {day.energy}/10
                  </span>
                )}
                {day.cuidados !== null && (
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{
                      color:
                        day.cuidados >= 7
                          ? "#059669"
                          : day.cuidados >= 5
                            ? "#b45309"
                            : "#dc2626",
                    }}
                  >
                    {day.cuidados}/{totalHabits}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums text-right" style={{ minWidth: 80 }}>
                  {day.meals > 0
                    ? `${day.meals} ${t("ref_abrev")} · ${day.kcal} kcal`
                    : ""}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── EVOLUÇÃO ──────────────────────────────────────────── */}
      {checkIns.length >= 2 && sparkHasData && (
        <Section
          label={t("evolucao")}
          extra={
            `${t("media_energia", { n: sparkAvg.toFixed(1) })} · ${sparkTrend}`
          }
        >
          <Sparkline data={sparkScores} maxVal={scoreKeys.length || 1} />
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
            {sparkDateLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </Section>
      )}

      {/* ── REFLEXIVAS ────────────────────────────────────────── */}
      <div className="px-6 pt-8">
        {nutritionData.score !== null && (
          <button
            type="button"
            className="w-full flex items-center gap-3.5 py-4 text-left hover:bg-white/30 transition-colors"
            onClick={() => router.push("/nutricao")}
          >
            <NutritionRing score={nutritionData.score} />
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-bold tracking-[.08em] uppercase text-muted-foreground m-0">
                {t("nutricao")}
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-bold tracking-tight leading-none tabular-nums">
                  {nutritionData.total.calorias_kcal}
                </span>
                <span className="text-xs text-muted-foreground">
                  kcal · {nutritionData.analyzed.length}{" "}
                  {nutritionData.analyzed.length === 1 ? "refeição" : "refeições"}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ── ÚLTIMOS CHECK-INS ─────────────────────────────────── */}
      <Section
        label={t("ultimos_checkins")}
        extra={
          <button
            type="button"
            className="text-primary text-[11px] hover:underline"
            onClick={() => router.push("/historico")}
          >
            {t("ver_todos")} →
          </button>
        }
      >
        <div>
          {recentCheckins.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("nenhum_checkin")}
            </p>
          )}
          {recentCheckins.map((ci, i) => (
            <div
              key={ci.id}
              className="grid grid-cols-[52px_1fr] py-3 items-baseline"
              style={{
                borderTop:
                  i === 0
                    ? "none"
                    : "1px solid oklch(.5 .12 160 / .1)",
              }}
            >
              <div>
                <div className="text-[13px] font-semibold leading-none tabular-nums">
                  {formatDayNum(ci.date)}
                </div>
                <div className="text-[9.5px] font-semibold tracking-wider uppercase text-muted-foreground mt-0.5">
                  {formatWeekdayShort(ci.date)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 items-center min-h-[20px]">
                {(ci.mood_tags ?? []).length > 0
                  ? (ci.mood_tags ?? []).map((tagId) => {
                      const chip = getMoodById(tagId);
                      if (!chip) return null;
                      return (
                        <span key={tagId} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 8px", borderRadius: 9999,
                          fontSize: 11.5, fontWeight: 600,
                          background: chip.valence === "positive"
                            ? "oklch(.5 .12 160 / .12)"
                            : "oklch(.72 .1 30 / .14)",
                          color: chip.valence === "positive"
                            ? "oklch(.35 .1 160)"
                            : "oklch(.38 .09 30)",
                        }}>
                          <span style={{ fontSize: 13 }}>{chip.emoji}</span>
                          {getMoodLabel(chip, gender)}
                        </span>
                      );
                    })
                  : ci.feeling
                    ? <span className="text-[13px] leading-[1.45]" style={{ color: "var(--foreground)" }}>
                        {ci.feeling.length > 60 ? ci.feeling.slice(0, 60) + "…" : ci.feeling}
                      </span>
                    : <span className="text-[13px] italic" style={{ color: "var(--muted-foreground)" }}>—</span>
                }
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ height: 120 }} />
    </div>
  );
}

// ── Sparkline SVG ──────────────────────────────────────────────

function Sparkline({ data, maxVal }: { data: number[]; maxVal: number }) {
  const W = 320;
  const H = 100;
  const P = 4;
  const max = maxVal || 1;
  const min = 0;

  if (data.length === 0) return null;

  const xStep = (W - P * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = P + i * xStep;
    const y = P + (H - P * 2) * (1 - (v - min) / (max - min));
    return [x, y] as const;
  });
  const line = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");
  const fill = `${line} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`;
  const last = points[points.length - 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="msFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(.5 .12 160)" stopOpacity=".22" />
            <stop offset="100%" stopColor="oklch(.5 .12 160)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={P}
          x2={W - P}
          y1={H / 2}
          y2={H / 2}
          stroke="oklch(.5 .12 160 / .35)"
          strokeDasharray="2 4"
        />
        <path d={fill} fill="url(#msFill)" />
        <path
          d={line}
          fill="none"
          stroke="oklch(.5 .12 160)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={last[0]}
          cy={last[1]}
          r="4"
          fill="#fff"
          stroke="oklch(.5 .12 160)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
