"use client";

import { useEffect, useState, useMemo } from "react";
import { getLocalDate, calculateStreak } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cachedFetch } from "@/lib/fetch-cache";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { photoUrl } from "@/lib/photo-storage";
import { sumMacros, nutritionScore, getDailyKcalGoal, DEFAULT_DAILY_KCAL } from "@/lib/meal-utils";
import { ArrowRight, ChevronRight, MoreVertical } from "lucide-react";
import type { CheckIn, Meal } from "@/types";

const HABIT_DISPLAY: Record<string, [string, string]> = {
  took_medication: ["💊", "Remédios"],
  talked_to_someone: ["🗣️", "Conversou"],
  meditation_prayer_breathing: ["🧘", "Meditou/Orou"],
  creative_activity: ["🎨", "Criatividade"],
  ate_well: ["🍽️", "Comeu bem"],
  bowel_movement: ["🚽", "Fez cocô"],
  exercise_walk: ["🏃", "Exercício"],
  drank_water: ["💧", "Água 1L"],
  slept_well: ["😴", "Sono"],
  did_something_enjoyable: ["😊", "Algo que gostou"],
  worked_on_goals: ["🎯", "Metas"],
};

const TIERS = [
  { rom: "I",   key: "tier_iniciante", th: 0,  color: "#e4e4e7" },
  { rom: "II",  key: "tier_bronze",    th: 3,  color: "#fde68a" },
  { rom: "III", key: "tier_prata",     th: 7,  color: "#cbd5e1" },
  { rom: "IV",  key: "tier_ouro",      th: 14, color: "#fde047" },
  { rom: "V",   key: "tier_diamante",  th: 30, color: "#a5f3fc" },
  { rom: "VI",  key: "tier_lendario",  th: 60, color: "#fbbf24" },
];

function greetingTimeOfDay(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("bom_dia");
  if (h < 18) return t("boa_tarde");
  return t("boa_noite");
}

function formatDayMonth(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
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
  const [mayaNudgeText, setMayaNudgeText] = useState("");
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

    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{ onboarding_completed?: boolean; enabled_questions?: string[]; context?: Record<string, unknown> }>("/api/preferences"),
      fetch("/api/maya/nudge").then((r) => r.json()).catch(() => ({ nudges: [] })),
      fetch("/api/profile").then((r) => r.json()).catch(() => ({})),
      cachedFetch<Meal[]>(`/api/meals?date=${today}`),
      cachedFetch<Meal[]>("/api/meals"),
    ])
      .then(([checkInsData, prefsData, nudgeData, profileData, todayMealsData, allMealsData]) => {
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

        if (nudgeData.nudges?.length > 0) {
          setMayaNudgeText(nudgeData.nudges[0].message);
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

  const streak = useMemo(
    () => calculateStreak(checkIns.map((c: CheckIn) => c.date)),
    [checkIns],
  );

  const firstName = userName.split(" ")[0];

  const tierIdx = TIERS.reduce((acc, tier, i) => (streak >= tier.th ? i : acc), 0);
  const curTier = TIERS[tierIdx];
  const nextTier = TIERS[tierIdx + 1];

  const streakExtra = nextTier
    ? t("dias_ate_tier", { n: String(nextTier.th - streak), tier: t(nextTier.key) })
    : undefined;

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
    const days: {
      label: string;
      energy: number | null;
      sleep: boolean | null;
      meals: number;
      kcal: number;
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
        today: ds === today,
      });
    }
    return days;
  }, [checkIns, allMeals]);

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
    const hardDays = recent.filter((ci) => {
      const energy = (ci as any).energy_level;
      const feeling = (ci.feeling || "").toLowerCase();
      return (
        (energy !== null && energy !== undefined && energy <= 4) ||
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
      className="relative min-h-screen"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .55) 0%, transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.85 .07 160 / .35) 0%, transparent 60%),
          linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.94 .025 160) 100%)
        `,
      }}
    >
      {/* Floating kebab */}
      <button
        type="button"
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/55 backdrop-blur-md border-0 flex items-center justify-center shadow-sm cursor-pointer"
        style={{ color: "var(--foreground)" }}
        aria-label="Menu"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

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

      {/* ── MAYA PRESENCE BLOCK ───────────────────────────────── */}
      <div className="mx-4 mt-3.5">
        <div
          className="relative rounded-[22px] overflow-hidden border p-5"
          style={{
            background:
              "linear-gradient(135deg, oklch(.5 .12 160 / .08) 0%, oklch(.5 .12 160 / .02) 100%)",
            borderColor: "oklch(.5 .12 160 / .15)",
          }}
        >
          {/* Decorative rings */}
          <div
            className="absolute -right-10 -top-10 w-40 h-40 rounded-full border"
            style={{ borderColor: "oklch(.5 .12 160 / .12)" }}
          />
          <div
            className="absolute -right-5 -top-5 w-30 h-30 rounded-full border"
            style={{ borderColor: "oklch(.5 .12 160 / .08)" }}
          />

          <div className="relative flex gap-3.5 items-start">
            <span className="w-14 h-14 rounded-full overflow-hidden flex-none border-2 border-white shadow-lg">
              <img
                src="/Maya.png"
                alt="Maya"
                className="w-full h-full object-cover"
              />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-bold tracking-wider uppercase text-primary m-0">
                {t("maya_agora")}
              </p>
              <p className="mt-1.5 text-base leading-[1.4] font-medium tracking-tight">
                {mayaNudgeText || t("maya_welcome")}
              </p>
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

      {/* ── SUA SEQUÊNCIA ─────────────────────────────────────── */}
      <Section label={t("sua_sequencia")} extra={streakExtra}>
        <div
          className="absolute top-[-8px] right-[-4px] text-[96px] font-extrabold leading-none tracking-[-0.04em] tabular-nums select-none pointer-events-none"
          style={{ color: "oklch(.5 .12 160 / .06)" }}
        >
          {streak}
        </div>

        <div className="relative -mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[42px] font-bold tracking-[-0.03em] text-primary leading-none tabular-nums">
              {streak}
            </span>
            <span className="text-sm font-medium">{t("dias_consecutivos")}</span>
          </div>

          <div className="flex gap-1 mt-3.5">
            {TIERS.map((tier, i) => {
              const reached = i <= tierIdx;
              const isCurrent = i === tierIdx;
              return (
                <div key={tier.rom} className="flex-1 relative">
                  <div
                    className="h-[5px] rounded-full"
                    style={{
                      background: reached ? tier.color : "var(--muted)",
                      border: isCurrent
                        ? "1px solid oklch(.5 .12 160 / .5)"
                        : "none",
                    }}
                  />
                  {isCurrent && (
                    <div
                      className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white shadow-md"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── CUIDADOS DE HOJE ──────────────────────────────────── */}
      <Section label={t("cuidados_de_hoje")}>
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
          {completedHabits.length === 0 && (
            <span className="text-sm text-muted-foreground italic">
              {t("sem_checkin")}
            </span>
          )}
        </div>
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
                <span className="text-sm">
                  {day.sleep === true ? "😴" : day.sleep === false ? "😵" : "—"}
                </span>
                <span
                  className="text-[13px] font-bold tabular-nums w-[32px]"
                  style={{ color: energyColor }}
                >
                  {day.energy !== null ? `${day.energy}/10` : "—"}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {day.meals > 0
                    ? `${day.meals} ${t("ref_abrev")} · ${day.kcal} kcal`
                    : "—"}
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
        {testemunhaMsg && (
          <SoftRow
            accent="#f43f5e"
            accentText="#be123c"
            tag={t("so_pra_voce_saber")}
            body={testemunhaMsg}
            onClick={() => router.push("/diario")}
          />
        )}

        {portraitNarrative && (
          <SoftRow
            accent="#f59e0b"
            accentText="#b45309"
            tag={t("retrato_titulo")}
            body={t("retrato_maya_preparou")}
            onClick={() => router.push("/diario")}
          />
        )}

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
                  {formatDayMonth(ci.date)}
                </div>
                <div className="text-[9.5px] font-semibold tracking-wider uppercase text-muted-foreground mt-0.5">
                  {formatWeekdayShort(ci.date)}
                </div>
              </div>
              <p
                className="m-0 text-[13px] leading-[1.45]"
                style={{
                  color: ci.feeling ? undefined : "var(--muted-foreground)",
                  fontStyle: ci.feeling ? "normal" : "italic",
                }}
              >
                {ci.feeling
                  ? ci.feeling.length > 70
                    ? ci.feeling.slice(0, 70) + "..."
                    : ci.feeling
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ height: 90 }} />
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
          stroke="oklch(.5 .12 160 / .08)"
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
