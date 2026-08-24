"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Star, ChevronDown, Clock, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { TaskArea, AreaSuggestion } from "@/types";
import {
  AREA_CONFIG, ALL_AREAS, LIFE_AREAS, AREA_LABELS, DAY_NAMES, DAY_FULL,
  weekRangeFromDate as weekRange,
} from "@/lib/planejamento-constants";
import { LifeWheel } from "@/components/planejamento/LifeWheel";
import { MayaStrategyCard } from "@/components/planejamento/MayaStrategyCard";
import { WeekMetricsGrid } from "@/components/planejamento/WeekMetricsGrid";
import { FocusStones } from "@/components/planejamento/FocusStones";
import { PlanningModeToggle } from "@/components/planejamento/PlanningModeToggle";
import { PlanningCompanion } from "@/components/planejamento/PlanningCompanion";
import { QuickOKRWidget } from "@/components/planejamento/QuickOKRWidget";
import type { PlanningCompanionResponse, QuarterlyCycle } from "@/types";

// ── Mini Radar ──────────────────────────────────────────────────


// ── Panel ───────────────────────────────────────────────────────

export function PlanejamentoPanel({ selectedDate }: { selectedDate?: string }) {
  const [plan, setPlan] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [agendaItems, setAgendaItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Start at 0 (Monday) to avoid hydration crash, client useEffect corrects it
  const [selectedDay, setSelectedDay] = useState(0);
  const [dayReady, setDayReady] = useState(false);
  useEffect(() => {
    const d = new Date().getDay();
    setSelectedDay(d === 0 ? 6 : d - 1);
    setDayReady(true);
  }, []);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showReview, setShowReview] = useState(false);
  // Client-only current time
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(i); }, []);
  const clientTodayDow = now ? (now.getDay() === 0 ? 6 : now.getDay() - 1) : -1;

  // Compute the Monday of the week containing selectedDate (or today)
  const currentWeekStart = useMemo(() => {
    const d = selectedDate ? new Date(selectedDate + "T12:00:00") : new Date();
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }, [selectedDate]);

  // Sunday of the same week (to fetch agenda items from Mon–Sun)
  const currentWeekEnd = useMemo(() => {
    const d = new Date(currentWeekStart + "T12:00:00");
    d.setDate(d.getDate() + 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [currentWeekStart]);

  // Add task form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskArea, setNewTaskArea] = useState("saude");
  const [newTaskDay, setNewTaskDay] = useState(selectedDay);
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskType, setNewTaskType] = useState<"manutencao" | "crescimento">("manutencao");
  const [newIsStone, setNewIsStone] = useState(false);
  const [newStoneRank, setNewStoneRank] = useState(1);

  // Review form
  const [reviewWin, setReviewWin] = useState("");
  const [reviewBlock, setReviewBlock] = useState("");
  const [reviewLearn, setReviewLearn] = useState("");
  const [reviewScore, setReviewScore] = useState(3);
  const [editingPlanTask, setEditingPlanTask] = useState<any>(null);
  const [planEditTitle, setPlanEditTitle] = useState("");
  const [planEditDay, setPlanEditDay] = useState(0);
  const [planEditArea, setPlanEditArea] = useState("saude");
  const [planEditType, setPlanEditType] = useState<"manutencao" | "crescimento">("manutencao");
  const [planEditStone, setPlanEditStone] = useState(false);
  const [planEditStoneRank, setPlanEditStoneRank] = useState(1);
  const [planEditTime, setPlanEditTime] = useState("");
  const [planShowMore, setPlanShowMore] = useState(false);
  const [showStoneEditor, setShowStoneEditor] = useState(false);
  const [stone1, setStone1] = useState("");
  const [stone2, setStone2] = useState("");
  const [stone3, setStone3] = useState("");
  const [editingStoneIndex, setEditingStoneIndex] = useState(0); // 0=I, 1=II, 2=III

  // Plan insight from Maya
  const [planInsight, setPlanInsight] = useState<{ message: string; action?: { label: string; href: string } } | null>(null);
  const [planMetrics, setPlanMetrics] = useState<{ strongest: string; weakest: string; balance: number; variation: number }>({ strongest: "—", weakest: "—", balance: 50, variation: 0 });
  const [insightLoading, setInsightLoading] = useState(true);

  // ── Modo Planejamento ──
  const [planningMode, setPlanningMode] = useState<"view" | "plan">("view");
  const [companionLoading, setCompanionLoading] = useState(false);
  const [companionData, setCompanionData] = useState<PlanningCompanionResponse | null>(null);
  const [firstName, setFirstName] = useState("");
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [activeCycle, setActiveCycle] = useState<QuarterlyCycle | null>(null);
  const [okrLoading, setOkrLoading] = useState(true);

  const fetchPlan = async () => {
    try {
      const res = await fetch(`/api/weekly-plans?week=${currentWeekStart}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setTasks(data.current?.weekly_tasks || []);
      }
    } catch {}
    setLoading(false);
  };

  // Fetch Maya's plan insight (insights + métricas dos indicadores)
  const fetchInsight = useCallback(() => {
    setInsightLoading(true);
    fetch(`/api/maya/plan-insight?week=${currentWeekStart}`)
      .then(r => r.json())
      .then(d => {
        if (d.insights?.length > 0) setPlanInsight(d.insights[0]);
        if (d.metrics) setPlanMetrics(d.metrics);
      })
      .catch(() => {})
      .finally(() => setInsightLoading(false));
  }, [currentWeekStart]);

  useEffect(() => {
    setLoading(true);
    fetchPlan();
    // Fetch agenda items (compromissos/tarefas criados direto na agenda) for the week
    fetch(`/api/agenda?from=${currentWeekStart}&to=${currentWeekEnd}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAgendaItems(d); })
      .catch(() => {});
    // Fetch user profile for planning mode
    fetch("/api/preferences")
      .then(r => r.json())
      .then(d => {
        if (d?.name) setFirstName(d.name.split(" ")[0]);
      })
      .catch(() => {});
    // Fetch active goals for planning mode
    fetch("/api/goals")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setActiveGoals(d);
      })
      .catch(() => {});
    // Fetch active quarterly cycle for OKR widget
    setOkrLoading(true);
    fetch("/api/quarterly-cycles")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const active = d.find((c: QuarterlyCycle) => c.status === "active") || null;
          setActiveCycle(active);
        }
      })
      .catch(() => {})
      .finally(() => setOkrLoading(false));
  }, [selectedDate]);

  // Recalcula insight/métricas sempre que o plano muda (novas tarefas, conclusões, etc.)
  useEffect(() => {
    fetchInsight();
  }, [fetchInsight, tasks, agendaItems]);

  // Lock body scroll when editor is open
  useEffect(() => {
    if (editingPlanTask || showStoneEditor || showAddTask) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [editingPlanTask]);

  const toggleTask = async (taskId: string, current: string) => {
    const next = current === "concluida" ? "pendente" : "concluida";
    setTasks((prev: any[]) => prev.map(t => t.id === taskId ? { ...t, status: next } : t));
    await fetch(`/api/weekly-plans/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;

    // Create task
    const res = await fetch("/api/weekly-plans/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTaskTitle.trim(), area: newTaskArea, day_of_week: newTaskDay === -1 ? null : newTaskDay,
        task_type: newTaskType, scheduled_time: newTaskTime || null,
        week_start: currentWeekStart,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      setTasks((prev: any[]) => [...prev, task]);
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      console.error("addTask error:", err);
      alert(`Erro ao criar tarefa:\n${err.error || err.message || JSON.stringify(err)}\nweek: ${currentWeekStart}`);
    }

    // Define as pedra da semana
    if (newIsStone && currentPlan) {
      const stoneField = newStoneRank === 1 ? "main_focus" : newStoneRank === 2 ? "main_focus_2" : "main_focus_3";
      await fetch("/api/weekly-plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [stoneField]: newTaskTitle.trim(), week_start: currentWeekStart }),
      });
    }

    setShowAddTask(false); setNewTaskTitle(""); setNewTaskTime(""); setNewIsStone(false); setNewStoneRank(1);
    fetchPlan();
  };

  const saveReview = async () => {
    if (!reviewWin.trim()) return;
    await fetch("/api/weekly-plans/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ biggest_win: reviewWin, blocked_lesson: reviewBlock, main_learning: reviewLearn, week_score: reviewScore, week_start: currentWeekStart }),
    });
    setShowReview(false); fetchPlan();
  };

  const currentPlan = plan?.current ?? null;
  const review = currentPlan?.weekly_reviews?.[0] ?? null;
  const focuses = [currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3].filter(Boolean);
  const doneTasks = tasks.filter((t: any) => t.status === "concluida").length;

  const taskCountsByArea = useMemo(() => {
    const acc: Record<string, number> = {};
    ALL_AREAS.forEach(a => acc[a] = tasks.filter((t: any) => t.area === a && t.status === "concluida").length);
    // Mescla itens da agenda (compromissos/tarefas criados direto na agenda) na Roda da Vida
    agendaItems.forEach((it: any) => {
      if (it.area && it.area !== "outros" && it.status === "concluida") acc[it.area] = (acc[it.area] ?? 0) + 1;
    });
    return acc;
  }, [tasks, agendaItems]);
  const taskTotalByArea = useMemo(() => {
    const acc: Record<string, number> = {};
    ALL_AREAS.forEach(a => acc[a] = tasks.filter((t: any) => t.area === a).length);
    agendaItems.forEach((it: any) => {
      if (it.area && it.area !== "outros") acc[it.area] = (acc[it.area] ?? 0) + 1;
    });
    return acc;
  }, [tasks, agendaItems]);

  const selectedDayTasks = tasks.filter((t: any) => t.day_of_week === selectedDay)
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  const doneSelectedDay = selectedDayTasks.filter((t: any) => t.status === "concluida").length;
  const openTasks = tasks.filter((t: any) => t.day_of_week == null);

  const assignToToday = async (task: any) => {
    const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const res = await fetch(`/api/weekly-plans/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_of_week: today }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev: any[]) => prev.map(t => t.id === task.id ? updated : t));
    }
  };

  // ── Planning Companion callbacks ──

  const buildPlanState = useCallback(() => {
    const areasWithTasks = LIFE_AREAS.filter(a => (taskTotalByArea[a] || 0) > 0);
    const emptyAreas = LIFE_AREAS.filter(a => (taskTotalByArea[a] || 0) === 0);
    const areaTasks = LIFE_AREAS
      .map(a => {
        const list = tasks.filter((t: any) => t.area === a);
        return {
          area: a,
          total: list.length,
          done: list.filter((t: any) => t.status === "concluida").length,
          titles: list.map((t: any) => t.title),
        };
      })
      .filter(x => x.total > 0);
    return {
      stones: [currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3],
      areasWithTasks,
      emptyAreas,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t: any) => t.status === "concluida").length,
      linkedGoalIds: activeGoals.map((g: any) => g.id),
      areaTasks,
    };
  }, [taskTotalByArea, tasks, currentPlan, activeGoals]);

  const requestCompanion = async () => {
    setCompanionLoading(true);
    try {
      const res = await fetch("/api/maya/planning-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: currentWeekStart, planState: buildPlanState() }),
      });
      const data = await res.json();
      setCompanionData(data);
    } catch {
      setCompanionData(null);
    } finally {
      setCompanionLoading(false);
    }
  };

  const requestAreaSuggestion = async (area: string): Promise<AreaSuggestion | null> => {
    try {
      const res = await fetch("/api/maya/planning-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: currentWeekStart, focusArea: area, planState: buildPlanState() }),
      });
      const data = await res.json();
      return (data?.areaSuggestions?.[0] ?? null) as AreaSuggestion | null;
    } catch {
      return null;
    }
  };

  const addTaskFromSuggestion = async (title: string, area: string, dayOfWeek?: number) => {
    const res = await fetch("/api/weekly-plans/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        area,
        day_of_week: dayOfWeek ?? null,
        task_type: "crescimento",
        week_start: currentWeekStart,
      }),
    });
    if (res.ok) {
      const newTask = await res.json();
      setTasks((prev: any[]) => [...prev, newTask]);
      toast.success(`"${title}" adicionada`, {
        description: `Área: ${AREA_LABELS[area as TaskArea] || area}`,
      });
      return true;
    }
    toast.error("Erro ao adicionar tarefa");
    return false;
  };

  const setStoneFromSuggestion = async (rank: number, text: string) => {
    const labels = ["I", "II", "III"];
    if (!currentPlan?.id) {
      const res = await fetch("/api/weekly-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: currentWeekStart,
          main_focus: rank === 1 ? text : "",
          main_focus_2: rank === 2 ? text : "",
          main_focus_3: rank === 3 ? text : "",
        }),
      });
      if (res.ok) {
        await fetchPlan();
        toast.success(`Pedra ${labels[rank - 1]} definida`, {
          description: `"${text.slice(0, 50)}"`,
        });
      } else {
        toast.error("Erro ao definir pedra");
      }
      return;
    }
    const body: Record<string, string> = {};
    if (rank === 1) body.main_focus = text;
    if (rank === 2) body.main_focus_2 = text;
    if (rank === 3) body.main_focus_3 = text;
    const res = await fetch(`/api/weekly-plans/${currentPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await fetchPlan();
      toast.success(`Pedra ${labels[rank - 1]} atualizada`, {
        description: `"${text.slice(0, 50)}"`,
      });
    } else {
      toast.error("Erro ao atualizar pedra");
    }
  };

  const stones = [currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3]
    .filter(Boolean)
    .map((text, i) => ({ rank: i + 1, text: text!, area: undefined as string | undefined }));

  // Ao entrar no modo planejar, zera a análise anterior para refletir o plano atual
  const handleModeChange = (mode: "view" | "plan") => {
    setPlanningMode(mode);
    if (mode === "plan") setCompanionData(null);
  };

  if (loading) return <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center", padding: 20 }}>Carregando...</p>;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── Mode Toggle ── */}
      <PlanningModeToggle mode={planningMode} onChange={handleModeChange} />

      {/* ── Modo Planejar ── */}
      {planningMode === "plan" && (
        <PlanningCompanion
          companionData={companionData}
          loading={companionLoading}
          firstName={firstName}
          stones={[currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3]}
          areasWithTasks={LIFE_AREAS.filter(a => (taskTotalByArea[a] || 0) > 0)}
          tasksByArea={(area: string) => tasks.filter((t: any) => t.area === area)}
          onRequestCompanion={requestCompanion}
          onSuggestArea={requestAreaSuggestion}
          onAddTask={addTaskFromSuggestion}
          onSetStone={setStoneFromSuggestion}
          planMetrics={planMetrics}
          activeCycle={activeCycle}
        />
      )}

      {/* ── Modo Visualizar (dashboard atual) ── */}
      {planningMode === "view" && (
        <>
          {/* Maya Strategy Card */}
          <MayaStrategyCard insight={planInsight} loading={insightLoading} />

      {/* Life Wheel */}
      <LifeWheel
        done={taskCountsByArea}
        totals={taskTotalByArea}
        weekLabel={weekRange(currentWeekStart)}
        stones={[currentPlan?.main_focus, currentPlan?.main_focus_2, currentPlan?.main_focus_3]}
      />

      {/* Week Metrics */}
      <WeekMetricsGrid metrics={planMetrics} />

      {/* Quick OKR Widget */}
      <div style={{ marginBottom: 12 }}>
        <QuickOKRWidget activeCycle={activeCycle} loading={okrLoading} />
      </div>

      {/* Focus Stones Carousel */}
      <FocusStones
        stones={stones}
        onEdit={() => {
          setShowStoneEditor(true);
          setStone1(currentPlan?.main_focus ?? "");
          setStone2(currentPlan?.main_focus_2 ?? "");
          setStone3(currentPlan?.main_focus_3 ?? "");
        }}
      />

      {/* Energy Distribution */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
            Distribuição de energia
          </p>
          {ALL_AREAS.filter(a => taskTotalByArea[a] > 0).sort((a, b) => taskTotalByArea[b] - taskTotalByArea[a]).slice(0, 5).map(a => {
            const pct = tasks.length > 0 ? Math.round((taskTotalByArea[a] / tasks.length) * 100) : 0;
            const areaConf = AREA_CONFIG[a];
            return (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0 }}>{areaConf?.emoji || "⚪"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9e96b5", width: 70, flexShrink: 0 }}>{AREA_LABELS[a] || a}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 9999, width: `${Math.max(pct, 3)}%`,
                    background: `oklch(.5 .12 ${areaConf?.hue || 200})`,
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A78BFA", width: 30, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Day Focus + Tasks */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
          Foco por dia
        </p>
        {/* Day selector */}
        <div suppressHydrationWarning style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 12 }}>
          {DAY_NAMES.map((d, i) => {
            const today = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
            const dt = tasks.filter((t: any) => t.day_of_week === i);
            const isToday = i === today;
            const load = dt.length === 0 ? "—" : dt.length <= 2 ? "Leve" : dt.length <= 4 ? "Médio" : dt.length <= 6 ? "Cheio" : "Pesado";
            return (
              <button key={i} type="button" onClick={() => setSelectedDay(i)}
                style={{ padding: "8px 2px 6px", borderRadius: 10, border: isToday ? "1.5px solid rgba(167,139,250,0.4)" : "1.5px solid transparent", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? "#A78BFA" : "#9e96b5", textTransform: "uppercase" }}>{d}</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: "#6a657a" }}>{load}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#9e96b5" }}>{dt.length > 0 ? `${dt.filter((t: any) => t.status === "concluida").length}/${dt.length}` : ""}</span>
              </button>
            );
          })}
        </div>

        {/* Selected day tasks */}
        <div style={{ background: "#151520", borderRadius: 18, border: "1px solid rgba(167,139,250,0.08)", padding: "12px 16px" }}>
          <p suppressHydrationWarning style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "#9e96b5" }}>
            {DAY_FULL[selectedDay]} · {selectedDayTasks.length > 0 ? `${doneSelectedDay}/${selectedDayTasks.length} feitas` : "Sem tarefas"}
          </p>
          {/* Current time indicator */}
          {selectedDay === clientTodayDow && now && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "5px 10px", borderRadius: 8, background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5050", flexShrink: 0, boxShadow: "0 0 0 3px rgba(255,80,80,0.25)", animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: "#FF7070" }}>Agora · {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
          {selectedDayTasks.length === 0 ? (
            <p style={{ color: "#5a5470", fontSize: 12, textAlign: "center", padding: 12, margin: 0 }}>Nenhuma tarefa</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {selectedDayTasks.map((task: any) => {
                const area = AREA_CONFIG[task.area as TaskArea] || AREA_CONFIG.outros;
                const done = task.status === "concluida";
                return (
                  <div key={task.id}
                    onClick={() => {
                      setEditingPlanTask(task);
                      setPlanEditTitle(task.title || "");
                      setPlanEditDay(task.day_of_week ?? 0);
                      setPlanEditArea(task.area || "saude");
                      setPlanEditType(task.task_type || "manutencao");
                      setPlanEditTime(task.scheduled_time?.slice(0, 5) || "");
                      setPlanEditStone(!!task.stone_rank);
                      setPlanEditStoneRank(task.stone_rank || 1);
                      setPlanShowMore(false);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(167,139,250,0.04)", cursor: "pointer" }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.status); }}
                      style={{ width: 18, height: 18, borderRadius: task.task_type === "manutencao" ? "50%" : 4, flexShrink: 0, border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)", background: done ? "#7C5CFF" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>}
                    </button>
                    <span style={{ fontSize: 11 }}>{area.emoji}</span>
                    {task.stone_rank && (
                      <span style={{ fontSize: 8, fontWeight: 800, color: "#A78BFA", background: "rgba(167,139,250,0.12)", padding: "1px 4px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>
                        {["I","II","III"][task.stone_rank - 1]}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none" }}>{task.title}</span>
                    {task.scheduled_time && <span style={{ fontSize: 9, color: "#6a657a", fontFamily: "monospace" }}>{task.scheduled_time.slice(0,5)}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => { setNewTaskDay(selectedDay); setShowAddTask(true); }}
            style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 12, background: "rgba(124,92,255,0.04)", border: "1.5px dashed rgba(124,92,255,0.2)", cursor: "pointer", color: "#A78BFA", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      </div>

      {/* Em aberto */}
      {openTasks.length > 0 && (
        <div style={{ background: "#151520", borderRadius: 18, border: "1px solid rgba(167,139,250,0.08)", padding: "12px 16px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#A78BFA" }}>📋 Em aberto</p>
          {openTasks.map((task: any) => {
            const area = AREA_CONFIG[task.area as TaskArea] || AREA_CONFIG.outros;
            const done = task.status === "concluida";
            return (
              <div key={task.id}
                onClick={() => {
                  setEditingPlanTask(task);
                  setPlanEditTitle(task.title || "");
                  setPlanEditDay(task.day_of_week ?? -1);
                  setPlanEditArea(task.area || "saude");
                  setPlanEditType(task.task_type || "manutencao");
                  setPlanEditTime(task.scheduled_time?.slice(0, 5) || "");
                  setPlanEditStone(!!task.stone_rank);
                  setPlanEditStoneRank(task.stone_rank || 1);
                  setPlanShowMore(false);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(167,139,250,0.04)", cursor: "pointer" }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.status); }}
                  style={{ width: 18, height: 18, borderRadius: task.task_type === "manutencao" ? "50%" : 4, flexShrink: 0, border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)", background: done ? "#7C5CFF" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>}
                </button>
                <span style={{ fontSize: 11 }}>{area.emoji}</span>
                {task.stone_rank && (
                  <span style={{ fontSize: 8, fontWeight: 800, color: "#A78BFA", background: "rgba(167,139,250,0.12)", padding: "1px 4px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>
                    {["I","II","III"][task.stone_rank - 1]}
                  </span>
                )}
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none" }}>{task.title}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); assignToToday(task); }}
                  style={{ padding: "3px 8px", borderRadius: 9999, border: "1px solid rgba(167,139,250,0.25)", background: "rgba(124,92,255,0.06)", color: "#A78BFA", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  Hoje →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Commitment Card */}
      <div style={{
        background: "linear-gradient(135deg, #1a1530 0%, rgba(94,234,212,0.04) 100%)",
        borderRadius: 20, border: "1px solid rgba(94,234,212,0.12)",
        padding: "18px 20px", marginBottom: 16,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#5EEAD4" }}>
          Compromisso da semana
        </p>

        {focuses.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "#9e96b5", lineHeight: 1.4 }}>
              Se estas coisas acontecerem, a semana valeu a pena:
            </p>
            {focuses.map((focus: string, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
                borderTop: i > 0 ? "1px solid rgba(94,234,212,0.06)" : "none",
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(94,234,212,0.1)", color: "#5EEAD4",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.4, paddingTop: 2 }}>
                  {focus}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 16, textAlign: "center", padding: "14px 0" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6a657a" }}>
              Defina suas pedras e elas aparecerão aqui como o compromisso da semana.
            </p>
            <button type="button" onClick={() => setShowStoneEditor(true)}
              style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(94,234,212,0.2)", background: "rgba(94,234,212,0.04)", cursor: "pointer", color: "#5EEAD4", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
              Definir pedras
            </button>
          </div>
        )}

        {review ? (
          <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(94,234,212,0.06)", border: "1px solid rgba(94,234,212,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#5EEAD4", letterSpacing: ".06em" }}>Revisão ✓</p>
              <div style={{ display: "flex", gap: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ fontSize: 12, color: i < review.week_score ? "#F59E0B" : "rgba(167,139,250,0.15)" }}>★</span>
                ))}
              </div>
            </div>
            {review.biggest_win && <p style={{ margin: 0, fontSize: 12, color: "#9e96b5" }}>🏆 {review.biggest_win.slice(0, 100)}</p>}
            {review.main_learning && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6a657a" }}>💡 {review.main_learning.slice(0, 100)}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setShowReview(true)}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(94,234,212,0.2)", background: "rgba(94,234,212,0.04)", cursor: "pointer", color: "#5EEAD4", fontSize: 13, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Star size={16} /> Fazer revisão da semana
          </button>
        )}
      </div>

      {/* FAB */}
      <button type="button" onClick={() => { setNewTaskDay(selectedDay); setShowAddTask(true); }}
        style={{ position: "fixed", bottom: 84, right: 20, zIndex: 40, width: 56, height: 56, borderRadius: "50%", background: "#7C5CFF", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(124,92,255,0.4)" }}>
        <Plus size={24} color="#fff" />
      </button>

      {/* Add Task Sheet */}
      {showAddTask && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 400, maxHeight: "70dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Nova atividade</h3>
            <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Título" autoFocus style={inputS} />
            <p style={{ fontSize: 10, color: "#A78BFA", margin: "12px 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>Área</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
              {ALL_AREAS.filter(a => a !== "outros").map(a => {
                const area = AREA_CONFIG[a];
                return (
                <button key={a} type="button" onClick={() => setNewTaskArea(a)}
                  style={{ padding: "8px 4px", borderRadius: 10, border: newTaskArea === a ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: newTaskArea === a ? "rgba(124,92,255,0.1)" : "#0B0B10", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{area?.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: newTaskArea === a ? "#A78BFA" : "#9e96b5" }}>{
                    (AREA_LABELS as Record<string, string>)[a] || a
                  }</span>
                </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4 }}>Dia {newTaskDay === -1 && <span style={{ color: "#A78BFA" }}>· Em aberto</span>}</p>
                <div style={{ display: "flex", gap: 2 }}>
                  {DAY_NAMES.map((d, i) => (
                    <button key={i} type="button" onClick={() => setNewTaskDay(newTaskDay === i ? -1 : i)}
                      style={{ flex: 1, padding: "6px 2px", borderRadius: 8, border: 0, cursor: "pointer", background: newTaskDay === i ? "#7C5CFF" : "rgba(167,139,250,0.08)", color: newTaskDay === i ? "#fff" : "#9e96b5", fontSize: 9, fontWeight: 600, fontFamily: "inherit" }}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setNewTaskType("manutencao")}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: newTaskType === "manutencao" ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: newTaskType === "manutencao" ? "rgba(124,92,255,0.1)" : "transparent", cursor: "pointer", color: newTaskType === "manutencao" ? "#A78BFA" : "#9e96b5", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>↻ Hábito</button>
              <button type="button" onClick={() => setNewTaskType("crescimento")}
                style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: newTaskType === "crescimento" ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: newTaskType === "crescimento" ? "rgba(124,92,255,0.1)" : "transparent", cursor: "pointer", color: newTaskType === "crescimento" ? "#A78BFA" : "#9e96b5", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>↑ Crescer</button>
            </div>
            {/* Pedra da semana */}
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "#0B0B10", border: newIsStone ? "1px solid rgba(124,92,255,0.3)" : "1px solid rgba(167,139,250,0.1)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={newIsStone} onChange={e => setNewIsStone(e.target.checked)}
                  style={{ accentColor: "#7C5CFF", width: 18, height: 18 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>Definir como pedra da semana</span>
              </label>
              {newIsStone && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {([1,2,3] as const).map(n => {
                    const occupied = n === 1 ? currentPlan?.main_focus : n === 2 ? currentPlan?.main_focus_2 : currentPlan?.main_focus_3;
                    const isOccupied = !!occupied;
                    return (
                      <button key={n} type="button" onClick={() => setNewStoneRank(n)}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 10, border: 0, cursor: "pointer",
                          fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                          background: newStoneRank === n ? "#7C5CFF" : "rgba(167,139,250,0.08)",
                          color: newStoneRank === n ? "#fff" : "#9e96b5",
                          opacity: isOccupied && newStoneRank !== n ? 0.5 : 1,
                        }}>
                        {["I", "II", "III"][n-1]}
                        {isOccupied && <div style={{ fontSize: 8, opacity: .7 }}>em uso</div>}
                      </button>
                    );
                  })}
                </div>
              )}
              {newIsStone && (() => {
                const occupied = newStoneRank === 1 ? currentPlan?.main_focus : newStoneRank === 2 ? currentPlan?.main_focus_2 : currentPlan?.main_focus_3;
                if (!occupied) return null;
                return (
                  <p style={{ margin: "8px 0 0", fontSize: 10, color: "#FF9F43", textAlign: "center" }}>
                    ⚠️ Já existe uma pedra {["I","II","III"][newStoneRank-1]}: "{String(occupied).slice(0, 40)}" — será substituída
                  </p>
                );
              })()}
            </div>

            {/* Time — toggle on/off */}
            <div style={{ marginTop: 12 }}>
              {newTaskTime ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#0B0B10", border: "1px solid rgba(167,139,250,0.2)" }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>🕐</span>
                    <input type="time" value={newTaskTime} onChange={e => setNewTaskTime(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: 0, color: "#A78BFA", fontSize: 13, fontWeight: 600, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
                  </div>
                  <button type="button" onClick={() => setNewTaskTime("")}
                    style={{ padding: "8px", borderRadius: 9999, border: 0, background: "rgba(167,139,250,0.1)", color: "#9e96b5", fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                </div>
              ) : (
                <button type="button" onClick={() => setNewTaskTime("09:00")}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 10, border: "1px dashed rgba(167,139,250,0.25)", background: "transparent", color: "#9e96b5", fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%", justifyContent: "center" }}>
                  🕐 Adicionar horário
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setShowAddTask(false)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button type="button" onClick={addTask} disabled={!newTaskTitle.trim()}
                style={{ flex: 2, padding: 14, borderRadius: 14, border: 0, background: newTaskTitle.trim() ? "#7C5CFF" : "#1e1840", color: newTaskTitle.trim() ? "#fff" : "#9e96b5", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Sheet */}
      {showReview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 400, maxHeight: "85dvh", overflowY: "auto", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Revisão da semana</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9e96b5" }}>{weekRange(selectedDate)}</p>
            <textarea value={reviewWin} onChange={e => setReviewWin(e.target.value)} placeholder="🏆 Qual foi sua maior vitória?" rows={2} style={{ ...inputS, resize: "none", height: 56, marginBottom: 10 }} />
            <textarea value={reviewBlock} onChange={e => setReviewBlock(e.target.value)} placeholder="🔒 O que travou?" rows={2} style={{ ...inputS, resize: "none", height: 56, marginBottom: 10 }} />
            <textarea value={reviewLearn} onChange={e => setReviewLearn(e.target.value)} placeholder="💡 Principal aprendizado" rows={2} style={{ ...inputS, resize: "none", height: 56, marginBottom: 12 }} />
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>Nota da semana</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setReviewScore(n)}
                  style={{ fontSize: 28, background: "none", border: 0, cursor: "pointer", filter: n <= reviewScore ? "none" : "grayscale(1) opacity(.3)", transition: "filter .15s" }}>⭐</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowReview(false)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button type="button" onClick={saveReview} disabled={!reviewWin.trim()}
                style={{ flex: 2, padding: 14, borderRadius: 14, border: 0, background: reviewWin.trim() ? "#7C5CFF" : "#1e1840", color: reviewWin.trim() ? "#fff" : "#9e96b5", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Salvar revisão</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan task editor ──────────────────────────── */}
      {editingPlanTask && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 380, maxHeight: "70dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>
                {(editingPlanTask as any).isStone ? `Pedra ${["I","II","III"][planEditStoneRank - 1]}` : "Editar tarefa"}
              </h3>
              <button type="button" onClick={() => setEditingPlanTask(null)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {/* Title */}
            <input value={planEditTitle} onChange={e => setPlanEditTitle(e.target.value)}
              placeholder="Título" autoFocus
              style={{...inputS, marginBottom: 10, width: "100%", boxSizing: "border-box"}} />

            {/* Day */}
            <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4, display: "block" }}>Dia {planEditDay === -1 && <span style={{ color: "#A78BFA" }}>· Em aberto</span>}</label>
            <div style={{ display: "flex", gap: 2, marginBottom: planShowMore ? 10 : 16 }}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label, i) => (
                <button key={i} type="button" onClick={() => setPlanEditDay(planEditDay === i ? -1 : i)}
                  style={{ flex: 1, padding: "5px 2px", borderRadius: 8, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 600,
                    background: planEditDay === i ? "#7C5CFF" : "rgba(167,139,250,0.08)", color: planEditDay === i ? "#fff" : "#9e96b5" }}>{label}</button>
              ))}
            </div>

            {/* More options toggle */}
            <button type="button" onClick={() => setPlanShowMore(!planShowMore)}
              style={{ width: "100%", padding: "8px 0", borderRadius: 10, border: 0, cursor: "pointer", background: planShowMore ? "rgba(124,92,255,0.08)" : "transparent", color: "#9e96b5", fontSize: 11, fontWeight: 600, fontFamily: "inherit", marginBottom: planShowMore ? 10 : 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {planShowMore ? "▲" : "▼"} Mais opções
            </button>

            {planShowMore && (
              <>
                {/* Area */}
                <p style={{ fontSize: 10, color: "#9e96b5", margin: "0 0 4px" }}>Área</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3, marginBottom: 10 }}>
                  {ALL_AREAS.filter(a => a !== "outros").map(a => {
                    const area = AREA_CONFIG[a];
                    return (
                    <button key={a} type="button" onClick={() => setPlanEditArea(a)}
                      style={{ padding: "6px 4px", borderRadius: 8, border: planEditArea === a ? "1.5px solid #7C5CFF" : "1px solid rgba(167,139,250,0.12)", background: planEditArea === a ? "rgba(124,92,255,0.1)" : "#0B0B10", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: 12 }}>{area?.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: planEditArea === a ? "#A78BFA" : "#9e96b5" }}>{(AREA_LABELS as Record<string, string>)[a] || a}</span>
                    </button>
                    );
                  })}
                </div>

                {/* Type */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <button type="button" onClick={() => setPlanEditType("manutencao")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: planEditType === "manutencao" ? "1.5px solid #7C5CFF" : "1px solid rgba(167,139,250,0.12)", background: planEditType === "manutencao" ? "rgba(124,92,255,0.1)" : "transparent", cursor: "pointer", color: planEditType === "manutencao" ? "#A78BFA" : "#9e96b5", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>↻ Hábito</button>
                  <button type="button" onClick={() => setPlanEditType("crescimento")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: planEditType === "crescimento" ? "1.5px solid #7C5CFF" : "1px solid rgba(167,139,250,0.12)", background: planEditType === "crescimento" ? "rgba(124,92,255,0.1)" : "transparent", cursor: "pointer", color: planEditType === "crescimento" ? "#A78BFA" : "#9e96b5", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>↑ Crescer</button>
                </div>

                {/* Definir como pedra da semana */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                  <input type="checkbox" checked={planEditStone} onChange={e => setPlanEditStone(e.target.checked)}
                    style={{ accentColor: "#7C5CFF", width: 16, height: 16 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e0d6ff" }}>Definir como pedra da semana</span>
                </label>
                {planEditStone && (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {([1,2,3] as const).map(n => {
                        const occ = n === 1 ? (currentPlan?.main_focus ?? "") : n === 2 ? (currentPlan?.main_focus_2 ?? "") : (currentPlan?.main_focus_3 ?? "");
                        const isOcc = !!occ;
                        return (
                          <button key={n} type="button" onClick={() => setPlanEditStoneRank(n)}
                            style={{
                              flex: 1, padding: "6px 0", borderRadius: 8, border: 0, cursor: "pointer",
                              fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                              background: planEditStoneRank === n ? "#7C5CFF" : "rgba(167,139,250,0.08)",
                              color: planEditStoneRank === n ? "#fff" : "#9e96b5",
                              opacity: isOcc && planEditStoneRank !== n ? 0.5 : 1,
                            }}>
                            {["I","II","III"][n-1]}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const occ = planEditStoneRank === 1 ? (currentPlan?.main_focus ?? "") : planEditStoneRank === 2 ? (currentPlan?.main_focus_2 ?? "") : (currentPlan?.main_focus_3 ?? "");
                      if (!occ) return null;
                      return (
                        <p style={{ margin: "0 0 8px", fontSize: 10, color: "#FF9F43", textAlign: "center" }}>
                          ⚠️ Substituirá "{String(occ).slice(0, 40)}"
                        </p>
                      );
                    })()}
                  </>
                )}

                {/* Time */}
                {planEditTime ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#0B0B10", border: "1px solid rgba(167,139,250,0.2)" }}>
                      <span style={{ fontSize: 11 }}>🕐</span>
                      <input type="time" value={planEditTime} onChange={e => setPlanEditTime(e.target.value)}
                        style={{ flex: 1, background: "transparent", border: 0, color: "#A78BFA", fontSize: 12, fontWeight: 600, fontFamily: "inherit", outline: "none" }} />
                    </div>
                    <button type="button" onClick={() => setPlanEditTime("")}
                      style={{ padding: "6px", borderRadius: 9999, border: 0, background: "rgba(167,139,250,0.1)", color: "#9e96b5", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPlanEditTime("09:00")}
                    style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px dashed rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
                    🕐 Adicionar horário
                  </button>
                )}
              </>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={async () => {
                if ((editingPlanTask as any).isStone) {
                  if (!confirm("Remover esta pedra?")) return;
                  const rank = planEditStoneRank;
                  const stoneField = rank === 1 ? "main_focus" : rank === 2 ? "main_focus_2" : "main_focus_3";
                  if (!currentPlan) return;
                  const res = await fetch(`/api/weekly-plans/${currentPlan.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [stoneField]: null }),
                  });
                  if (res.ok) {
                    await fetchPlan();
                    setEditingPlanTask(null);
                  }
                } else {
                  if (!confirm("Excluir esta tarefa?")) return;
                  await fetch(`/api/weekly-plans/tasks/${editingPlanTask.id}`, { method: "DELETE" });
                  setTasks((prev: any[]) => prev.filter((t: any) => t.id !== editingPlanTask.id));
                  setEditingPlanTask(null);
                }
              }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: 0, background: "rgba(255,92,92,0.1)", color: "#FF5C5C", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                🗑 Excluir
              </button>
              <button type="button" onClick={async () => {
                if ((editingPlanTask as any).isStone) {
                  // Save as stone (plan API)
                  const rank = planEditStoneRank;
                  const stoneField = rank === 1 ? "main_focus" : rank === 2 ? "main_focus_2" : "main_focus_3";
                  if (!currentPlan) return;
                  const res = await fetch(`/api/weekly-plans/${currentPlan.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [stoneField]: planEditTitle.trim() || null }),
                  });
                  if (res.ok) {
                    await fetchPlan();
                    setEditingPlanTask(null);
                  }
                } else {
                  // Save as task (task API)
                  const updates: Record<string, unknown> = {
                    title: planEditTitle.trim() || editingPlanTask.title,
                    day_of_week: planEditDay === -1 ? null : planEditDay,
                    area: planEditArea,
                    task_type: planEditType,
                    scheduled_time: planEditTime || null,
                  };
                  const res = await fetch(`/api/weekly-plans/tasks/${editingPlanTask.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                  });
                  if (res.ok) {
                    const updated = await res.json();
                    setTasks((prev: any[]) => prev.map((t: any) => t.id === editingPlanTask.id ? updated : t));
                  }
                  // If marked as stone, update the weekly plan
                  if (planEditStone) {
                    const stoneField = planEditStoneRank === 1 ? "main_focus" : planEditStoneRank === 2 ? "main_focus_2" : "main_focus_3";
                    await fetch("/api/weekly-plans", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ [stoneField]: planEditTitle.trim(), week_start: currentWeekStart }),
                    });
                    fetchPlan(); // Refresh to show updated stones
                  }
                  setEditingPlanTask(null);
                }
              }}
                style={{ flex: 2, padding: "12px 0", borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stone editor modal ─────────────────────────── */}
      {/* ── Stone editor modal ─────────────────────────── */}
      {showStoneEditor && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflow: "hidden" }}>
          <div style={{ width: "100%", maxWidth: 380, maxHeight: "70dvh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Pedra {["I","II","III"][editingStoneIndex]}</h3>
              <button type="button" onClick={() => setShowStoneEditor(false)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {/* Editable fields for the clicked stone */}
            {(() => {
              const n = editingStoneIndex + 1;
              const val = n === 1 ? stone1 : n === 2 ? stone2 : stone3;
              const setVal = n === 1 ? setStone1 : n === 2 ? setStone2 : setStone3;
              return (
                <input value={val} onChange={e => setVal(e.target.value)}
                  placeholder={`Pedra ${["I","II","III"][editingStoneIndex]}`} autoFocus
                  style={{...inputS, marginBottom: 16, width: "100%", boxSizing: "border-box"}} />
              );
            })()}

            {/* Show other stones compactly */}
            <div style={{ marginBottom: 16 }}>
              {[0,1,2].filter(i => i !== editingStoneIndex).map(i => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#5a5470", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 2 }}>
                    {["I","II","III"][i]}
                  </label>
                  <input value={i === 0 ? stone1 : i === 1 ? stone2 : stone3}
                    onChange={e => (i === 0 ? setStone1 : i === 1 ? setStone2 : setStone3)(e.target.value)}
                    placeholder={`Pedra ${["I","II","III"][i]}`}
                    style={{...inputS, width: "100%", boxSizing: "border-box", fontSize: 12, padding: "8px 10px"}} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowStoneEditor(false)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button type="button" onClick={async () => {
                if (currentPlan?.id) {
                  // Existing plan — PATCH
                  const res = await fetch(`/api/weekly-plans/${currentPlan.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      main_focus: stone1.trim() || null,
                      main_focus_2: stone2.trim() || null,
                      main_focus_3: stone3.trim() || null,
                    }),
                  });
                  if (res.ok) {
                    await fetchPlan();
                    setShowStoneEditor(false);
                  }
                } else {
                  // No plan yet (future week) — POST
                  const res = await fetch("/api/weekly-plans", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      week_start: currentWeekStart,
                      main_focus: stone1.trim() || "",
                      main_focus_2: stone2.trim() || "",
                      main_focus_3: stone3.trim() || "",
                    }),
                  });
                  if (res.ok) {
                    await fetchPlan();
                    setShowStoneEditor(false);
                    toast.success("Pedras definidas!");
                  }
                }
              }}
                style={{ flex: 2, padding: 14, borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </>
      )}
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", color: "#e0d6ff", fontSize: 14,
  fontFamily: "inherit", outline: "none",
};
