"use client";

import { useEffect, useState, useMemo } from "react";
import { getLocalDate, getUserTimezone } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cachedFetch, safeCachedFetch } from "@/lib/fetch-cache";
import { habitProgress } from "@/lib/checkin-answered";
import { useTranslation } from "@/lib/useTranslation";
import { MayaHero } from "@/components/MayaHero";
import { TodayStrip } from "@/components/TodayStrip";
import { RecentThread, type ThreadDay } from "@/components/RecentThread";
import { ModuloPreviewCard } from "@/components/ModuloPreviewCard";
import { OutrosRecursos } from "@/components/OutrosRecursos";
import { CheckinProgress } from "@/components/CheckinProgress";
import { InsightsCarousel } from "@/components/InsightsCarousel";
import { EvolucaoSpark } from "@/components/EvolucaoSpark";
import { CareList } from "@/components/CareList";
import type { CheckIn, SleepLog, WeeklyTask } from "@/types";

// ── Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // Core state
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(null);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [recentSleep, setRecentSleep] = useState<SleepLog | null>(null);

  // Profile
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState("");

  // Maya nudge (for CTA action)
  const [mayaNudgeAction, setMayaNudgeAction] = useState<{ label: string; href: string } | null>(null);

  // Maya home message (from LLM, via /api/maya/home-message)
  const [homeMessage, setHomeMessage] = useState<{
    message: string;
    state?: string;
    action?: { label: string; href: string };
  } | null>(null);

  // Finance
  const [todaySpending, setTodaySpending] = useState<number | null>(null);
  const [monthDailyAvg, setMonthDailyAvg] = useState<number | null>(null);
  const [currency, setCurrency] = useState("BRL");

  // Weekly tasks & meals
  const [todayTasks, setTodayTasks] = useState<WeeklyTask[]>([]);
  const [todayMealsKcal, setTodayMealsKcal] = useState<number | null>(null);
  const [todayMealsCount, setTodayMealsCount] = useState<number>(0);

  // ── Fetch core data ──────────────────────────────────────────

  useEffect(() => {
    const today = getLocalDate();
    const userTz = getUserTimezone();

    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<{
        onboarding_completed?: boolean;
        enabled_questions?: string[];
        context?: Record<string, unknown>;
      }>("/api/preferences"),
      fetch("/api/profile").then((r) => r.json()).catch(() => ({})),
      cachedFetch<SleepLog[]>("/api/sleep?limit=7"),
    ])
      .then(([checkInsData, prefsData, profileData, sleepData]) => {
        if (!prefsData.onboarding_completed) {
          router.push("/onboarding");
          return;
        }

        setEnabledKeys(prefsData.enabled_questions || []);

        if (Array.isArray(checkInsData)) {
          setCheckIns(checkInsData);
          setTodayCheckIn(checkInsData.find((c: CheckIn) => c.date === today) || null);
        }

        if (Array.isArray(sleepData)) {
          setSleepLogs(sleepData);
          const todaySleep = sleepData.find((s: SleepLog) => s.date === today);
          if (todaySleep) setRecentSleep(todaySleep);
          else if (sleepData.length > 0) setRecentSleep(sleepData[0]);
        }

        if (profileData.name) setUserName(profileData.name);
        if (profileData.gender) setUserGender(profileData.gender);
        else if (prefsData.context?.gender) setUserGender(prefsData.context.gender as string);
        if (prefsData.context?.currency) setCurrency(prefsData.context.currency as string);

        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Maya home message — independent (LLM-generated, cached 1x/day)
    fetch(`/api/maya/home-message?tz=${encodeURIComponent(userTz)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) setHomeMessage({ message: data.message, state: data.state });
      })
      .catch(() => setHomeMessage(null));

    // Maya nudge — independent (gives extra CTA if a trigger fired)
    fetch("/api/maya/nudge")
      .then((r) => r.json())
      .then((data) => {
        const n = data.nudges?.[0];
        if (n?.action) setMayaNudgeAction(n.action);
        // If nudge has a message different from home message, use it
        if (n?.message) {
          setHomeMessage((prev) => ({
            message: n.message,
            state: prev?.state,
            action: n.action || prev?.action,
          }));
        }
      })
      .catch(() => {});

    // Finance — independent
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

          const monthExpenses = txs.reduce((sum, tx) => sum + (tx.type === "despesa" ? tx.amount : 0), 0);
          const daysElapsed = new Date().getDate();
          setMonthDailyAvg(monthExpenses / Math.max(1, daysElapsed));
        }
      })
      .catch(() => {});

    // Weekly tasks — independent
    fetch("/api/weekly-plans")
      .then((r) => r.json())
      .then((weeklyPlanData) => {
        const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
        const allTasks: WeeklyTask[] = weeklyPlanData?.current?.weekly_tasks ?? [];
        setTodayTasks(allTasks.filter((t: WeeklyTask) => t.day_of_week === todayDow));
      })
      .catch(() => {});

    // Today's meals — independent
    cachedFetch<Array<{ macros: { calorias_kcal: number } | null }>>(`/api/meals?date=${today}&tz=${encodeURIComponent(userTz)}`)
      .then((meals) => {
        if (Array.isArray(meals)) {
          setTodayMealsCount(meals.length);
          const kcal = meals.reduce((sum, m) => sum + (m.macros?.calorias_kcal ?? 0), 0);
          setTodayMealsKcal(kcal > 0 ? kcal : null);
        }
      })
      .catch(() => {});
  }, [router]);

  // ── Derived data ─────────────────────────────────────────────

  const firstName = userName.split(" ")[0];

  const enabledNonSuicidal = enabledKeys.filter(
    (k) => k !== "suicidal_thoughts" && k !== "felt_judged"
  );

  // Conta TODOS os hábitos habilitados (igual ao "Seu dia até agora" do editar),
  // para a home inspirar o usuário a completar o dia inteiro.
  const positiveCount = todayCheckIn
    ? enabledNonSuicidal.filter(
        (k) => (todayCheckIn as unknown as Record<string, unknown>)[k] === true
      ).length
    : 0;
  const totalHabits = enabledNonSuicidal.length;
  const positivePct = totalHabits > 0 ? Math.round((positiveCount / totalHabits) * 100) : 0;

  // Week days for "O Fio"
  const weekDays: ThreadDay[] = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const today = getLocalDate();
    const habitKeys = enabledKeys.filter(
      (k) => k !== "suicidal_thoughts" && k !== "felt_judged"
    );

    const sleepByDay = new Map<string, SleepLog>();
    for (const sl of sleepLogs) {
      if (!sleepByDay.has(sl.date)) sleepByDay.set(sl.date, sl);
    }

    const days: ThreadDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);
      const sl = sleepByDay.get(ds);

      const progress = ci ? habitProgress(ci, habitKeys) : null;
      days.push({
        date: ds,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        sleepQuality: sl?.quality ?? null,
        sleepHrs: sl?.duration_min ? Math.floor((sl.duration_min / 60) * 10) / 10 : null,
        cuidados: progress?.done ?? null,
        cuidadosTotal: progress?.total ?? null,
        mood_tags: ci?.mood_tags ?? [],
        feeling: ci?.feeling ?? "",
        today: ds === today,
      });
    }
    return days;
  }, [checkIns, enabledKeys, sleepLogs]);

  // Sparkline data
  const scoreKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged");
  const sparkData = useMemo(() => {
    const ciByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) ciByDay.set(ci.date, ci);

    const points: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ci = ciByDay.get(ds);
      points.push(ci ? habitProgress(ci, scoreKeys).done : 0);
    }
    return points;
  }, [checkIns, scoreKeys]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen pb-28"
      style={{ background: "oklch(0.12 0.012 270)" }}
    >
      {/* ═══ MAYA HERO ═══ */}
      <MayaHero
        firstName={firstName}
        userGender={userGender}
        homeMessage={
          homeMessage
            ? { ...homeMessage, action: homeMessage.action || mayaNudgeAction || undefined }
            : null
        }
        loading={loading}
      />

      {/* ═══ HOJE NUM PISCAR ═══ */}
      <TodayStrip
        recentSleep={recentSleep}
        todayCheckIn={todayCheckIn}
        userGender={userGender}
        todaySpending={todaySpending}
        monthDailyAvg={monthDailyAvg}
        todayTasks={todayTasks}
        todayMealsCount={todayMealsCount}
        todayMealsKcal={todayMealsKcal}
        loading={loading}
        currency={currency}
      />

      {/* ═══ O QUE CUIDAR NOS PRÓXIMOS DIAS ═══ */}
      <CareList />

      {/* ═══ SEUS ESPAÇOS ═══ */}
      <div className="px-3.5 pt-4">
        <p
          className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          Seus espaços
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DiarioPreview loading={loading} />
          <SonoPreview loading={loading} recentSleep={recentSleep} />
          <NutricaoPreview loading={loading} />
          <FinancasPreview loading={loading} todaySpending={todaySpending} monthDailyAvg={monthDailyAvg} currency={currency} />
          <MetasPreview loading={loading} />
          <PlanejamentoPreview loading={loading} todayTasks={todayTasks} />
        </div>
      </div>

      {/* ═══ OUTROS RECURSOS ═══ */}
      <OutrosRecursos />

      {/* ═══ O FIO ═══ */}
      <RecentThread days={weekDays} userGender={userGender} />

      {/* ═══ CTA REGISTRAR ═══ */}
      <div className="px-3.5 pt-4">
        <button
          type="button"
          onClick={() => router.push("/check-in")}
          className="w-full py-[15px] rounded-2xl border-0 text-white text-[15px] font-bold cursor-pointer font-[inherit]"
          style={{
            background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
            boxShadow: "0 4px 20px oklch(0.55 0.2 270 / 0.35)",
          }}
        >
          {todayCheckIn ? "Editar check-in de hoje" : "✓ Registrar meu dia"}
        </button>
        <p
          className="text-center m-0 mt-1.5 text-[11px]"
          style={{ color: "oklch(0.55 0.03 270)" }}
        >
          {todayCheckIn ? "Maya vai conectar os pontos." : "É assim que me atualizo."}
        </p>
      </div>

      {/* ═══ CUIDADOS DE HOJE ═══ */}
      {todayCheckIn && (
        <CheckinProgress
          todayCheckIn={todayCheckIn}
          enabledNonSuicidal={enabledNonSuicidal}
          positivePct={positivePct}
          positiveCount={positiveCount}
          totalHabits={totalHabits}
        />
      )}

      {/* ═══ CARROSSEL ═══ */}
      <InsightsCarousel />

      {/* ═══ EVOLUÇÃO 14d ═══ */}
      <EvolucaoSpark data={sparkData} loading={loading} />
    </div>
  );
}

// ── Module preview sub-components (inline — thin wrappers) ─────

function DiarioPreview({ loading }: { loading: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    safeCachedFetch<Array<{ date: string; content: string; title: string }>>("/api/diary?limit=1")
      .then((entries) => {
        if (entries && entries.length > 0) {
          const e = entries[0];
          const today = getLocalDate();
          const isToday = e.date === today;
          const text = e.content?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
          setPreview(text ? text.slice(0, 60) + (text.length > 60 ? "…" : "") : e.title || "Entrada do dia");
          setSub(isToday ? "Hoje" : new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" }));
        } else {
          setPreview("Escreva seu dia");
          setSub("Nova entrada");
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  return (
    <ModuloPreviewCard
      emoji="📖"
      label="Diário"
      preview={preview}
      sub={sub}
      href="/diario"
      accent="#5EEAD4"
      loading={loading || !ready}
    />
  );
}

function SonoPreview({ loading, recentSleep }: { loading: boolean; recentSleep: SleepLog | null }) {
  const hrs = recentSleep?.duration_min
    ? Math.floor((recentSleep.duration_min / 60) * 10) / 10
    : null;
  const q = recentSleep?.quality ?? null;
  const qualityLabel =
    q == null ? null
    : q >= 5 ? "Ótimo"
    : q >= 4 ? "Bom"
    : q >= 3 ? "Ok"
    : q >= 2 ? "Ruim"
    : "Péssimo";

  return (
    <ModuloPreviewCard
      emoji="😴"
      label="Sono"
      preview={hrs ? `${hrs}h dormidas` : "Registre seu sono"}
      sub={qualityLabel ? `Qualidade: ${qualityLabel}` : "Como dormiu ontem?"}
      href="/sono"
      accent="#8b5cf6"
      loading={loading}
    />
  );
}

const CURRENCY_SYMBOL: Record<string, string> = {
  BRL: "R$", USD: "$", EUR: "€", GBP: "£", ARS: "$", CLP: "$", MXN: "$",
};

function FinancasPreview({ loading, todaySpending, monthDailyAvg, currency }: {
  loading: boolean;
  todaySpending: number | null;
  monthDailyAvg: number | null;
  currency: string;
}) {
  const sym = CURRENCY_SYMBOL[currency] ?? "R$";
  return (
    <ModuloPreviewCard
      emoji="💰"
      label="Finanças"
      preview={todaySpending != null ? `${sym} ${todaySpending.toFixed(2)} hoje` : "Sem gastos hoje"}
      sub={todaySpending != null
        ? (monthDailyAvg != null ? `Média ${sym} ${monthDailyAvg.toFixed(2)}/dia` : "Gastos de hoje")
        : "Registre suas despesas"}
      href="/financas"
      accent="#fbbf24"
      loading={loading}
    />
  );
}

function MetasPreview({ loading }: { loading: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    safeCachedFetch<Array<{ status: string; title: string; goal_stages?: Array<{ status: string }> }>>("/api/goals")
      .then((goals) => {
        if (goals && goals.length > 0) {
          const active = goals.filter((g) => g.status === "ativa" || g.status === "pausada");
          if (active.length > 0) {
            const totalStages = active.reduce((sum, g) => sum + (g.goal_stages?.length || 0), 0);
            const doneStages = active.reduce(
              (sum, g) => sum + (g.goal_stages?.filter((s) => s.status === "concluida").length || 0), 0
            );
            const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;
            setPreview(`${active.length} meta${active.length !== 1 ? "s" : ""} ativa${active.length !== 1 ? "s" : ""}`);
            setSub(`${pct}% concluído · ${doneStages}/${totalStages} etapas`);
          } else {
            const done = goals.filter((g) => g.status === "concluida").length;
            setPreview(done > 0 ? `${done} meta${done !== 1 ? "s" : ""} concluída${done !== 1 ? "s" : ""}` : "Crie sua primeira meta");
            setSub(done > 0 ? "Todas completas! 🎉" : "Comece agora");
          }
        } else {
          setPreview("Crie sua primeira meta");
          setSub("Comece agora");
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  return (
    <ModuloPreviewCard
      emoji="🎯"
      label="Metas"
      preview={preview}
      sub={sub}
      href="/agenda?tab=metas"
      accent="#f59e0b"
      loading={loading || !ready}
    />
  );
}

function PlanejamentoPreview({ loading, todayTasks }: { loading: boolean; todayTasks: WeeklyTask[] }) {
  const done = todayTasks.filter((t) => t.status === "concluida").length;
  const total = todayTasks.length;

  return (
    <ModuloPreviewCard
      emoji="📋"
      label="Plano"
      preview={total > 0 ? `${done}/${total} tarefas` : "Sem tarefas hoje"}
      sub={total > 0 ? (done === total ? "Tudo feito! ✨" : `${total - done} pendentes`) : "Planeje sua semana"}
      href="/agenda?tab=semana"
      accent="#7C5CFF"
      loading={loading}
    />
  );
}

function NutricaoPreview({ loading }: { loading: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const today = getLocalDate();
    const userTz = getUserTimezone();
    safeCachedFetch<Array<{ date: string; meal_type: string }>>(`/api/meals?date=${today}&tz=${encodeURIComponent(userTz)}`)
      .then((meals) => {
        const count = meals?.length ?? 0;
        setPreview(count > 0 ? `${count}/4 refeições` : "Nenhuma refeição");
        if (count > 0) {
          const types = new Set(meals!.map((m) => m.meal_type));
          const missing = 4 - types.size;
          setSub(missing > 0 ? `${missing} refeição pendente` : "Todas registradas! 🎉");
        } else {
          setSub("Registre sua primeira");
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  return (
    <ModuloPreviewCard
      emoji="🥗"
      label="Nutrição"
      preview={preview}
      sub={sub}
      href="/nutricao"
      accent="#22D18B"
      loading={loading || !ready}
    />
  );
}
