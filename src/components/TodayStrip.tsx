"use client";

import { useRouter } from "next/navigation";
import { getMoodLabel, getMoodById } from "@/lib/checkin-moods";
import { useTranslation } from "@/lib/useTranslation";
import type { CheckIn, SleepLog, WeeklyTask } from "@/types";

function formatMood(moodId: string, gender: string): string {
  const chip = getMoodById(moodId);
  return chip ? getMoodLabel(chip, gender) : moodId;
}

/* ── Mini card skeleton ─────────────────────────────────────── */

function MiniSkeleton() {
  return (
    <div
      className="flex-shrink-0 rounded-2xl animate-pulse"
      style={{
        width: 108,
        height: 96,
        background: "var(--surface-2)",
        border: "1px solid var(--surface-border)",
        padding: "12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="w-6 h-6 rounded-full" style={{ background: "var(--surface-3)" }} />
      <div className="h-3 rounded-full w-16" style={{ background: "var(--surface-3)" }} />
      <div className="h-2.5 rounded-full w-12" style={{ background: "var(--surface-3)" }} />
    </div>
  );
}

/* ── Mini card de dados ─────────────────────────────────────── */

function MiniCard({
  emoji,
  label,
  value,
  sub,
  subColor,
  onClick,
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
      className="flex-shrink-0 flex flex-col gap-1.5 text-left cursor-pointer transition-transform active:scale-95"
      style={{
        width: 108,
        borderRadius: 16,
        padding: "12px 10px",
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
        boxShadow: "inset 0 1px 0 var(--surface-highlight)",
      }}
    >
      <span className="text-xl leading-none">{emoji}</span>
      <p className="m-0 text-[11px] font-semibold leading-tight" style={{ color: "#e0d6ff" }}>
        {value}
      </p>
      <p className="m-0 text-[10px] font-medium" style={{ color: subColor || "oklch(0.55 0.03 270)" }}>
        {sub || label}
      </p>
    </button>
  );
}

/* ── Props ──────────────────────────────────────────────────── */

interface TodayStripProps {
  recentSleep: SleepLog | null;
  todayCheckIn: CheckIn | null;
  userGender: string;
  todaySpending: number | null;
  monthDailyAvg: number | null;
  todayTasks: WeeklyTask[];
  todayMealsCount?: number;
  todayMealsKcal?: number | null;
  loading?: boolean;
  currency?: string;
}

/* ── Component ──────────────────────────────────────────────── */

export function TodayStrip({
  recentSleep,
  todayCheckIn,
  userGender,
  todaySpending,
  monthDailyAvg,
  todayTasks,
  todayMealsCount,
  todayMealsKcal,
  loading,
  currency = "BRL",
}: TodayStripProps) {
  const router = useRouter();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="px-3.5 pt-4">
        <p
          className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          {t("ts_hoje_piscar")}
        </p>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollSnapType: "x mandatory", paddingBottom: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <MiniSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const sleepValue = recentSleep?.duration_min
    ? `${Math.floor(recentSleep.duration_min / 60)}h${recentSleep.duration_min % 60 > 0 ? ` ${recentSleep.duration_min % 60}min` : ""}`
    : recentSleep?.quality
      ? t("ts_qualidade", { n: String(recentSleep.quality) })
      : "—";

  const sleepSub = recentSleep?.quality
    ? recentSleep.quality >= 4 ? t("ts_boa_noite") : recentSleep.quality >= 3 ? t("ts_noite_ok") : t("ts_noite_ruim")
    : t("ts_sem_registro");

  const sleepSubColor = recentSleep?.quality
    ? recentSleep.quality >= 3 ? "#22D18B" : "#FF5C5C"
    : undefined;

  const moodTagId = todayCheckIn?.mood_tags?.[0];
  const moodValue = moodTagId
    ? formatMood(moodTagId, userGender)
    : todayCheckIn?.feeling
      ? `"${todayCheckIn.feeling.slice(0, 12)}${todayCheckIn.feeling.length > 12 ? "…" : ""}"`
      : "—";

  const moodSub = todayCheckIn ? t("ts_checkin_feito") : t("ts_toque_registrar");
  const moodEmoji = moodTagId ? (getMoodById(moodTagId)?.emoji ?? "😊") : todayCheckIn ? "😊" : "🤔";

  const mealCount = todayMealsCount ?? 0;
  const mealKcal = todayMealsKcal ?? null;
  const mealValue = mealKcal != null ? `${mealKcal} kcal` : mealCount > 0 ? `${mealCount}/4` : "—";
  const mealSub = mealCount > 0
    ? (mealCount === 1 ? t("ts_n_refeicao", { n: String(mealCount) }) : t("ts_n_refeicoes", { n: String(mealCount) }))
    : t("ts_registrar");
  const mealSubColor = mealKcal != null && mealKcal > 2200 ? "#FF5C5C" : "#22D18B";

  // Format currency according to user preference
  const CURRENCY_CONFIG: Record<string, { locale: string; code: string }> = {
    BRL: { locale: "pt-BR", code: "BRL" },
    USD: { locale: "en-US", code: "USD" },
    EUR: { locale: "de-DE", code: "EUR" },
    GBP: { locale: "en-GB", code: "GBP" },
    ARS: { locale: "es-AR", code: "ARS" },
    CLP: { locale: "es-CL", code: "CLP" },
    MXN: { locale: "es-MX", code: "MXN" },
  };
  function fmtCurrency(amount: number): string {
    const conf = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
    try {
      return new Intl.NumberFormat(conf.locale, { style: "currency", currency: conf.code, minimumFractionDigits: 0 }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  const spendingValue = todaySpending !== null ? fmtCurrency(todaySpending) : "—";
  const spendingSub = todaySpending !== null && monthDailyAvg != null && monthDailyAvg > 0
    ? t("ts_vs_media", { amount: fmtCurrency(monthDailyAvg) })
    : todaySpending !== null ? t("ts_gasto_hoje") : t("ts_sem_dados");
  const spendingSubColor =
    todaySpending !== null && monthDailyAvg != null && monthDailyAvg > 0
      ? todaySpending > monthDailyAvg ? "#FF5C5C" : "#22D18B"
      : undefined;

  const todayDone = todayTasks.filter((t) => t.status === "concluida").length;
  const todayTotal = todayTasks.length;
  const taskValue = todayTotal > 0 ? `${todayDone}/${todayTotal}` : "—";
  const taskSub = todayTotal > 0 ? (todayDone === todayTotal ? t("ts_tudo_feito") : t("ts_em_andamento")) : t("ts_sem_tarefas");

  return (
    <div className="px-3.5 pt-4">
      <p
        className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
        style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
      >
        {t("ts_hoje_piscar")}
      </p>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        <MiniCard
          emoji="😴"
          label={t("ts_lbl_sono")}
          value={sleepValue}
          sub={sleepSub}
          subColor={sleepSubColor}
          onClick={() => router.push("/sono")}
        />
        <MiniCard
          emoji={moodEmoji}
          label={t("ts_lbl_humor")}
          value={moodValue}
          sub={moodSub}
          subColor={todayCheckIn ? "#22D18B" : undefined}
          onClick={() => router.push("/check-in")}
        />
        <MiniCard
          emoji="🥗"
          label={t("ts_lbl_refeicoes")}
          value={mealValue}
          sub={mealSub}
          subColor={mealSubColor}
          onClick={() => router.push("/nutricao")}
        />
        <MiniCard
          emoji="💰"
          label={t("ts_lbl_gastos")}
          value={spendingValue}
          sub={spendingSub}
          subColor={spendingSubColor}
          onClick={() => router.push("/financas")}
        />
        <MiniCard
          emoji="📋"
          label={t("ts_lbl_tarefas")}
          value={taskValue}
          sub={taskSub}
          subColor={todayDone === todayTotal && todayTotal > 0 ? "#22D18B" : undefined}
          onClick={() => router.push("/agenda")}
        />
      </div>

      {/* Fade indicator on right edge */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8"
        style={{
          background: "linear-gradient(to right, transparent, oklch(0.12 0.012 270))",
        }}
      />
    </div>
  );
}
