"use client";

import { useEffect, useState, useMemo } from "react";
import { getLocalDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cachedFetch } from "@/lib/fetch-cache";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { photoUrl } from "@/lib/photo-storage";
import { ArrowRight, Pencil } from "lucide-react";
import { MayaAvatar } from "@/components/MayaAvatar";
import { getMoodLabel, getMoodById } from "@/lib/checkin-moods";
import type { CheckIn, WeeklyTask } from "@/types";

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
    eyebrow: "MAYA DETECTOU",
    title: "Padrões que você não vê",
    body: "A Maya cruza seu sono, humor e gastos para revelar conexões ocultas.",
    cta: "Ver análise",
    ctaHref: "/analise" as string | null,
    bg: "linear-gradient(135deg,#2D1B69 0%,#1A1035 100%)",
    accent: "oklch(.55 .2 270)",
  },
  {
    eyebrow: "CONVERSE",
    title: "Falar com Maya é o centro do app",
    body: "Ela te conhece. Conte o que está acontecendo.",
    cta: "Conversar",
    ctaHref: "/insights" as string | null,
    bg: "linear-gradient(135deg,#134E4A 0%,#0F2E2C 100%)",
    accent: "oklch(.7 .12 175)",
  },
  {
    eyebrow: "EM BREVE",
    title: "Meditações guiadas pela Maya",
    body: "Sessões curtas baseadas no seu estado real.",
    cta: "Avise-me",
    ctaHref: null as string | null,
    bg: "linear-gradient(135deg,#4C1D95 0%,#2D1065 100%)",
    accent: "oklch(.55 .18 290)",
  },
];

const NEGATIVE_MOODS = new Set([
  "ansiosa", "triste", "cansada", "sobrecarregada", "irritada", "frustrada",
]);

function formatMood(moodId: string, gender: string): string {
  const chip = getMoodById(moodId);
  return chip ? getMoodLabel(chip, gender) : moodId;
}

// ── Helpers ─────────────────────────────────────────────────────

function greetingTimeOfDay(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 12) return t("bom_dia");
  if (h < 18) return t("boa_tarde");
  return t("boa_noite");
}

// ── StatChip ────────────────────────────────────────────────────

function StatChip({
  emoji, label, value, sub, subColor, onClick,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "oklch(0.16 0.012 270)",
        border: "1px solid oklch(0.28 0.02 270 / 0.5)",
        borderRadius: 16,
        padding: "14px 12px",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: "oklch(0.55 0.03 270)", fontWeight: 500 }}>
          {label}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>
          {value}
        </p>
        {sub && (
          <p style={{ margin: 0, fontSize: 10, color: subColor || "oklch(0.5 0.03 270)" }}>
            {sub}
          </p>
        )}
      </div>
    </button>
  );
}

// ── SparkSmall ──────────────────────────────────────────────────

function SparkSmall({ data, color = "oklch(.58 .18 270)" }: { data: number[]; color?: string }) {
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
        <linearGradient id="ssFill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#ssFill2)" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const [kcalGoal] = useState(2200);
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState("");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [todayTasks, setTodayTasks] = useState<WeeklyTask[]>([]);
  const [yesterdaySleep, setYesterdaySleep] = useState<boolean | null>(null);
  const [lastMood, setLastMood] = useState<string>("");
  const [todaySpending, setTodaySpending] = useState<number | null>(null);
  const [spendingLimit, setSpendingLimit] = useState<number>(80);

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
      fetch("/api/weekly-plans").then((r) => r.json()).catch(() => null),
    ])
      .then(([checkInsData, prefsData, profileData, weeklyPlanData]) => {
        if (!prefsData.onboarding_completed) {
          router.push("/onboarding");
          return;
        }
        setEnabledKeys(prefsData.enabled_questions || []);

        if (Array.isArray(checkInsData)) {
          setCheckIns(checkInsData);
          setTodayCheckIn(checkInsData.find((c: CheckIn) => c.date === today) || null);

          // Yesterday's sleep
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
          const yci = checkInsData.find((c: CheckIn) => c.date === yd);
          if (yci) setYesterdaySleep(yci.slept_well);

          // Last mood
          const lastCi = checkInsData.find((c: CheckIn) => c.mood_tags?.length > 0);
          if (lastCi?.mood_tags?.[0]) setLastMood(lastCi.mood_tags[0]);
        }

        if (profileData.name) setUserName(profileData.name);
        if (profileData.gender) setUserGender(profileData.gender);
        else if (prefsData.context?.gender) setUserGender(prefsData.context.gender as string);
        if (profileData.porques?.length > 0) {
          setPorques(profileData.porques);
          const pq = profileData.porques[0];
          if (pq.photoPath) setPorquePhoto(photoUrl(pq.photoPath));
        }

        const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
        const allTasks: WeeklyTask[] = weeklyPlanData?.current?.weekly_tasks ?? [];
        setTodayTasks(allTasks.filter((t: WeeklyTask) => t.day_of_week === todayDow));

        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Maya nudge loads independently
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((data) => setMayaNudgeText(data.nudges?.[0]?.message ?? ""))
      .catch(() => setMayaNudgeText(""));

    // Finance data — API returns array directly
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    cachedFetch<Array<{ date: string; type: string; amount: number }>>(
      `/api/financas/transactions?month=${currentMonth}`
    )
      .then((txs) => {
        if (Array.isArray(txs)) {
          const todayStr = today;
          const todayTx = txs.filter((tx) => tx.date === todayStr);
          const total = todayTx.reduce((sum, tx) => sum + (tx.type === "despesa" ? tx.amount : 0), 0);
          setTodaySpending(total);
        }
      })
      .catch(() => {});
  }, [router]);

  // Auto-rotate porquê every 30s
  useEffect(() => {
    if (porques.length <= 1) return;
    const id = setInterval(() => {
      setPorqueIndex((i) => {
        const next = (i + 1) % porques.length;
        const pq = porques[next];
        setPorquePhoto(pq.photoPath ? photoUrl(pq.photoPath) : null);
        return next;
      });
    }, 30000);
    return () => clearInterval(id);
  }, [porques]);

  // Carousel auto-advance every 8s
  useEffect(() => {
    const id = setInterval(() => setCarouselIdx((i) => (i + 1) % CAROUSEL_SLIDES.length), 8000);
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

  const completedHabitsChips = todayCheckIn
    ? enabledNonSuicidal
        .filter((k) => k !== "drank_water" && (todayCheckIn as unknown as Record<string, unknown>)[k] === true)
        .map((k) => ({
          emoji: HABIT_CHIP[k]?.[0] ?? "•",
          value: HABIT_CHIP[k]?.[1]?.(todayCheckIn) ?? k,
        }))
    : [];

  const waterLabel = (() => {
    const ml = (todayCheckIn?.water_cups ?? 0) * 250;
    if (ml === 0) return "0ml";
    if (ml < 1000) return `${ml}ml`;
    return `${(ml / 1000).toFixed(1).replace(".0", "")}L`;
  })();

  // ── Maya proactive message ────────────────────────────────────

  const mayaMessage = useMemo(() => {
    if (!firstName) return null;
    const sleepHours = yesterdaySleep === true ? "dormiu bem" : yesterdaySleep === false ? "dormiu só 5h32" : null;
    const spendingPct = todaySpending !== null && spendingLimit > 0 ? Math.round((todaySpending / spendingLimit) * 100) : null;

    if (!todayCheckIn) {
      let msg = `Oi ${firstName}! `;
      if (sleepHours === "dormiu só 5h32" && spendingPct && spendingPct > 60) {
        msg += `Você dormiu pouco e já gastou ${spendingPct}% do orçamento. Como pretende virar esse jogo hoje?`;
      } else if (sleepHours === "dormiu bem") {
        msg += `Que bom que descansou bem. Bora fazer hoje valer?`;
      } else {
        msg += `Registre como está hoje. Quanto mais você me conta, mais eu posso te ajudar.`;
      }
      return msg;
    }

    if (lastMood && NEGATIVE_MOODS.has(lastMood)) {
      return `Sei que "${formatMood(lastMood, userGender)}" não é fácil, ${firstName}. Quer conversar sobre o que está pesando?`;
    }

    return mayaNudgeText || `Bom te ver, ${firstName}. Como está sendo seu dia?`;
  }, [firstName, todayCheckIn, yesterdaySleep, todaySpending, spendingLimit, lastMood, mayaNudgeText]);

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

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("carregando")}</p>
      </div>
    );
  }

  const todayDone = todayTasks.filter(t => t.status === "concluida").length;
  const todayTotal = todayTasks.length;
  const spendingPct = todaySpending !== null && spendingLimit > 0 ? `${Math.round((todaySpending / spendingLimit) * 100)}% do limite` : null;

  // Humor: feeling text first, fallback to first mood tag (gender-adapted)
  const humorValue = !todayCheckIn ? null
    : todayCheckIn.feeling ? `"${todayCheckIn.feeling.slice(0, 20)}${todayCheckIn.feeling.length > 20 ? "…" : ""}"`
    : todayCheckIn.mood_tags?.length > 0 ? formatMood(todayCheckIn.mood_tags[0], userGender)
    : null;

  return (
    <div
      className="relative min-h-screen pb-28"
      style={{ background: "oklch(0.12 0.012 270)" }}
    >
      {/* ═══════════════ MAYA — HERO ═══════════════ */}
      <div
        className="relative flex flex-col items-center"
        style={{ paddingTop: 0, paddingBottom: 24 }}
      >
        {/* Background aura */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -40,
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,92,255,0.15) 0%, rgba(94,234,212,0.05) 35%, transparent 65%)",
          }}
        />

        {/* Maya — full image, no circle, ~35% of screen */}
        <div style={{ marginBottom: 8, position: "relative" }}>
          <MayaAvatar state="hero" size={280} />
        </div>

        {/* Message */}
        <div
          style={{
            maxWidth: 340,
            textAlign: "center",
            paddingInline: 24,
            marginBottom: 20,
          }}
        >
          {mayaMessage === null ? (
            <div className="space-y-2 flex flex-col items-center">
              <div className="h-4 rounded-full animate-pulse w-[260px]" style={{ background: "oklch(0.22 0.02 270)" }} />
              <div className="h-4 rounded-full animate-pulse w-[200px]" style={{ background: "oklch(0.22 0.02 270)" }} />
              <div className="h-4 rounded-full animate-pulse w-[160px]" style={{ background: "oklch(0.22 0.02 270)" }} />
            </div>
          ) : (
            <p
              className="text-[16px] leading-[1.5] font-medium tracking-tight whitespace-pre-wrap"
              style={{ color: "#e0d6ff" }}
            >
              {mayaMessage}
            </p>
          )}
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={() => router.push("/insights")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            paddingInline: 32,
            borderRadius: 14,
            border: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
            boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
            e.currentTarget.style.boxShadow = "0 6px 28px rgba(124,92,255,0.55)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,92,255,0.4)";
          }}
        >
          {t("conversar_com_maya")}
        </button>
      </div>

      {/* ═══════════════ O FIO — peek dos últimos 3 dias ═══════════════ */}
      {(() => {
        const last3 = weekDays.slice(-3).reverse(); // [today, yesterday, 2d ago]
        const labels = ["Hoje", "Ontem", "Anteontem"];
        return (
      <div className="px-3.5 pt-2">
        <div
          className="rounded-[18px] px-4 pt-4 pb-[18px] border"
          style={{
            background: "oklch(0.16 0.012 270)",
            borderColor: "oklch(0.28 0.02 270 / 0.5)",
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "#5EEAD4" }}>
              O Fio · últimos dias
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {last3.map((day, i) => {
              const isToday = i === 0;
              const moodTag = day.mood_tags?.[0];
              const moodNeg = moodTag ? NEGATIVE_MOODS.has(moodTag) : false;
              const extraMoods = (day.mood_tags?.length ?? 0) - 1;
              const dayScore =
                day.cuidados !== null
                  ? Math.round((day.cuidados / Math.max(totalHabits, 1)) * 10)
                  : null;

              const sleepLabel = day.sleep === true ? "🌙" : day.sleep === false ? "😵" : "—";
              const sleepOpacity = day.sleep !== null ? 1 : 0.3;

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
                    style={{ color: isToday ? "#A78BFA" : "oklch(0.55 0.03 270)" }}
                  >
                    {labels[i]}
                  </span>
                  <span className="text-[13px] leading-none text-center" style={{ opacity: sleepOpacity }}>
                    {sleepLabel}
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums text-center"
                    style={{
                      color: dayScore === null ? "oklch(0.55 0.03 270)"
                        : dayScore >= 7 ? "#22D18B"
                        : dayScore >= 5 ? "#f59e0b"
                        : "#FF5C5C",
                    }}
                  >
                    {dayScore !== null ? `${dayScore}/10` : "—"}
                  </span>
                  {/* Mood tag — coluna fixa */}
                  <span className="flex items-center">
                    {moodTag ? (
                      <span
                        className="px-1.5 py-px rounded-full text-[9.5px] font-semibold"
                        style={{
                          maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          background: moodNeg ? "oklch(.92 .05 30 / .25)" : "oklch(.55 .18 270 / .2)",
                          color: moodNeg ? "#FF5C5C" : "#A78BFA",
                        }}
                      >
                        {formatMood(moodTag, userGender)}{extraMoods > 0 ? ` +${extraMoods}` : ""}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "oklch(0.55 0.03 270)" }}>—</span>
                    )}
                  </span>
                  {/* Feeling text — coluna flexível */}
                  <span className="text-[11px] truncate" style={{ color: "oklch(0.55 0.03 270)" }}>
                    {day.feeling || ""}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="m-0 mt-3 text-center text-[10px]" style={{ color: "oklch(0.4 0.03 270)" }}>
            Deslize para ver mais ↓
          </p>
        </div>
      </div>
        );
      })()}

      {/* ═══════════════ SUA VIDA HOJE ═══════════════ */}
      <div className="px-3.5 pt-4">
        <p
          className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          Sua vida hoje
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatChip
            emoji="😴"
            label="Sono"
            value={yesterdaySleep === true ? "Dormiu bem" : yesterdaySleep === false ? "Dormiu mal" : "—"}
            sub={yesterdaySleep === true ? "Boa noite" : yesterdaySleep === false ? "Abaixo da média" : "Sem registro"}
            subColor={yesterdaySleep === true ? "#22D18B" : yesterdaySleep === false ? "#FF5C5C" : undefined}
            onClick={() => router.push("/sono")}
          />
          <StatChip
            emoji="😊"
            label="Humor"
            value={humorValue || "—"}
            sub={todayCheckIn ? "Check-in feito" : "Pendente"}
            subColor={todayCheckIn ? "#22D18B" : undefined}
            onClick={() => router.push("/check-in")}
          />
          <StatChip
            emoji="💰"
            label="Gastos"
            value={todaySpending !== null ? `R$ ${todaySpending.toFixed(2)}` : "—"}
            sub={spendingPct || "Sem dados"}
            subColor={spendingPct && parseInt(spendingPct) > 70 ? "#FF5C5C" : "#22D18B"}
            onClick={() => router.push("/financas")}
          />
          <StatChip
            emoji="🎯"
            label="Meta do dia"
            value={todayTotal > 0 ? `${todayDone}/${todayTotal}` : "—"}
            sub={todayTotal > 0 ? (todayDone === todayTotal ? "Tudo feito!" : "em andamento") : "Sem tarefas"}
            subColor={todayDone === todayTotal && todayTotal > 0 ? "#22D18B" : undefined}
            onClick={() => router.push("/planejamento")}
          />
        </div>
      </div>

      {/* ═══════════════ CTA REGISTRAR ═══════════════ */}
      <div className="px-3.5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/check-in")}
          style={{
            width: "100%",
            padding: "15px 0",
            borderRadius: 16,
            background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
            border: 0,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 20px oklch(0.55 0.2 270 / 0.35)",
          }}
        >
          {todayCheckIn ? "Editar check-in de hoje" : "✓ Registrar meu dia"}
        </button>
        <p style={{ textAlign: "center", margin: "6px 0 0", fontSize: 11, color: "oklch(0.55 0.03 270)" }}>
          {todayCheckIn ? "Maya vai conectar os pontos." : "É assim que me atualizo."}
        </p>
      </div>

      {/* ═══════════════ CUIDADOS DE HOJE ═══════════════ */}
      {todayCheckIn && (
        <div className="px-3.5 pt-5">
          <div className="flex items-baseline justify-between mb-2.5 px-1">
            <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "#A78BFA" }}>
              Cuidados de hoje
            </p>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#A78BFA" }}>
              {positivePct}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="px-1 mb-3">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "oklch(.25 .02 270)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${positivePct}%`,
                  background: "linear-gradient(90deg, #7C5CFF, #A78BFA)",
                }}
              />
            </div>
            <p className="m-0 mt-1 text-[10px]" style={{ color: "oklch(.55 .03 270)" }}>
              {positiveCount} cuidados feitos · {totalHabits - positiveCount} pendentes
            </p>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5">
            <span
              className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
              style={{
                background: "oklch(0.18 0.015 270)",
                borderColor: "oklch(0.28 0.02 270 / 0.5)",
                color: "#e0d6ff",
              }}
            >
              💧 {waterLabel}
            </span>
            {completedHabitsChips.map(({ emoji, value }) => (
              <span
                key={value}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium border inline-flex items-center gap-1"
                style={{
                  background: "oklch(0.18 0.015 270)",
                  borderColor: "oklch(0.28 0.02 270 / 0.5)",
                  color: "#e0d6ff",
                }}
              >
                {emoji} {value}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => router.push("/check-in")}
            className="mt-2.5 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer text-[12px] font-semibold"
            style={{ color: "#A78BFA" }}
          >
            <Pencil className="w-3 h-3" />
            Editar check-in
          </button>
        </div>
      )}

      {/* ═══════════════ CARROSSEL ═══════════════ */}
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
                pointerEvents: i === carouselIdx ? "auto" : "none",
              }}
            >
              <CarouselArtwork accent={s.accent} />
              <div className="relative max-w-[78%]" style={{ zIndex: 20 }}>
                <p className="m-0 text-[10px] font-bold tracking-[.14em] uppercase text-white/65">
                  {s.eyebrow}
                </p>
                <h3 className="mt-1.5 mb-1.5 text-[18px] font-bold leading-tight tracking-tight">
                  {s.title}
                </h3>
                <p className="m-0 mb-3 text-[12px] leading-snug text-white/75">
                  {s.body}
                </p>
                {s.ctaHref ? (
                  <button
                    type="button"
                    onClick={() => router.push(s.ctaHref!)}
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
                ) : (
                  <span
                    className="px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1.5"
                    style={{
                      background: "rgba(255,255,255,.12)",
                      border: "1px solid rgba(255,255,255,.2)",
                      color: "rgba(255,255,255,.65)",
                    }}
                  >
                    {s.cta}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Edge tap zones */}
          <button
            type="button"
            className="absolute left-0 top-0 bottom-0 w-[30%] z-10 cursor-pointer"
            style={{ background: "transparent" }}
            aria-label="Slide anterior"
            onClick={() =>
              setCarouselIdx((i) => (i - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length)
            }
          />
          <button
            type="button"
            className="absolute right-0 top-0 bottom-0 w-[30%] z-10 cursor-pointer"
            style={{ background: "transparent" }}
            aria-label="Próximo slide"
            onClick={() => setCarouselIdx((i) => (i + 1) % CAROUSEL_SLIDES.length)}
          />
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
                    ? "#A78BFA"
                    : "oklch(.28 .02 270)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════ EVOLUÇÃO 14d ═══════════════ */}
      <div className="px-3.5 pt-5">
        <div
          className="rounded-[18px] px-4 pt-4 pb-[18px] border"
          style={{
            background: "oklch(0.16 0.012 270)",
            borderColor: "oklch(0.28 0.02 270 / 0.5)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "#A78BFA" }}>
              Evolução · 14d
            </p>
          </div>
          {sparkData.some((v) => v > 0) ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[20px] font-bold tracking-tight leading-none tabular-nums" style={{ color: "#e0d6ff" }}>
                  {sparkAvg.toFixed(1)}
                </span>
                <span className="text-[10.5px]" style={{ color: "oklch(0.55 0.03 270)" }}>
                  média{sparkTrend ? ` · ${sparkTrend}` : ""}
                </span>
              </div>
              <div className="mt-2">
                <SparkSmall data={sparkData} />
              </div>
            </>
          ) : (
            <p className="m-0 text-[11px]" style={{ color: "oklch(0.55 0.03 270)" }}>
              Faça mais check-ins para ver sua evolução
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
