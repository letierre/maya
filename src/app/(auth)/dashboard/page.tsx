"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getLocalDate, getLocalDateDaysAgo, getUserTimezone } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cachedFetch, safeCachedFetch, invalidateFetchCache } from "@/lib/fetch-cache";
import { habitProgress } from "@/lib/checkin-answered";
import { getMoodById, getMoodLabel } from "@/lib/checkin-moods";
import { useTranslation } from "@/lib/useTranslation";
import { toast } from "sonner";
import { MayaHero } from "@/components/MayaHero";
import { RecentThread, type ThreadDay } from "@/components/RecentThread";
import { ModuloPreviewCard } from "@/components/ModuloPreviewCard";
import {
  MeditacaoCard,
  RespiracaoCard,
  CorridaCard,
  LeituraCard,
  PorquesCard,
  HistoricoCard,
  ComprasCard,
  type RunningSession,
  type ReadingBook,
  type ReadingSession,
  type ShoppingList,
  type ShoppingItem,
} from "@/components/OutrosRecursos";
import { ContinueCard, type ContinueItem } from "@/components/ContinueCard";
import { MeuPorque, type Porque } from "@/components/MeuPorque";
import { MetasSemanaCard, type Goal } from "@/components/MetasSemanaCard";
import { CheckinProgress } from "@/components/CheckinProgress";
import { InsightsCarousel } from "@/components/InsightsCarousel";
import { CareList } from "@/components/CareList";
import { onCareDataChanged } from "@/lib/care-events";
import { TrialBanner, SubscriptionNotice } from "@/components/SubscriptionStatus";
import type { CheckIn, SleepLog, WeeklyTask } from "@/types";

// ── Snapshot da home (stale-while-revalidate) ───────────────────
// Mantém o último estado renderizado em memória (módulo) para a volta à home
// ser instantânea entre navegações, sem flash de skeleton. Os fetches rodam
// em background e atualizam os valores assim que resolvem.
type DashboardSnapshot = {
  checkIns: CheckIn[];
  todayCheckIn: CheckIn | null;
  enabledKeys: string[];
  sleepLogs: SleepLog[];
  recentSleep: SleepLog | null;
  userName: string;
  userGender: string;
  currency: string;
  mayaNudgeAction: { label: string; href: string } | null;
  homeMessage: { message: string; state?: string; action?: { label: string; href: string } } | null;
  todaySpending: number | null;
  weeklyDailyAvg: number | null;
  todayTasks: WeeklyTask[];
  diaryPreview: string | null;
  diarySub: string;
  nutricaoPreview: string | null;
  nutricaoSub: string;
  porques: Porque[];
  goals: Goal[];
  continueItem: ContinueItem | null;
  corridaSessions: RunningSession[] | null;
  readingBooks: ReadingBook[] | null;
  readingSessions: ReadingSession[] | null;
  shoppingLists: ShoppingList[] | null;
  shoppingItems: ShoppingItem[] | null;
};

let dashboardSnapshot: DashboardSnapshot | null = null;

// ── Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // Confirmação pós-checkout (volta de /dashboard?checkout=success)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success(t("dash_assinatura_ativa"));
      router.replace("/dashboard");
    }
  }, [router]);

  // Restaura o último estado renderizado (se houver) para a volta ser instantânea.
  const snap = dashboardSnapshot;

  // Core state
  const [loading, setLoading] = useState(snap == null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>(snap?.checkIns ?? []);
  const [todayCheckIn, setTodayCheckIn] = useState<CheckIn | null>(snap?.todayCheckIn ?? null);
  const [enabledKeys, setEnabledKeys] = useState<string[]>(snap?.enabledKeys ?? []);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>(snap?.sleepLogs ?? []);
  const [recentSleep, setRecentSleep] = useState<SleepLog | null>(snap?.recentSleep ?? null);

  // Profile
  const [userName, setUserName] = useState(snap?.userName ?? "");
  const [userGender, setUserGender] = useState(snap?.userGender ?? "");

  // Maya nudge (for CTA action)
  const [mayaNudgeAction, setMayaNudgeAction] = useState<{ label: string; href: string } | null>(null);

  // Maya home message (from LLM, via /api/maya/home-message)
  // Restaura do snapshot (a volta é instantânea) e só refetcha no primeiro load
  // ou quando um gatilho (care-data-changed) dispara — não a cada montagem.
  const [homeMessage, setHomeMessage] = useState<{
    message: string;
    state?: string;
    action?: { label: string; href: string };
  } | null>(snap?.homeMessage ?? null);

  // Finance
  const [todaySpending, setTodaySpending] = useState<number | null>(snap?.todaySpending ?? null);
  const [weeklyDailyAvg, setWeeklyDailyAvg] = useState<number | null>(snap?.weeklyDailyAvg ?? null);
  const [currency, setCurrency] = useState(snap?.currency ?? "BRL");

  // Weekly tasks
  const [todayTasks, setTodayTasks] = useState<WeeklyTask[]>(snap?.todayTasks ?? []);

  // Previews de "Seus espaços" (diário, metas, nutrição) — dados carregados no core
  const [diaryPreview, setDiaryPreview] = useState<string | null>(snap?.diaryPreview ?? null);
  const [diarySub, setDiarySub] = useState<string>(snap?.diarySub ?? "");
  const [nutricaoPreview, setNutricaoPreview] = useState<string | null>(snap?.nutricaoPreview ?? null);
  const [nutricaoSub, setNutricaoSub] = useState<string>(snap?.nutricaoSub ?? "");

  // Dados das seções secundárias (porquês, metas, continuar, tiles) — carregados
  // no mesmo Promise.all do core para a home renderizar tudo junto.
  const [porques, setPorques] = useState<Porque[]>(snap?.porques ?? []);
  const [goals, setGoals] = useState<Goal[]>(snap?.goals ?? []);
  const [continueItem, setContinueItem] = useState<ContinueItem | null>(snap?.continueItem ?? null);
  const [corridaSessions, setCorridaSessions] = useState<RunningSession[] | null>(snap?.corridaSessions ?? null);
  const [readingBooks, setReadingBooks] = useState<ReadingBook[] | null>(snap?.readingBooks ?? null);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[] | null>(snap?.readingSessions ?? null);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[] | null>(snap?.shoppingLists ?? null);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[] | null>(snap?.shoppingItems ?? null);

  // Salva o estado renderizado para a próxima montagem da home ser instantânea.
  useEffect(() => {
    if (loading) return; // só salva depois que a home renderizou dados reais
    dashboardSnapshot = {
      checkIns,
      todayCheckIn,
      enabledKeys,
      sleepLogs,
      recentSleep,
      userName,
      userGender,
      currency,
      mayaNudgeAction,
      homeMessage,
      todaySpending,
      weeklyDailyAvg,
      todayTasks,
      diaryPreview,
      diarySub,
      nutricaoPreview,
      nutricaoSub,
      porques,
      goals,
      continueItem,
      corridaSessions,
      readingBooks,
      readingSessions,
      shoppingLists,
      shoppingItems,
    };
  }, [
    loading,
    checkIns,
    todayCheckIn,
    enabledKeys,
    sleepLogs,
    recentSleep,
    userName,
    userGender,
    currency,
    mayaNudgeAction,
    homeMessage,
    todaySpending,
    weeklyDailyAvg,
    todayTasks,
    diaryPreview,
    diarySub,
    nutricaoPreview,
    nutricaoSub,
    porques,
    goals,
    continueItem,
    corridaSessions,
    readingBooks,
    readingSessions,
    shoppingLists,
    shoppingItems,
  ]);

  // ── Fetch core data ──────────────────────────────────────────

  // Mensagem + nudge da Maya: restauradas do snapshot e refetchadas apenas no
  // primeiro load ou quando um gatilho (care-data-changed) dispara — nunca a
  // cada montagem (evita a fala aparecer por último e re-disparar o LLM).
  const loadMayaMessage = useCallback(async () => {
    const userTz = getUserTimezone();
    // Busca fresca (sem cache do cliente): só roda no primeiro load ou num
    // gatilho — nesses casos queremos o estado mais recente, não o cache.
    try {
      const res = await fetch(`/api/maya/home-message?tz=${encodeURIComponent(userTz)}`);
      const data = await res.json();
      if (data.message) setHomeMessage((prev) => ({ message: data.message, state: data.state, action: prev?.action }));
    } catch {}

    try {
      const res = await fetch("/api/maya/nudge");
      const data = await res.json();
      const n = data.nudges?.[0];
      if (n?.action) setMayaNudgeAction(n.action);
      // Se o nudge trouxer mensagem própria, ela substitui a home message.
      if (n?.message) {
        setHomeMessage((prev) => ({
          message: n.message!,
          state: prev?.state,
          action: n.action || prev?.action,
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (snap) return; // snapshot já restaurado — não refetcha sem gatilho
    loadMayaMessage();
  }, [snap, loadMayaMessage]);

  useEffect(() => {
    return onCareDataChanged(() => loadMayaMessage());
  }, [loadMayaMessage]);

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
      cachedFetch<{ name?: string; gender?: string; porques?: Porque[] }>("/api/profile").catch(() => ({}) as { name?: string; gender?: string; porques?: Porque[] }),
      cachedFetch<SleepLog[]>("/api/sleep?limit=7"),
      safeCachedFetch<Array<{ date: string; content: string; title: string }>>("/api/diary?limit=1"),
      safeCachedFetch<Array<{ date: string; meal_type: string }>>(`/api/meals?date=${today}&tz=${encodeURIComponent(userTz)}`),
      safeCachedFetch<Goal[]>("/api/goals"),
      safeCachedFetch<Array<{ title: string; current_page?: number; total_pages?: number }>>("/api/leitura/books?status=lendo"),
      safeCachedFetch<RunningSession[]>("/api/running?limit=1"),
      safeCachedFetch<ReadingBook[]>("/api/leitura/books"),
      safeCachedFetch<ReadingSession[]>("/api/leitura/sessions"),
      safeCachedFetch<ShoppingList[]>("/api/shopping-lists"),
      safeCachedFetch<ShoppingItem[]>("/api/shopping-list"),
    ])
      .then(([checkInsData, prefsData, profileData, sleepData, diaryData, mealsData, goalsData, booksLendoData, runningData, readingBooksData, readingSessionsData, shoppingListsData, shoppingItemsData]) => {
        setEnabledKeys(prefsData.enabled_questions || []);
        setPorques(profileData.porques ?? []);

        if (Array.isArray(checkInsData)) {
          setCheckIns(checkInsData);
          setTodayCheckIn(checkInsData.find((c: CheckIn) => c.date === today) || null);
        }

        if (Array.isArray(sleepData)) {
          setSleepLogs(sleepData);
          // Sem fallback para o último registro: sem sono de HOJE, fica em branco.
          setRecentSleep(sleepData.find((s: SleepLog) => s.date === today) ?? null);
        }

        if (profileData.name) setUserName(profileData.name);
        if (profileData.gender) setUserGender(profileData.gender);
        else if (prefsData.context?.gender) setUserGender(prefsData.context.gender as string);
        if (prefsData.context?.currency) setCurrency(prefsData.context.currency as string);

        // Diário — nunca expõe o conteúdo no dashboard (pode ser íntimo).
        // Mostra só o estado: "registrado hoje" ou um convite a escrever.
        const latestDiary = diaryData && diaryData.length > 0 ? diaryData[0] : null;
        if (latestDiary && latestDiary.date === today) {
          setDiaryPreview(t("dash_diario_feito"));
          setDiarySub(t("dash_diario_ver"));
        } else {
          setDiaryPreview(t("dash_escreva_dia"));
          setDiarySub(t("dash_diario_prompt"));
        }

        // Nutrição
        const meals = mealsData ?? [];
        const mealCount = meals.length;
        setNutricaoPreview(mealCount > 0 ? t("dash_refeicoes", { count: String(mealCount) }) : t("dash_nenhuma_refeicao"));
        if (mealCount > 0) {
          const types = new Set(meals.map((m) => m.meal_type));
          const missing = 4 - types.size;
          setNutricaoSub(missing > 0 ? (missing === 1 ? t("dash_refeicao_pendente", { n: String(missing) }) : t("dash_refeicoes_pendentes", { n: String(missing) })) : t("dash_todas_registradas"));
        } else {
          setNutricaoSub(t("dash_registre_primeira"));
        }

        // Metas (alimenta "Metas da semana" e o fallback do "Continuar")
        const goalsList = goalsData ?? [];
        setGoals(goalsList);

        // Continuar de onde parou: livro em leitura > primeira meta ativa
        const book = (booksLendoData ?? [])[0];
        if (book) {
          const sub = book.total_pages
            ? `pág. ${book.current_page ?? 0} de ${book.total_pages}`
            : book.current_page
              ? `pág. ${book.current_page}`
              : "";
          setContinueItem({ kind: "book", title: book.title, sub, href: "/leitura" });
        } else {
          const goal = goalsList.find((g) => g.status === "ativa" || g.status === "pausada");
          setContinueItem(goal ? { kind: "goal", title: goal.title, sub: "", href: "/agenda?tab=metas" } : null);
        }

        // Tiles (corrida, leitura, compras)
        setCorridaSessions(runningData ?? []);
        setReadingBooks(readingBooksData ?? []);
        setReadingSessions(readingSessionsData ?? []);
        setShoppingLists(shoppingListsData ?? []);
        setShoppingItems(shoppingItemsData ?? []);

        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Finance — média diária dos últimos 7 dias (janela rolante), para contas
    // grandes no dia 1 (aluguel, luz…) não poluírem a média do mês inteiro.
    cachedFetch<Array<{ date: string; type: string; amount: number }>>(
      `/api/financas/transactions?from=${getLocalDateDaysAgo(6)}&to=${today}`
    )
      .then((txs) => {
        if (Array.isArray(txs)) {
          const todayTx = txs.filter((tx) => tx.date === today);
          const total = todayTx.reduce((sum, tx) => sum + (tx.type === "despesa" ? tx.amount : 0), 0);
          setTodaySpending(total);

          const weekExpenses = txs.reduce((sum, tx) => sum + (tx.type === "despesa" ? tx.amount : 0), 0);
          setWeeklyDailyAvg(weekExpenses / 7);
        }
      })
      .catch(() => {});

    // Weekly tasks — independent
    cachedFetch<{ current?: { weekly_tasks?: WeeklyTask[] } }>("/api/weekly-plans")
      .then((weeklyPlanData) => {
        const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
        const allTasks: WeeklyTask[] = weeklyPlanData?.current?.weekly_tasks ?? [];
        setTodayTasks(allTasks.filter((t: WeeklyTask) => t.day_of_week === todayDow));
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
        label: d.toLocaleDateString(getLocale(), { weekday: "short" }).replace(".", ""),
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

  // Toggle de estágio de meta direto da home (optimistic + PATCH silencioso).
  const toggleStage = useCallback((goalId: string, stageId: string, nextStatus: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              goal_stages: (g.goal_stages ?? []).map((s) =>
                s.id === stageId ? { ...s, status: nextStatus } : s,
              ),
            }
          : g,
      ),
    );
    fetch(`/api/goals/${goalId}/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
      .then(() => invalidateFetchCache("/api/goals"))
      .catch(() => {});
  }, []);

  // ── Render ───────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen pb-28"
      style={{ background: "oklch(0.12 0.012 270)" }}
    >
      {/* ═══ TRIAL BANNER ═══ */}
      <TrialBanner />

      {/* ═══ AVISO DE ASSINATURA (renovação próxima / cobrança pendente) ═══ */}
      <div style={{ margin: "0 14px 10px" }}>
        <SubscriptionNotice dismissable />
      </div>

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

      {/* ═══ CHECK-IN DE HOJE ═══ */}
      <CheckinCard todayCheckIn={todayCheckIn} userGender={userGender} loading={loading} />

      {/* ═══ CONTINUAR DE ONDE PAROU ═══ */}
      <ContinueCard item={continueItem} />

      {/* ═══ MEU PORQUÊ ═══ */}
      <MeuPorque porques={porques} />

      {/* ═══ O QUE CUIDAR NOS PRÓXIMOS DIAS ═══ */}
      <CareList />

      {/* ═══ METAS DA SEMANA ═══ */}
      <MetasSemanaCard goals={goals} onToggle={toggleStage} />

      {/* ═══ BEM-ESTAR ═══ */}
      <div className="px-3.5 pt-4">
        <p
          className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          {t("dash_bemestar")}
        </p>
        <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1">
          <div className="shrink-0" style={{ width: 148 }}><DiarioPreview loading={loading} preview={diaryPreview} sub={diarySub} /></div>
          <div className="shrink-0" style={{ width: 148 }}><SonoPreview loading={loading} recentSleep={recentSleep} /></div>
          <div className="shrink-0" style={{ width: 148 }}><NutricaoPreview loading={loading} preview={nutricaoPreview} sub={nutricaoSub} /></div>
          <div className="shrink-0" style={{ width: 148 }}><MeditacaoCard /></div>
          <div className="shrink-0" style={{ width: 148 }}><RespiracaoCard /></div>
          <div className="shrink-0" style={{ width: 148 }}><CorridaCard sessions={corridaSessions} /></div>
        </div>
      </div>

      {/* ═══ MAIS ESPAÇOS ═══ */}
      <div className="px-3.5 pt-4">
        <p
          className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
          style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
        >
          {t("dash_mais_espacos")}
        </p>
        <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1">
          <div className="shrink-0" style={{ width: 148 }}><PlanejamentoPreview loading={loading} todayTasks={todayTasks} /></div>
          <div className="shrink-0" style={{ width: 148 }}><FinancasPreview loading={loading} todaySpending={todaySpending} weeklyDailyAvg={weeklyDailyAvg} currency={currency} /></div>
          <div className="shrink-0" style={{ width: 148 }}><LeituraCard books={readingBooks} sessions={readingSessions} /></div>
          <div className="shrink-0" style={{ width: 148 }}><PorquesCard count={loading ? null : porques.length} /></div>
          <div className="shrink-0" style={{ width: 148 }}><HistoricoCard count={loading ? null : checkIns.length} /></div>
          <div className="shrink-0" style={{ width: 148 }}><ComprasCard lists={shoppingLists} items={shoppingItems} /></div>
        </div>
      </div>

      {/* ═══ O FIO ═══ */}
      <RecentThread days={weekDays} userGender={userGender} sparkData={sparkData} />

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

    </div>
  );
}

// ── Module preview sub-components (inline — thin wrappers) ─────

function CheckinCard({ todayCheckIn, userGender, loading }: {
  todayCheckIn: CheckIn | null;
  userGender: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  if (loading) {
    return (
      <div className="px-3.5 pt-4">
        <div
          className="rounded-2xl p-4 flex items-center gap-3 animate-pulse"
          style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
        >
          <div className="size-9 rounded-full" style={{ background: "var(--surface-3)" }} />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 rounded-full w-24" style={{ background: "var(--surface-3)" }} />
            <div className="h-3 rounded-full w-36" style={{ background: "var(--surface-3)" }} />
          </div>
        </div>
      </div>
    );
  }

  const moodTagId = todayCheckIn?.mood_tags?.[0];
  const moodChip = moodTagId ? getMoodById(moodTagId) : undefined;
  const moodLabel = moodChip ? getMoodLabel(moodChip, userGender) : todayCheckIn?.feeling || null;
  const emoji = moodChip?.emoji ?? "😊";

  return (
    <div className="px-3.5 pt-4">
      <button
        type="button"
        onClick={() => router.push("/check-in")}
        className="w-full rounded-2xl p-4 flex items-center gap-3 text-left border-0 cursor-pointer transition-transform active:scale-[0.99] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(124,92,255,.18), rgba(167,139,250,.08))",
          border: "1px solid rgba(167,139,250,.22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "oklch(0.65 0.12 270)" }}>
            {t("dash_checkin_titulo")}
          </p>
          <p className="m-0 mt-0.5 text-[15px] font-bold leading-tight" style={{ color: "#e0d6ff" }}>
            {todayCheckIn ? t("dash_editar_checkin") : t("dash_registrar_dia")}
          </p>
          {moodLabel && (
            <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {moodLabel}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "#A78BFA" }} />
      </button>
    </div>
  );
}

function DiarioPreview({ loading, preview, sub }: { loading: boolean; preview: string | null; sub: string }) {
  const { t } = useTranslation();
  return (
    <ModuloPreviewCard
      emoji="📖"
      label={t("dash_diario")}
      preview={preview}
      sub={sub}
      href="/diario"
      accent="#5EEAD4"
      loading={loading}
    />
  );
}

function SonoPreview({ loading, recentSleep }: { loading: boolean; recentSleep: SleepLog | null }) {
  const { t } = useTranslation();
  const hrs = recentSleep?.duration_min
    ? Math.floor((recentSleep.duration_min / 60) * 10) / 10
    : null;
  const q = recentSleep?.quality ?? null;
  const qualityLabel =
    q == null ? null
    : q >= 5 ? t("dash_otimo")
    : q >= 4 ? t("dash_bom")
    : q >= 3 ? t("dash_ok")
    : q >= 2 ? t("dash_ruim")
    : t("dash_pessimo");

  return (
    <ModuloPreviewCard
      emoji="😴"
      label={t("dash_sono")}
      preview={hrs ? t("dash_horas_dormidas", { hrs: String(hrs) }) : t("dash_registre_sono")}
      sub={qualityLabel ? t("dash_qualidade", { q: qualityLabel }) : t("dash_como_dormiu")}
      href="/sono"
      accent="#8b5cf6"
      loading={loading}
    />
  );
}

const CURRENCY_CONFIG: Record<string, { locale: string; code: string }> = {
  BRL: { locale: "pt-BR", code: "BRL" },
  USD: { locale: "en-US", code: "USD" },
  EUR: { locale: "de-DE", code: "EUR" },
  GBP: { locale: "en-GB", code: "GBP" },
  ARS: { locale: "es-AR", code: "ARS" },
  CLP: { locale: "es-CL", code: "CLP" },
  MXN: { locale: "es-MX", code: "MXN" },
};

function fmtCurrency(amount: number, currency: string): string {
  const conf = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
  try {
    return new Intl.NumberFormat(conf.locale, { style: "currency", currency: conf.code, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function FinancasPreview({ loading, todaySpending, weeklyDailyAvg, currency }: {
  loading: boolean;
  todaySpending: number | null;
  weeklyDailyAvg: number | null;
  currency: string;
}) {
  const { t } = useTranslation();
  return (
    <ModuloPreviewCard
      emoji="💰"
      label={t("dash_financas")}
      preview={todaySpending != null ? t("dash_gasto_hoje", { amount: fmtCurrency(todaySpending, currency) }) : t("dash_sem_gastos")}
      sub={todaySpending != null
        ? (weeklyDailyAvg != null && weeklyDailyAvg > 0 ? t("dash_media_semana", { amount: fmtCurrency(weeklyDailyAvg, currency) }) : t("dash_gastos_hoje_sub"))
        : t("dash_registre_despesas")}
      href="/financas"
      accent="#fbbf24"
      loading={loading}
    />
  );
}

function PlanejamentoPreview({ loading, todayTasks }: { loading: boolean; todayTasks: WeeklyTask[] }) {
  const { t } = useTranslation();
  const done = todayTasks.filter((t) => t.status === "concluida").length;
  const total = todayTasks.length;

  return (
    <ModuloPreviewCard
      emoji="📋"
      label={t("dash_plano")}
      preview={total > 0 ? t("dash_tarefas", { done: String(done), total: String(total) }) : t("dash_sem_tarefas_hoje")}
      sub={total > 0 ? (done === total ? t("dash_tudo_feito") : (total - done === 1 ? t("dash_pendente", { n: String(total - done) }) : t("dash_pendentes", { n: String(total - done) }))) : t("dash_planeje_semana")}
      href="/agenda?tab=semana"
      accent="#7C5CFF"
      loading={loading}
    />
  );
}

function NutricaoPreview({ loading, preview, sub }: { loading: boolean; preview: string | null; sub: string }) {
  const { t } = useTranslation();
  return (
    <ModuloPreviewCard
      emoji="🥗"
      label={t("dash_nutricao")}
      preview={preview}
      sub={sub}
      href="/nutricao"
      accent="#22D18B"
      loading={loading}
    />
  );
}
