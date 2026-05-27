"use client";

import { useEffect, useState, useMemo } from "react";
import { getLocalDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cachedFetch } from "@/lib/fetch-cache";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { photoUrl } from "@/lib/photo-storage";
import { sumMacros, nutritionScore, getDailyKcalGoal, DEFAULT_DAILY_KCAL } from "@/lib/meal-utils";
import { ArrowRight, Pencil } from "lucide-react";
import type { CheckIn, Meal } from "@/types";

// ── Constants ───────────────────────────────────────────────────

const HABIT_CHIP: Record<string, [string, (ci: CheckIn) => string]> = {
  took_medication:             ["💊", () => "Remédios"],
  talked_to_someone:           ["🗣️", () => "Conversa"],
  meditation_prayer_breathing: ["🧘", () => "Pausa"],
  creative_activity:           ["🎨", () => "Criatividade"],
  ate_well:                    ["🍽️", () => "Comeu bem"],
  bowel_movement:              ["🚽", () => "Banheiro"],
  exercise_walk:               ["🏃", () => "Caminhou"],
  slept_well:                  ["😴", () => "Sono"],
  did_something_enjoyable:     ["😊", () => "Gostou"],
  worked_on_goals:             ["🎯", () => "Metas"],
};

const CAROUSEL_SLIDES = [
  {
    eyebrow: "NOVO",
    title: "Fio da Semana com sentimentos",
    body: "Veja como você se sentiu cada dia.",
    cta: "Ver",
    ctaHref: "/historico" as string | null,
    bg: "linear-gradient(135deg,#312e81 0%,#1e1b4b 100%)",
    accent: "oklch(.55 .2 280)",
  },
  {
    eyebrow: "LEMBRETE",
    title: "Conversar com Maya é gratuito sempre",
    body: "Ela está acordada quando você precisar.",
    cta: "Conversar",
    ctaHref: "/insights" as string | null,
    bg: "linear-gradient(135deg,#065f46 0%,#022c22 100%)",
    accent: "oklch(.55 .15 160)",
  },
  {
    eyebrow: "EM BREVE",
    title: "Meditações guiadas pela Maya",
    body: "Sessões curtas, dia ou noite.",
    cta: "Avise-me",
    ctaHref: null as string | null,
    bg: "linear-gradient(135deg,#7c2d12 0%,#431407 100%)",
    accent: "oklch(.55 .2 40)",
  },
];

const NEGATIVE_MOODS = new Set([
  "ansiosa", "triste", "cansada", "sobrecarregada", "irritada", "frustrada",
]);

// ── Helpers ─────────────────────────────────────────────────────

function greetingTimeOfDay(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("bom_dia");
  if (h < 18) return t("boa_tarde");
  return t("boa_noite");
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
  const [loading, setLoading] = useState(true);
  const [todayDisplay, setTodayDisplay] = useState("");
  const [mayaNudgeText, setMayaNudgeText] = useState<string | null>(null);
  const [porques, setPorques] = useState<Porque[]>([]);
  const [porqueIndex, setPorqueIndex] = useState(0);
  const [porquePhoto, setPorquePhoto] = useState<string | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [kcalGoal, setKcalGoal] = useState(DEFAULT_DAILY_KCAL);
  const [userName, setUserName] = useState("");
  const [carouselIdx, setCarouselIdx] = useState(0);

  useEffect(() => {
    const d = new Date();
    const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase().replace(".", "");
    const dn = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).toUpperCase().replace(".", "");
    setTodayDisplay(`${wk} · ${dn}`);
  }, []);

  useEffect(() => {
    const today = getLocalDate();

    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{
        onboarding_completed?: boolean;
        enabled_questions?: string[];
        context?: Record<string, unknown>;
      }>("/api/preferences"),
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
        setKcalGoal(getDailyKcalGoal((prefsData.context || {}) as Record<string, unknown>));

        if (Array.isArray(checkInsData)) {
          setCheckIns(checkInsData);
          setTodayCheckIn(checkInsData.find((c: CheckIn) => c.date === today) || null);
        }

        if (profileData.name) setUserName(profileData.name);
        if (profileData.porques?.length > 0) {
          setPorques(profileData.porques);
          setPorqueIndex(0);
          const pq = profileData.porques[0];
          if (pq.photoPath) setPorquePhoto(photoUrl(pq.photoPath));
        }

        if (Array.isArray(todayMealsData)) setTodayMeals(todayMealsData);
        if (Array.isArray(allMealsData)) setAllMeals(allMealsData);

        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Maya nudge loads independently — doesn't block the dashboard
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((data) => setMayaNudgeText(data.nudges?.[0]?.message ?? ""))
      .catch(() => setMayaNudgeText(""));
  }, [router]);

  // Auto-rotate porquê every 8s (sequential)
  useEffect(() => {
    if (porques.length <= 1) return;
    const id = setInterval(() => {
      setPorqueIndex((i) => {
        const next = (i + 1) % porques.length;
        const pq = porques[next];
        setPorquePhoto(pq.photoPath ? photoUrl(pq.photoPath) : null);
        return next;
      });
    }, 8000);
    return () => clearInterval(id);
  }, [porques]);

  // Carousel auto-advance every 5s
  useEffect(() => {
    const id = setInterval(() => setCarouselIdx((i) => (i + 1) % CAROUSEL_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  // ── Compute ──────────────────────────────────────────────────

  const firstName = userName.split(" ")[0];

  const enabledNonSuicidal = enabledKeys.filter(
    (k) => k !== "suicidal_thoughts" && k !== "felt_judged",
  );
  const totalHabits = enabledNonSuicidal.length;

  const positiveCount = todayCheckIn
    ? enabledNonSuicidal.filter((k) => (todayCheckIn as unknown as Record<string, unknown>)[k] === true).length
    : 0;

  const positivePct = totalHabits > 0 ? Math.round((positiveCount / totalHabits) * 100) : 0;

  // Chips with value labels (excludes water — shown separately)
  const completedHabitsChips = todayCheckIn
    ? enabledNonSuicidal
        .filter((k) => k !== "drank_water" && (todayCheckIn as unknown as Record<string, unknown>)[k] === true)
        .map((k) => ({
          emoji: HABIT_CHIP[k]?.[0] ?? "•",
          value: HABIT_CHIP[k]?.[1]?.(todayCheckIn) ?? k,
        }))
    : [];

  // Water label: ml below 1L, then L
  const waterLabel = (() => {
    const ml = (todayCheckIn?.water_cups ?? 0) * 250;
    if (ml === 0) return "0ml";
    if (ml < 1000) return `${ml}ml`;
    return `${(ml / 1000).toFixed(1).replace(".0", "")}L`;
  })();

  // ── Fio da Semana ─────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const today = getLocalDate();
    const habitKeys = enabledKeys.filter(
      (k) => k !== "suicidal_thoughts" && k !== "felt_judged",
    );

    const days: {
      date: string;
      label: string;
      sleep: boolean | null;
      cuidados: number | null;
      mood_tags: string[];
      feeling: string;
      today: boolean;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);

      days.push({
        date: ds,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        sleep: ci?.slept_well ?? null,
        cuidados: ci
          ? habitKeys.filter((k) => (ci as unknown as Record<string, unknown>)[k] === true).length
          : null,
        mood_tags: ci?.mood_tags ?? [],
        feeling: ci?.feeling ?? "",
        today: ds === today,
      });
    }
    return days;
  }, [checkIns, enabledKeys]);

  const avgEnergy = useMemo(() => {
    const withData = weekDays.filter((d) => d.cuidados !== null);
    if (withData.length === 0) return 0;
    return withData.reduce((sum, d) => sum + (d.cuidados! / Math.max(totalHabits, 1)) * 10, 0) / withData.length;
  }, [weekDays, totalHabits]);

  // ── Evolução 14d ─────────────────────────────────────────────

  const scoreKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts");

  const sparkData = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const points: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);
      points.push(
        ci ? scoreKeys.filter((k) => (ci as unknown as Record<string, unknown>)[k] === true).length : 0,
      );
    }
    return points;
  }, [checkIns, scoreKeys]);

  const sparkAvg =
    sparkData.filter((v) => v > 0).length > 0
      ? sparkData.reduce((a, b) => a + b, 0) / sparkData.length
      : 0;

  const sparkTrend = (() => {
    if (sparkData.filter((v) => v > 0).length < 2) return "";
    const avg1 = sparkData.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const avg2 = sparkData.slice(7).reduce((a, b) => a + b, 0) / 7;
    if (avg2 - avg1 > 0.5) return t("subindo");
    if (avg1 - avg2 > 0.5) return t("caindo");
    return t("estavel");
  })();

  // ── Nutrição ─────────────────────────────────────────────────

  const nutritionData = useMemo(() => {
    const analyzed = todayMeals.filter((m) => m.macros && m.status_analise === "analisado");
    const total = sumMacros(analyzed);
    const score = analyzed.length > 0 ? nutritionScore(analyzed) : null;
    return { analyzed, total, score };
  }, [todayMeals]);

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("carregando")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen pb-28"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .35) 0%, transparent 50%),
          linear-gradient(180deg, oklch(.97 .005 160) 0%, oklch(.94 .02 160) 100%)
        `,
      }}
    >

      {/* ═ GREETING ═ */}
      <div className="px-5 pt-[22px] pb-1">
        <p className="m-0 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          {greetingTimeOfDay(t)}
        </p>
        <h1 className="mt-1 text-[34px] font-bold tracking-tight leading-[1.05]">
          {firstName || "—"}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
          {todayDisplay}
        </p>
      </div>

      {/* ═ MAYA CARD ═ */}
      <div className="px-3.5 pt-4">
        <div
          className="relative rounded-[22px] border overflow-hidden p-[18px]"
          style={{
            background: `
              radial-gradient(circle at 100% 100%, oklch(.88 .12 160 / .35), transparent 60%),
              linear-gradient(135deg, oklch(.95 .02 160) 0%, oklch(.92 .04 160) 100%)
            `,
            borderColor: "oklch(.5 .12 160 / .15)",
          }}
        >
          {/* Rings at bottom-right */}
          <div
            className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full border pointer-events-none"
            style={{ borderColor: "oklch(.5 .12 160 / .15)" }}
          />
          <div
            className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border pointer-events-none"
            style={{ borderColor: "oklch(.5 .12 160 / .1)" }}
          />

          <div className="relative flex gap-3 items-start">
            <div className="relative flex-none">
              {/* Breathing aura */}
              <span
                className="absolute -inset-1.5 rounded-full pointer-events-none"
                style={{
                  background: "oklch(.78 .14 160 / .12)",
                  animation: "mayaBreathe 3s ease-in-out infinite",
                }}
              />
              <span className="block w-[60px] h-[60px] rounded-full overflow-hidden border-[2.5px] border-white relative shadow-lg">
                <img src="/Maya.png" alt="Maya" className="w-full h-full object-cover" />
              </span>
              {/* Online dot */}
              <span
                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-white"
                style={{ background: "#22c55e" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="m-0 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "oklch(.4 .12 160)" }}
              >
                Maya · agora
              </p>
              {mayaNudgeText === null ? (
                <div className="mt-2 space-y-2">
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[90%]" />
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[75%]" />
                  <div className="h-3.5 rounded-full bg-current opacity-[0.08] animate-pulse w-[55%]" />
                </div>
              ) : (
                <p className="mt-1 text-[14.5px] leading-[1.4] font-medium tracking-tight whitespace-pre-wrap">
                  {mayaNudgeText || t("nudge_boas_vindas")}
                </p>
              )}
            </div>
          </div>

          <Button
            className="mt-3 w-full h-[38px] rounded-xl text-[13px] font-semibold gap-1.5"
            style={{
              background: "oklch(.4 .12 160)",
              boxShadow: "0 4px 12px -4px oklch(.4 .12 160 / .45)",
            }}
            onClick={() => router.push("/insights")}
          >
            {t("conversar_com_maya")}
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ═ MEU PORQUÊ ═ */}
      {porques.length > 0 && (
        <div className="px-6 pt-[22px]">
          <div className="flex items-baseline justify-between mb-3">
            <p
              className="m-0 text-[10.5px] font-bold tracking-[.14em] uppercase"
              style={{ color: "oklch(.55 .12 20)" }}
            >
              Meu Porquê
            </p>
            {porques.length > 1 && (
              <div className="flex gap-1">
                {porques.map((_, i) => (
                  <span
                    key={i}
                    className="h-[5px] rounded-full"
                    style={{
                      width: i === porqueIndex ? 14 : 5,
                      transition: "width .3s ease",
                      background:
                        i === porqueIndex ? "oklch(.55 .12 20)" : "oklch(.5 .1 20 / .25)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-[74px_1fr] gap-3.5 items-center">
            <div
              className="w-[74px] h-[74px] rounded-2xl overflow-hidden flex-none flex items-center justify-center border-2 border-white"
              style={{
                background: "linear-gradient(135deg, oklch(.9 .06 30) 0%, oklch(.82 .12 30) 100%)",
                boxShadow: "0 4px 14px -6px oklch(.4 .12 30 / .35)",
              }}
            >
              {porquePhoto ? (
                <img src={porquePhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="oklch(.45 .12 30 / .5)">
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  <path d="M3 21a9 9 0 0 1 18 0Z" />
                </svg>
              )}
            </div>
            <p className="m-0 text-[16.5px] leading-[1.4] tracking-tight italic font-medium">
              &ldquo;{porques[porqueIndex]?.text || "—"}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* ═ CUIDADOS DE HOJE ═ */}
      <div className="px-6 pt-8">
        <div className="flex items-baseline justify-between mb-3.5">
          <p className="m-0 text-[10.5px] font-bold tracking-[.14em] uppercase text-amber-700">
            Cuidados de hoje
          </p>
          {todayCheckIn && (
            <span className="text-[11.5px] font-semibold text-amber-700 tabular-nums">
              {positivePct}%
            </span>
          )}
        </div>

        {!todayCheckIn ? (
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
          <>
            {/* Hero row: big number + progress bar */}
            <div className="grid grid-cols-[auto_1fr] gap-[18px] items-center mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[56px] font-bold tracking-[-0.035em] leading-[0.85] tabular-nums text-stone-900">
                  {positiveCount}
                </span>
                <span className="text-[22px] text-muted-foreground font-normal leading-none">
                  / {totalHabits}
                </span>
              </div>
              <div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "oklch(.85 .05 80 / .35)" }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${positivePct}%`,
                      background: "linear-gradient(90deg,#d97706,#f59e0b)",
                    }}
                  />
                </div>
                <p className="m-0 mt-1.5 text-[10.5px] text-muted-foreground">
                  {positiveCount} cuidados feitos · {totalHabits - positiveCount} pendentes
                </p>
              </div>
            </div>

            {/* Chips with value labels */}
            <div className="flex flex-wrap gap-1.5">
              <span
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
                style={{
                  background: "oklch(1 0 0 / .85)",
                  backdropFilter: "blur(4px)",
                  borderColor: "oklch(.85 .05 80 / .5)",
                  boxShadow: "0 1px 0 oklch(.25 .02 160 / .04)",
                  color: "#1c1917",
                }}
              >
                💧 {waterLabel}
              </span>
              {completedHabitsChips.map(({ emoji, value }) => (
                <span
                  key={value}
                  className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
                  style={{
                    background: "oklch(1 0 0 / .85)",
                    backdropFilter: "blur(4px)",
                    borderColor: "oklch(.85 .05 80 / .5)",
                    boxShadow: "0 1px 0 oklch(.25 .02 160 / .04)",
                    color: "#1c1917",
                  }}
                >
                  {emoji} {value}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => router.push("/check-in")}
              className="mt-3.5 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[12px] font-semibold text-amber-700"
            >
              <Pencil className="w-3 h-3" />
              Editar check-in
            </button>
          </>
        )}
      </div>

      {/* ═ METAS DA SEMANA ═ */}
      <div className="px-3.5 pt-8">
        <div
          className="relative rounded-[18px] overflow-hidden text-white px-[18px] py-4"
          style={{
            background: `
              radial-gradient(circle at 100% 0, oklch(.45 .18 260 / .35), transparent 50%),
              linear-gradient(160deg, oklch(.28 .14 260) 0%, oklch(.2 .1 260) 100%)
            `,
            boxShadow: "0 8px 24px -12px oklch(.22 .12 260 / .55)",
          }}
        >
          <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase text-white/60 mb-2">
            Metas da semana
          </p>
          <p className="m-0 text-[13px] text-white/70 py-1">
            Suas metas semanais aparecerão aqui em breve.
          </p>
          <button
            type="button"
            className="mt-2 bg-transparent border-0 p-0 cursor-pointer text-[12px] font-medium text-white/70 underline underline-offset-2"
          >
            + Adicionar primeira meta
          </button>
        </div>
      </div>

      {/* ═ O FIO DA SEMANA ═ */}
      <div className="px-3.5 pt-2.5">
        <div
          className="rounded-[18px] px-4 pt-4 pb-[18px] border shadow-sm"
          style={{
            background: "linear-gradient(180deg, #fff, oklch(.96 .02 180))",
            borderColor: "oklch(.5 .12 180 / .12)",
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase text-cyan-700">
              O Fio · 7 dias
            </p>
            {avgEnergy > 0 && (
              <span className="text-[10.5px] text-muted-foreground">
                Energia média {avgEnergy.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {weekDays.map((day) => {
              const isToday = day.today;
              const moodTag = day.mood_tags?.[0];
              const moodNeg = moodTag ? NEGATIVE_MOODS.has(moodTag) : false;
              const extraMoods = (day.mood_tags?.length ?? 0) - 1;
              const dayScore =
                day.cuidados !== null
                  ? Math.round((day.cuidados / Math.max(totalHabits, 1)) * 10)
                  : null;

              return (
                <div
                  key={day.date}
                  className="items-center px-2 py-1 rounded-lg"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 14px 38px 1fr",
                    gap: 8,
                    background: isToday ? "oklch(.5 .12 180 / .08)" : "transparent",
                  }}
                >
                  <span
                    className="text-[10.5px] tracking-wider uppercase"
                    style={{
                      fontWeight: isToday ? 700 : 600,
                      color: isToday ? "oklch(.35 .12 180)" : "var(--muted-foreground)",
                    }}
                  >
                    {day.label}
                  </span>
                  <span
                    className="text-[13px] leading-none"
                    style={{ opacity: day.sleep === true ? 1 : 0.4 }}
                  >
                    {day.sleep === true ? "🌙" : "😵"}
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{
                      color:
                        dayScore === null
                          ? "var(--muted-foreground)"
                          : dayScore >= 7
                            ? "#059669"
                            : dayScore >= 5
                              ? "#b45309"
                              : "#dc2626",
                    }}
                  >
                    {dayScore !== null ? `${dayScore}/10` : "—"}
                  </span>
                  <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
                    {moodTag && (
                      <span
                        className="px-1.5 py-px rounded-full text-[9.5px] font-semibold flex-none"
                        style={{
                          background: moodNeg
                            ? "oklch(.92 .05 30 / .6)"
                            : "oklch(.88 .08 160 / .5)",
                          color: moodNeg ? "oklch(.4 .1 30)" : "oklch(.32 .1 160)",
                        }}
                      >
                        {moodTag}{extraMoods > 0 ? ` +${extraMoods}` : ""}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground truncate">
                      {day.feeling || "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═ CARROSSEL DE DESCOBERTA ═ */}
      <div className="px-3.5 pt-2.5">
        <div className="rounded-[18px] overflow-hidden min-h-[144px] relative">
          {CAROUSEL_SLIDES.map((s, i) => (
            <div
              key={i}
              className="px-[22px] py-5 text-white min-h-[144px] overflow-hidden"
              style={{
                position: i === carouselIdx ? "relative" : "absolute",
                inset: 0,
                background: s.bg,
                opacity: i === carouselIdx ? 1 : 0,
                transition: "opacity .5s ease",
              }}
            >
              <CarouselArtwork accent={s.accent} />
              <div className="relative max-w-[78%]">
                <p className="m-0 text-[10px] font-bold tracking-[.14em] uppercase text-white/65">
                  {s.eyebrow}
                </p>
                <h3 className="mt-1.5 mb-1.5 text-[18px] font-bold leading-tight tracking-tight">
                  {s.title}
                </h3>
                <p className="m-0 mb-3 text-[12px] leading-snug text-white/75">
                  {s.body}
                </p>
                <button
                  type="button"
                  onClick={() => s.ctaHref && router.push(s.ctaHref)}
                  className="px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5"
                  style={{
                    background: "rgba(255,255,255,.18)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,.3)",
                    color: "#fff",
                  }}
                >
                  {s.cta}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          {CAROUSEL_SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-[5px] rounded-full transition-[width] duration-300"
              style={{
                width: i === carouselIdx ? 16 : 5,
                background:
                  i === carouselIdx
                    ? "var(--foreground)"
                    : "oklch(.5 .12 160 / .2)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ═ NUTRIÇÃO + EVOLUÇÃO ═ */}
      <div className="px-3.5 pt-2.5 grid grid-cols-2 gap-2.5">
        {/* Nutrição */}
        <button
          type="button"
          className="text-left rounded-[18px] px-3.5 pt-3.5 pb-4 border shadow-sm"
          style={{
            background: "linear-gradient(180deg, #fff, oklch(.96 .03 30))",
            borderColor: "oklch(.5 .12 30 / .12)",
          }}
          onClick={() => router.push("/nutricao")}
        >
          <p className="m-0 text-[9.5px] font-bold tracking-[.12em] uppercase text-rose-700">
            Nutrição
          </p>
          {nutritionData.score !== null ? (
            <>
              <div className="flex items-center gap-2.5 mt-2">
                <NutritionRing score={nutritionData.score} />
                <div className="flex-1 min-w-0">
                  <div className="text-[20px] font-bold tracking-tight leading-none tabular-nums">
                    {Math.round(nutritionData.total.calorias_kcal)}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">
                    kcal · {nutritionData.analyzed.length} ref
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 text-[11px] text-muted-foreground mt-2">
              Sem refeições hoje
            </p>
          )}
        </button>

        {/* Evolução */}
        <div
          className="rounded-[18px] bg-white px-3.5 pt-3.5 pb-4 border shadow-sm flex flex-col"
          style={{ borderColor: "oklch(.5 .12 160 / .12)" }}
        >
          <p
            className="m-0 text-[9.5px] font-bold tracking-[.12em] uppercase"
            style={{ color: "oklch(.4 .12 160)" }}
          >
            Evolução · 14d
          </p>
          {sparkData.some((v) => v > 0) ? (
            <>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-[20px] font-bold tracking-tight leading-none tabular-nums">
                  {sparkAvg.toFixed(1)}
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  média{sparkTrend ? ` · ${sparkTrend}` : ""}
                </span>
              </div>
              <div className="mt-auto pt-2">
                <SparkSmall data={sparkData} />
              </div>
            </>
          ) : (
            <p className="m-0 text-[11px] text-muted-foreground mt-2">
              Faça mais check-ins
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── NutritionRing ──────────────────────────────────────────────

function NutritionRing({ score }: { score: number }) {
  const ringLen = 94.2;
  const dashLen = (score / 100) * ringLen;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const textColor = score >= 80 ? "#047857" : score >= 60 ? "#b45309" : "#be123c";

  return (
    <div className="w-12 h-12 relative flex-none">
      <svg
        viewBox="0 0 36 36"
        className="w-full h-full"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(.25 .02 160 / .12)" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r="15" fill="none"
          stroke={color} strokeWidth="2.5"
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

// ── CarouselArtwork ─────────────────────────────────────────────

function CarouselArtwork({ accent }: { accent: string }) {
  return (
    <>
      <div
        className="absolute -right-12 -top-12 w-44 h-44 rounded-full pointer-events-none opacity-[.35]"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />
      <div className="absolute -right-7 top-4 w-32 h-32 rounded-full border border-white/[.18] pointer-events-none" />
      <div className="absolute -right-3 top-9 w-20 h-20 rounded-full border border-white/[.12] pointer-events-none" />
      <div className="absolute right-5 top-5 w-14 h-14 rounded-full bg-white/[.08] backdrop-blur-md border border-white/20 pointer-events-none" />
    </>
  );
}

// ── SparkSmall ──────────────────────────────────────────────────

function SparkSmall({ data }: { data: number[] }) {
  const W = 140;
  const H = 38;
  const P = 2;
  const max = Math.max(...data, 1);
  const xStep = (W - P * 2) / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = P + i * xStep;
    const y = P + (H - P * 2) * (1 - v / max);
    return [x, y] as const;
  });
  const line = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");
  const fill = `${line} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: 38, display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ssFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(.5 .12 160)" stopOpacity=".25" />
          <stop offset="100%" stopColor="oklch(.5 .12 160)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#ssFill)" />
      <path
        d={line}
        fill="none"
        stroke="oklch(.5 .12 160)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
