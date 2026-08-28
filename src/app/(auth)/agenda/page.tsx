"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Calendar, Sun, List,
  CheckCircle2, GripVertical, Plus, Clock, Star, Zap, Leaf, AlertCircle, Target,
} from "lucide-react";
import { getLocalDate } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { isRepeatingItem, repeatMatches, dedupeByDateTitle, occKey, seriesDeleteParams } from "@/lib/agenda-repeat";
import { AREA_CONFIG, AREA_LABELS } from "@/lib/planejamento-constants";
import type { AgendaItem, EisenhowerPriority, TaskArea } from "@/types";
import { MetasPanel } from "@/components/MetasPanel";
import { PlanejamentoPanel } from "@/components/PlanejamentoPanel";
import { GoalDetailSheet } from "@/components/GoalDetailSheet";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${d.toLocaleDateString("pt-BR", { month: "long" })}`;
}

function weekRangeLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return `${mon.getDate()} de ${mon.toLocaleDateString("pt-BR", { month: "long" })} – ${sun.getDate()} de ${sun.toLocaleDateString("pt-BR", { month: "long" })}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITY_CONFIG: Record<EisenhowerPriority, { icon: typeof AlertCircle; color: string; label: string; shortLabel: string }> = {
  importante_urgente:          { icon: AlertCircle, color: "#FF4D4D", label: "Urgente e importante", shortLabel: "Crítico" },
  importante_nao_urgente:      { icon: Star, color: "#FF9F43", label: "Importante, não urgente", shortLabel: "Importante" },
  nao_importante_urgente:      { icon: Zap,  color: "#FFD43B", label: "Urgente, não importante", shortLabel: "Delegar" },
  nao_importante_nao_urgente:  { icon: Leaf, color: "#4CD97B", label: "Nem urgente, nem importante", shortLabel: "Depois" },
};

// ── PriorityBadge ────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: EisenhowerPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, color: cfg.color,
      whiteSpace: "nowrap",
    }}>
      <Icon size={10} /> {cfg.shortLabel}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────

type ViewMode = "dia" | "semana" | "lista" | "metas";
type ActiveModule = "agenda" | "metas" | "planejamento";

function parseTab(raw: string | null): ViewMode {
  if (raw === "semana" || raw === "metas" || raw === "lista") return raw;
  return "dia";
}

function tabToModule(tab: ViewMode): ActiveModule {
  if (tab === "semana") return "planejamento";
  if (tab === "metas") return "metas";
  return "agenda";
}

export default function AgendaPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0B0B10" }} />}>
      <AgendaPage />
    </Suspense>
  );
}

function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab = parseTab(rawTab);

  const today = getLocalDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);
  const [activeModule, setActiveModule] = useState<ActiveModule>(tabToModule(initialTab));

  // Sync when URL param changes (client-side navigation reuses component)
  useEffect(() => {
    const tab = parseTab(rawTab);
    setViewMode(tab);
    setActiveModule(tabToModule(tab));
  }, [rawTab]);

  // Sync: segmented control ↔ module
  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setActiveModule(tabToModule(mode));
    const url = new URL(window.location.href);
    if (mode === "dia") url.searchParams.delete("tab");
    else url.searchParams.set("tab", mode);
    window.history.replaceState({}, "", url.toString());
    // Refresh data when switching views (garante que criações em qualquer aba apareçam sem F5)
    if (mode === "dia" || mode === "semana" || mode === "lista") {
      fetchItems(selectedDate);
      refreshWeekData(selectedDate);
    }
  };
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemType, setNewItemType] = useState<"compromisso" | "tarefa">("tarefa");
  const [allWeekTasks, setAllWeekTasks] = useState<any[]>([]);
  const [tasksOpen, setTasksOpen] = useState(true); // open by default, user can collapse
  const [editingPlanTask, setEditingPlanTask] = useState<any>(null);
  const [planEditTitle, setPlanEditTitle] = useState("");
  const [planEditDay, setPlanEditDay] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeAnim, setSwipeAnim] = useState<{ dir: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; okLabel?: string; cancelLabel?: string; okColor?: string; onOk: () => void; onCancel?: () => void } | null>(null);
  const showConfirm = (message: string, onOk: () => void, opts?: { okLabel?: string; cancelLabel?: string; okColor?: string; onCancel?: () => void }) =>
    setConfirmDialog({ message, onOk, ...opts });
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<AgendaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDone, setEditDone] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editPriority, setEditPriority] = useState<EisenhowerPriority>("importante_nao_urgente");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [newPriority, setNewPriority] = useState<EisenhowerPriority>("importante_nao_urgente");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState("#7C5CFF");
  const [newArea, setNewArea] = useState<TaskArea | "">("");
  const [newRepeat, setNewRepeat] = useState("none");
  const [newNotify, setNewNotify] = useState<number | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [newLinkedGoalId, setNewLinkedGoalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [weekPedras, setWeekPedras] = useState<{ id: string; title: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null); // non-null = editing existing item
  const [editingIsRepeat, setEditingIsRepeat] = useState(false); // true if editing a repeated occurrence

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);

    const body: Record<string, unknown> = {
      title: newTitle.trim(),
      item_type: newItemType,
      date: newDate || selectedDate,
      start_time: newItemType === "compromisso" ? newStartTime : null,
      end_time: newItemType === "compromisso" ? newEndTime : null,
      priority: newPriority,
      emoji: newEmoji || null,
      area: newArea || null,
      description: newDescription || null,
      color: newColor,
      repeat_type: newRepeat,
      notify_minutes: newNotify,
      due_date: newDueDate || null,
      linked_goal_id: newLinkedGoalId || null,
    };

    if (editingId && editingIsRepeat) {
      // Editing a repeated occurrence — ask: this one or all?
      const applyAll = confirm("Aplicar alterações a TODOS os compromissos desta repetição?\n\nOK = Todos\nCancelar = Apenas este");
      if (applyAll) {
        body.id = editingId;
      } else {
        // Create a standalone copy for this date
        delete body.id;
      }
    } else if (editingId) {
      body.id = editingId;
    }

    const method = body.id ? "PATCH" : "POST";
    const res = await fetch("/api/agenda", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved = await res.json();
      if (editingId) {
        setItems(prev => prev.map(i => i.id === editingId ? saved : i));
      } else {
        setItems(prev => [...prev, saved]);
      }
      closeNewItemModal();
    }
    setSaving(false);
  };

  const closeNewItemModal = () => {
    setShowNewItem(false);
    setEditingId(null);
    setEditingIsRepeat(false);
    setNewTitle(""); setNewEmoji(""); setNewPriority("importante_nao_urgente");
    setNewStartTime("09:00"); setNewEndTime("10:00");
    setNewDescription(""); setNewColor("#7C5CFF"); setNewArea("");
    setNewRepeat("none"); setNewNotify(null); setNewDueDate(""); setNewLinkedGoalId("");
  };

  const openEditor = (item: AgendaItem) => {
    setNewItemType(item.item_type as "compromisso" | "tarefa");
    setNewTitle(item.title);
    setNewDate(item.date || selectedDate);
    setNewEmoji(item.emoji || "");
    setNewPriority(item.priority as EisenhowerPriority);
    setNewStartTime(item.start_time?.slice(0, 5) || "09:00");
    setNewEndTime(item.end_time?.slice(0, 5) || "10:00");
    setNewDescription(item.description || "");
    setNewColor(item.color || "#7C5CFF");
    setNewArea((item.area as TaskArea) || "");
    setNewRepeat(item.repeat_type || "none");
    setNewNotify(item.notify_minutes ?? null);
    setNewDueDate(item.due_date || "");
    setNewLinkedGoalId(item.linked_goal_id || "");
    setEditingId(realId(item));
    setEditingIsRepeat(item.id.includes("_r_") || item.id.includes("_cross"));
    setEditingItem(null);
    setShowNewItem(true);
  };

  const fetchItems = useCallback(async (date: string) => {
    setLoading(true);
    try {
      // Fetch a window around the selected date to catch repeats and midnight-crossings
      const from = shiftDate(date, -30);
      const to = shiftDate(date, 30);
      const res = await fetch(`/api/agenda?from=${from}&to=${to}`);
      if (!res.ok) { setItems([]); setLoading(false); return; }
      const all: AgendaItem[] = await res.json();
      if (!Array.isArray(all)) { setItems([]); setLoading(false); return; }

      // ── Build result: items that belong to `date` ──
      const result: AgendaItem[] = [];

      // Track which (date, title, horários) combos already exist as real items.
      // Ocorrências avulsas (concluídas/excluídas) sombreiam a regra de repetição na mesma data.
      // `exactOccKeys` usa horários (dois compromissos de mesmo título em horas diferentes
      // são distintos); `exactTitleKeys` (só data+título) é para o crossing de meia-noite.
      const exactOccKeys = new Set<string>();
      const exactTitleKeys = new Set<string>();
      const exactItems: AgendaItem[] = [];
      for (const item of all) {
        // Exact date match
        if (item.date === date) {
          exactItems.push(item);
          exactOccKeys.add(occKey(item));
          exactTitleKeys.add(item.date + "|" + item.title.toLowerCase().trim());
          continue;
        }
      }
      for (const item of dedupeByDateTitle(exactItems)) {
        if (item.excluded) continue; // ocorrência excluída não aparece
        result.push(item);
      }

      for (const item of all) {
        // Skip if already processed as exact match
        if (item.date === date) continue;
        // Repeating item
        if (repeatMatches(item, date)) {
          const key = occKey({ date, title: item.title, start_time: item.start_time, end_time: item.end_time });
          // Skip if a standalone item already exists for this date+title+horários
          if (exactOccKeys.has(key)) continue;
          result.push({ ...item, date, id: item.id + "_r_" + date, _origId: item.id } as AgendaItem & { _origId?: string });
        }
      }

      // ── Midnight-crossing: items from YESTERDAY that cross into today ──
      const yesterday = shiftDate(date, -1);
      // Collect ALL items that appeared yesterday (real + synthetic repeats)
      const yesterdayCrossItems: AgendaItem[] = [];
      for (const item of all) {
        // Real item on yesterday
        if (item.date === yesterday && item.item_type === "compromisso" && item.start_time && item.end_time) {
          yesterdayCrossItems.push(item);
        }
        // Repeating item that would appear on yesterday
        if (item.repeat_type && item.repeat_type !== "none" && item.item_type === "compromisso" && item.start_time && item.end_time) {
          if (repeatMatches(item, yesterday)) {
            yesterdayCrossItems.push({ ...item, date: yesterday });
          }
        }
      }
      for (const item of yesterdayCrossItems) {
        const [sh, sm] = (item.start_time || "00:00").split(":").map(Number);
        const [eh, em] = (item.end_time || "00:00").split(":").map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
          const crossKey = date + "|" + item.title.toLowerCase().trim();
          if (!exactTitleKeys.has(crossKey)) {
            result.push({
              ...item,
              date,
              id: (item as any)._origId ? (item as any)._origId + "_cross" : item.id + "_cross",
              start_time: "00:00",
              _origId: (item as any)._origId || item.id,
            } as any);
          }
        }
      }

      // Sort: compromissos by start_time, then tarefas
      result.sort((a, b) => {
        if (a.item_type !== b.item_type) return a.item_type === "compromisso" ? -1 : 1;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });

      setItems(result);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(selectedDate); }, [selectedDate, fetchItems]);

  // Fetch weekly plan tasks + goals + pedras for the current week
  const refreshWeekData = useCallback(async (date: string) => {
    setWeekLoading(true);
    try {
      const [, goalsData] = await Promise.all([
        // Fetch current + 3 past weeks for overdue/open detection
        (async () => {
          const allTasks: any[] = [];
          for (let offset = 0; offset <= 3; offset++) {
            const mon = new Date(date + "T12:00:00");
            mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - (offset * 7));
            const ws = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
            try {
              const res = await fetch(`/api/weekly-plans?week=${ws}`);
              if (res.ok) {
                const data = await res.json();
                if (data.current?.weekly_tasks) {
                  allTasks.push(...data.current.weekly_tasks.map((t: any) => ({ ...t, _weekStart: ws })));
                }
              }
            } catch {}
          }
          setAllWeekTasks(allTasks);
          return allTasks;
        })(),
        fetch("/api/goals").then(r => r.json()).catch(() => []),
      ]);
      if (Array.isArray(goalsData)) {
        setActiveGoals(goalsData.filter((g: any) => g.status === "ativa"));
      }
    } catch { /* silent */ }
    setWeekLoading(false);
  }, []);

  useEffect(() => { refreshWeekData(selectedDate); }, [selectedDate, refreshWeekData]);

  // Weekly plan tasks filtered for the selected day
  const selectedDayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    return d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Mon ... 6=Sun
  }, [selectedDate]);

  // Monday (YYYY-MM-DD) of the week containing selectedDate
  const selectedWeekMonday = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }, [selectedDate]);

  const dayPlanTasks = useMemo(() =>
    allWeekTasks.filter((t: any) =>
      t.day_of_week === selectedDayOfWeek &&
      t._weekStart === selectedWeekMonday &&
      t.status !== "pulada"
    ),
  [allWeekTasks, selectedDayOfWeek, selectedWeekMonday]);

  // Lock body scroll when popup is open
  useEffect(() => {
    if (showNewItem || editingItem || editingPlanTask) {
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
  }, [showNewItem, editingItem, editingPlanTask]);

  const compromissos = useMemo(() =>
    items.filter(i => i.item_type === "compromisso").sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
  [items]);

  const tarefas = useMemo(() =>
    items.filter(i => i.item_type === "tarefa"),
  [items]);

  const tarefasSemHorario = tarefas.filter(t => !t.start_time);
  const tarefasComHorario = tarefas.filter(t => t.start_time);

  // Pending task count for the day — used to control the collapsible strip
  const totalPendingTasks = useMemo(() => {
    const planPending = dayPlanTasks.filter((t: any) => t.status !== "concluida").length;
    return tarefasSemHorario.filter(t => t.status !== "concluida").length + planPending;
  }, [tarefasSemHorario, dayPlanTasks]);

  // Auto-collapse the task strip when there are no pending tasks
  useEffect(() => {
    if (totalPendingTasks === 0) setTasksOpen(false);
  }, [totalPendingTasks]);

  // Map weekly plan tasks with scheduled_time into agenda-like items for the timeline
  const planTasksAsAgenda = useMemo(() => {
    return dayPlanTasks
      .filter((t: any) => t.scheduled_time)
      .map((t: any, idx: number) => ({
        id: `wp_${t.id}`,
        title: t.title,
        item_type: "tarefa",
        date: selectedDate,
        start_time: t.scheduled_time,
        end_time: null,
        priority: "importante_nao_urgente" as EisenhowerPriority,
        emoji: null,
        color: null,
        status: t.status === "concluida" ? "concluida" : "pendente",
        description: null,
        repeat_type: "none",
        notify_minutes: null,
        due_date: null,
        linked_goal_id: t.linked_goal_id,
        linked_weekly_task_id: t.id,
        position: idx,
        _isWeeklyTask: true,
      } as unknown as AgendaItem));
  }, [dayPlanTasks, selectedDate]);

  // All timeline items (compromissos + tarefas with time + weekly plan tasks)
  const timelineItems = useMemo(() =>
    [...compromissos, ...tarefasComHorario, ...planTasksAsAgenda].sort((a, b) =>
      (a.start_time || "").localeCompare(b.start_time || "")
    ),
  [compromissos, tarefasComHorario, planTasksAsAgenda]);

  // ── Overlap detection: assign columns to simultaneous events ──
  const timelineColumns = useMemo(() => {
    if (!timelineItems || timelineItems.length === 0) return [];
    const result: { item: AgendaItem; column: number; total: number }[] = [];
    const toMins = (t: string | null) => {
      if (!t || !t.includes(":")) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    for (const item of timelineItems) {
      const istart = toMins(item.start_time);
      const iend = item.end_time && toMins(item.end_time) <= istart ? 24 * 60 : toMins(item.end_time) || istart + 30;

      const usedCols = new Set<number>();
      let overlapping: number[] = []; // indices of overlapping items
      for (let i = 0; i < result.length; i++) {
        const r = result[i];
        const rs = toMins(r.item.start_time);
        const re = r.item.end_time && toMins(r.item.end_time) <= rs ? 24 * 60 : toMins(r.item.end_time) || rs + 30;
        if (istart < re && rs < iend) {
          usedCols.add(r.column);
          overlapping.push(i);
        }
      }

      let col = 0;
      while (usedCols.has(col)) col++;
      const overlapTotals = overlapping.map(i => result[i].total);
      const total = Math.max(col + 1, overlapTotals.length > 0 ? Math.max(...overlapTotals) : 1);

      // Update all overlapping events to have the same total
      for (const i of overlapping) {
        if (result[i].total < total) result[i] = { ...result[i], total };
      }

      result.push({ item, column: col, total });
    }
    return result;
  }, [timelineItems]);

  /** Get the real DB id (handles synthetic repeated/crossed items) */
  const realId = (item: AgendaItem) => (item as any)._origId || item.id;

  const toggleTask = async (item: AgendaItem, coords?: { x: number; y: number }) => {
    const newStatus = item.status === "concluida" ? "pendente" : "concluida";
    if (newStatus === "concluida") celebrate(coords?.x, coords?.y);
    // Ocorrência avulsa (repetida ou continuação pós-meia-noite) nunca altera a
    // regra original — cria um registro standalone só para esta data.
    const isSynthetic = item.id.includes("_r_") || item.id.includes("_cross");
    const isRepeating = isRepeatingItem(item);

    if (isRepeating || isSynthetic) {
      if (newStatus === "pendente") {
        // Desmarcar: remove a ocorrência avulsa (concluída) — o item volta ao
        // "pendente" da série, sem acumular registros concorrentes.
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "pendente" } : i));
        const params = new URLSearchParams({ title: item.title, date: item.date });
        if (item.start_time) params.set("start_time", item.start_time);
        if (item.end_time) params.set("end_time", item.end_time);
        const res = await fetch(`/api/agenda?scope=occurrence&${params.toString()}`, { method: "DELETE" });
        if (res.ok) {
          // Refetch to get clean data instead of manually patching state
          fetchItems(selectedDate);
        } else {
          // Revert on failure so the UI doesn't show a state that wasn't saved.
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "concluida" } : i));
        }
      } else {
        // Concluir: marca o círculo otimista e cria um registro standalone
        // (status concluída) só para esta ocorrência.
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
        const res = await fetch("/api/agenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            item_type: item.item_type,
            date: item.date,
            start_time: item.start_time,
            end_time: item.end_time,
            priority: item.priority,
            emoji: item.emoji || null,
            description: item.description || null,
            color: item.color || null,
            area: item.area || null,
            repeat_type: "none",
            status: newStatus,
          }),
        });
        if (res.ok) {
          // Refetch to get clean data instead of manually patching state
          fetchItems(selectedDate);
        } else {
          // Revert on failure so the UI doesn't show a state that wasn't saved.
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i));
        }
      }
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      await fetch("/api/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: realId(item), status: newStatus }),
      });
    }
  };

  // ── Exclusão de compromissos repetidos (3 opções) ──────────────
  const deleteThisOccurrence = async (item: AgendaItem) => {
    // Exclui apenas esta ocorrência: cria uma avulsa marcada como excluída.
    await fetch("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        item_type: item.item_type,
        date: item.date,
        start_time: item.start_time,
        end_time: item.end_time,
        priority: item.priority,
        emoji: item.emoji || null,
        description: item.description || null,
        color: item.color || null,
        area: item.area || null,
        repeat_type: "none",
        excluded: true,
      }),
    });
    setDeleteDialog(null); setEditingItem(null); fetchItems(selectedDate);
  };

  const deleteThisAndFuture = async (item: AgendaItem) => {
    const isOriginal = !(item.id.includes("_r_") || item.id.includes("_cross"));
    if (isOriginal) {
      // Ocorrência original: "daqui em diante" equivale a excluir tudo.
      await fetch(`/api/agenda?id=${realId(item)}&scope=all&${seriesDeleteParams(item)}`, { method: "DELETE" });
    } else {
      // Corta a série um dia antes desta ocorrência, preservando o passado.
      const prev = shiftDate(item.date, -1);
      await fetch("/api/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: realId(item), repeat_until: prev }),
      });
    }
    setDeleteDialog(null); setEditingItem(null); fetchItems(selectedDate);
  };

  const deleteAllOccurrences = async (item: AgendaItem) => {
    await fetch(`/api/agenda?id=${realId(item)}&scope=all&${seriesDeleteParams(item)}`, { method: "DELETE" });
    setDeleteDialog(null); setEditingItem(null); fetchItems(selectedDate);
  };

  // ── Timeline calculations ──────────────────────────────────────
  const TIMELINE_START = 0;  // 00:00
  const TIMELINE_END = 24;   // 00:00 (midnight)
  const TOTAL_MINUTES = (TIMELINE_END - TIMELINE_START) * 60;
  const SLOT_MINUTES = 30; // 30-min slots
  const TOTAL_SLOTS = TOTAL_MINUTES / SLOT_MINUTES; // 48 slots
  const SLOT_PX = 24; // pixel height per 30-min slot
  const TRACK_HEIGHT = TOTAL_SLOTS * SLOT_PX; // 1152px

  // ── Smart scroll: snap to 2h before current time ────────────
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!timelineScrollRef.current) return;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    // Scroll to 2 hours before current time, but never before 06:00
    const targetMins = Math.max(6 * 60, currentMins - 120);
    const px = (targetMins / SLOT_MINUTES) * SLOT_PX;
    timelineScrollRef.current.scrollTop = Math.max(0, px - 60);
  }, []);

  /** Convert HH:MM to pixel offset from top of track */
  const timeToPx = (time: string): number => {
    if (!time || !time.includes(":")) return 0;
    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return ((h * 60 + m) / SLOT_MINUTES) * SLOT_PX;
  };

  /** Calculate event height in px. Handles midnight-crossing (clamped to end of day). */
  const eventHeightPx = (start: string, end: string): number => {
    const startPx = timeToPx(start);
    let endPx = timeToPx(end);
    // Crosses midnight? Clamp to end of day
    if (endPx <= startPx) endPx = TRACK_HEIGHT;
    const h = endPx - startPx;
    return Math.max(SLOT_PX, h); // minimum 1 slot
  };

  // Current time needle
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const currentTimePx = now
    ? timeToPx(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
    : -1;

  const HALF_HOUR_LABELS = Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
    const totalMins = (TIMELINE_START * 60) + i * SLOT_MINUTES;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  return (
    <div style={{ minHeight: "100dvh", background: "#0B0B10", paddingBottom: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px", width: "100%", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

        {/* ── Title + Date navigation ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#e0d6ff", letterSpacing: "-0.02em" }}>
              {viewMode === "metas" ? "Metas" : viewMode === "semana" ? "Agenda da semana" : viewMode === "lista" ? "Lista" : "Agenda do dia"}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#A78BFA", fontWeight: 500 }}>
              {viewMode === "metas" ? "Acompanhe seu progresso" : viewMode === "semana" ? weekRangeLabel(selectedDate) : formatDateLabel(selectedDate)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedDate !== today && (
              <button type="button" onClick={() => setSelectedDate(today)}
                style={{ ...navBtnStyle, width: "auto", padding: "0 14px", fontSize: 12, fontWeight: 600 }}>
                Hoje
              </button>
            )}
            <button type="button"
              onClick={() => {
                const days = activeModule === "planejamento" ? -7 : -1;
                setSelectedDate(shiftDate(selectedDate, days));
              }}
              style={navBtnStyle}><ChevronLeft size={18} /></button>
            <button type="button"
              onClick={() => {
                const days = activeModule === "planejamento" ? 7 : 1;
                setSelectedDate(shiftDate(selectedDate, days));
              }}
              style={navBtnStyle}><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* ── Segmented control Dia/Semana/Lista/Metas ──────────── */}
        <div style={{
          display: "flex", borderRadius: 14, background: "#1a1530",
          border: "1px solid rgba(167,139,250,0.15)", padding: 3,
          marginBottom: viewMode === "lista" ? 12 : 16,
        }}>
          {([
            { key: "dia", icon: Sun, label: "Dia" },
            { key: "semana", icon: Calendar, label: "Semana" },
            { key: "metas", icon: Target, label: "Metas" },
            { key: "lista", icon: List, label: "Lista" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} type="button" onClick={() => switchView(key)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: 0,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 5, fontFamily: "inherit",
                fontSize: 12, fontWeight: 600,
                background: viewMode === key
                  ? "linear-gradient(135deg, #7C5CFF, #A78BFA)"
                  : "transparent",
                color: viewMode === key ? "#fff" : "#9e96b5",
                transition: "all 0.2s ease",
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ── METAS VIEW ─────────────────────────────────────── */}
        {activeModule === "metas" && <MetasPanel />}

        {/* ── PLANEJAMENTO VIEW ───────────────────────────────── */}
        {activeModule === "planejamento" && <PlanejamentoPanel selectedDate={selectedDate} />}

        {/* ── TIMELINE (só agenda, view dia) ──────────────────── */}
        {activeModule === "agenda" && viewMode === "dia" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
            background: "#1a1530", borderRadius: 18,
            border: "1px solid rgba(167,139,250,0.12)",
            position: "relative", overflow: "hidden",
            opacity: swipeAnim ? 0 : 1,
            transform: swipeAnim ? `translateX(${swipeAnim.dir * 16}px)` : "translateX(0)",
            transition: swipeAnim ? "none" : "opacity 0.16s ease, transform 0.16s ease",
          }}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
              touchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              const dy = e.changedTouches[0].clientY - touchStartY.current;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                const dir = dx > 0 ? -1 : 1;
                setSwipeAnim({ dir });
                setSelectedDate(shiftDate(selectedDate, dir));
                window.setTimeout(() => setSwipeAnim(null), 220);
              }
            }}
          >
            {/* ── Collapsible task strip ── */}
            <div style={{
              background: "#1a1530", borderRadius: tasksOpen ? "18px 18px 0 0" : 0,
              borderBottom: tasksOpen ? "1px solid rgba(167,139,250,0.15)" : "1px solid rgba(167,139,250,0.06)",
              boxShadow: tasksOpen ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
              position: tasksOpen ? "absolute" : "relative",
              top: 0, left: 0, right: 0, zIndex: 10,
            }}>
                <button type="button" onClick={() => {
                  // Only allow toggling open when there are tasks
                  if (totalPendingTasks > 0 || tasksOpen) setTasksOpen(!tasksOpen);
                }} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "none", border: 0, cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>Tarefas do dia</span>
                    {totalPendingTasks > 0 && (
                      <span style={{ padding: "1px 7px", borderRadius: 9999, fontSize: 10, fontWeight: 600, background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>
                        {totalPendingTasks} pendente{totalPendingTasks !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#9e96b5", transition: "transform .2s", transform: tasksOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▴
                  </span>
                </button>
                {tasksOpen && (
                <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                  {/* Agenda tasks without time */}
                  {[...tarefasSemHorario].map((item) => {
                    const done = item.status === "concluida";
                    const priorityCfg = PRIORITY_CONFIG[item.priority as EisenhowerPriority] || PRIORITY_CONFIG.importante_nao_urgente;
                    return (
                      <button key={item.id} type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setEditTitle(item.title || "");
                          setEditEmoji(item.emoji || "");
                          setEditPriority(item.priority as EisenhowerPriority);
                          setEditDone(done);
                        }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)",
                          background: done ? "transparent" : "rgba(124,92,255,0.06)",
                          cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                          color: done ? "#5a5470" : "#e0d6ff",
                          textDecoration: done ? "line-through" : "none",
                          whiteSpace: "nowrap", maxWidth: "100%",
                        }}>
                        <span style={{ fontSize: 12, flexShrink: 0, animation: done ? "checkPop 0.3s ease" : "none" }} onClick={(e) => { e.stopPropagation(); toggleTask(item, { x: e.clientX, y: e.clientY }); }}>
                          {done ? <CheckCircle2 size={14} color="#7C5CFF" /> : <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(167,139,250,0.3)" }} />}
                        </span>
                        {item.emoji && <span style={{ flexShrink: 0 }}>{item.emoji}</span>}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{item.title}</span>
                      </button>
                    );
                  })}
                  {/* Weekly plan tasks */}
                  {dayPlanTasks.map((t: any) => {
                    const done = t.status === "concluida";
                    const areaEmoji = (AREA_CONFIG_PT as any)[t.area]?.emoji || "⚪";
                    return (
                      <button key={`plan-${t.id}`} type="button"
                        onClick={() => {
                          setEditingPlanTask(t);
                          setPlanEditTitle(t.title || "");
                          setPlanEditDay(t.day_of_week ?? 0);
                        }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.15)",
                          background: done ? "transparent" : "rgba(167,139,250,0.04)",
                          cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                          color: done ? "#5a5470" : "#9e96b5",
                          textDecoration: done ? "line-through" : "none",
                          whiteSpace: "nowrap", maxWidth: "100%",
                        }}>
                        <span onClick={async (e) => {
                          e.stopPropagation();
                          const newStatus = done ? "pendente" : "concluida";
                          if (newStatus === "concluida") celebrate(e.clientX, e.clientY);
                          setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === t.id ? { ...wt, status: newStatus } : wt));
                          await fetch(`/api/weekly-plans/tasks/${t.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: newStatus }),
                          });
                        }} style={{ fontSize: 11, cursor: "pointer", display: "flex", flexShrink: 0, animation: done ? "checkPop 0.3s ease" : "none" }}>
                          {done ? <CheckCircle2 size={13} color="#7C5CFF" /> : <div style={{ width: 13, height: 13, borderRadius: "50%", border: "1.5px solid rgba(167,139,250,0.2)" }} />}
                        </span>
                        <span style={{ flexShrink: 0 }}>{areaEmoji}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.title}</span>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>

            <div ref={timelineScrollRef} style={{
              display: "flex", flex: 1, minHeight: 0,
              overflowY: "auto", overflowX: "hidden",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}>
              {/* Time labels */}
              <div style={{ width: 52, flexShrink: 0, paddingLeft: 6 }}>
                {HALF_HOUR_LABELS.filter((_, i) => i % 2 === 0).map((label, idx) => {
                  const h = idx;
                  return (
                    <button key={label} type="button"
                      onClick={() => {
                        setNewItemType("compromisso");
                        setNewStartTime(`${String(h).padStart(2, "0")}:00`);
                        setNewEndTime(`${String(h + 1).padStart(2, "0")}:00`);
                        setNewDate(selectedDate);
                        setShowNewItem(true);
                      }}
                      style={{
                        height: SLOT_PX * 2, display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                        paddingRight: 8, background: "none", border: 0, cursor: "pointer",
                        fontFamily: "inherit",
                      }}>
                      <span style={{ fontSize: 11, color: "#9e96b5", lineHeight: 1 }}>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Timeline track */}
              <div style={{ flex: 1, position: "relative", height: TRACK_HEIGHT }}>
                {/* Vertical line */}
                <div style={{
                  position: "absolute", left: 0, top: 6, bottom: 6, width: 2,
                  background: "linear-gradient(to bottom, #A78BFA 0%, #7C5CFF 50%, #A78BFA 100%)",
                  borderRadius: 1,
                }} />

                {/* Clickable half-hour slots */}
                {HALF_HOUR_LABELS.slice(0, -1).map((label, idx) => (
                  <button key={idx} type="button"
                    onClick={() => {
                      const totalMins = idx * SLOT_MINUTES;
                      const h = Math.floor(totalMins / 60);
                      const m = totalMins % 60;
                      const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                      const endTotal = totalMins + SLOT_MINUTES;
                      const eh = Math.floor(endTotal / 60);
                      const em = endTotal % 60;
                      const end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
                      setNewItemType("compromisso");
                      setNewStartTime(start);
                      setNewEndTime(end);
                      setNewDate(selectedDate);
                      setShowNewItem(true);
                    }}
                    style={{
                      position: "absolute", left: 12, right: 8,
                      top: idx * SLOT_PX, height: SLOT_PX,
                      background: "transparent", border: 0, cursor: "pointer",
                    }}
                  />
                ))}

                {/* Current time needle — only on today */}
                {selectedDate === today && currentTimePx > 0 && currentTimePx < TRACK_HEIGHT && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: currentTimePx, zIndex: 5,
                    height: 2, background: "#FF4D4D",
                    boxShadow: "0 0 6px rgba(255,77,77,0.5)",
                    pointerEvents: "none",
                  }}>
                    <div style={{
                      position: "absolute", left: -5, top: -4,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#FF4D4D", boxShadow: "0 0 6px rgba(255,77,77,0.6)",
                    }} />
                  </div>
                )}

                {/* Event cards — compromissos + tarefas com horário */}
                {timelineColumns.map(({ item, column, total }) => {
                  const isTask = item.item_type === "tarefa";
                  const topPx = timeToPx(item.start_time || "07:00");
                  const heightPx = item.end_time
                    ? eventHeightPx(item.start_time || "07:00", item.end_time)
                    : SLOT_PX;
                  const crossesMidnight = item.end_time
                    ? timeToPx(item.end_time) <= timeToPx(item.start_time || "07:00")
                    : false;
                  const priorityCfg = PRIORITY_CONFIG[item.priority as EisenhowerPriority] || PRIORITY_CONFIG.importante_nao_urgente;
                  const PriorityIcon = priorityCfg.icon;
                  const short = heightPx < SLOT_PX * 1.5;       // < 45min: compact
                  const roomy = heightPx >= SLOT_PX * 2.5;      // ≥ 75min: enough space for priority
                  const done = item.status === "concluida";

                  return (
                    <button key={item.id} type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((item as any)._isWeeklyTask) {
                          // Switch to Semana tab to edit
                          switchView("semana");
                          return;
                        }
                        setEditingItem(item);
                        setEditTitle(item.title || "");
                        setEditDate(item.date || selectedDate);
                        setEditStartTime(item.start_time?.slice(0, 5) || "09:00");
                        setEditEndTime(item.end_time?.slice(0, 5) || "10:00");
                        setEditEmoji(item.emoji || "");
                        setEditPriority(item.priority as EisenhowerPriority);
                        setEditDone(done);
                      }}
                      style={{
                        position: "absolute",
                        left: total > 1 ? `calc(12px + (100% - 22px) * ${column} / ${total})` : 12,
                        width: total > 1 ? `calc((100% - 22px) / ${total} - 3px)` : `calc(100% - 20px)`,
                        zIndex: isTask ? 1 : 2,
                        top: topPx + 1,
                        height: heightPx - 2,
                        background: isTask
                          ? "rgba(167,139,250,0.04)"
                          : item.color ? `${item.color}22` : "rgba(124,92,255,0.15)",
                        borderLeft: isTask
                          ? "2px dashed rgba(167,139,250,0.25)"
                          : item.color ? `2px solid ${item.color}` : "2px solid rgba(167,139,250,0.5)",
                        borderTop: "1px solid rgba(167,139,250,0.08)",
                        borderRight: "1px solid rgba(167,139,250,0.08)",
                        borderBottom: crossesMidnight ? "2px dashed rgba(167,139,250,0.4)" : "1px solid rgba(167,139,250,0.08)",
                        borderRadius: 4, padding: short ? "2px 8px" : "4px 8px",
                        display: "flex", flexDirection: short ? "row" : "column",
                        alignItems: short ? "center" : "stretch",
                        gap: short ? 4 : 1,
                        justifyContent: "flex-start", cursor: "pointer",
                        textAlign: "left", fontFamily: "inherit",
                        overflow: "hidden",
                        boxSizing: "border-box",
                        opacity: done ? 0.5 : 1,
                      }}>
                      {/* Short mode: single-row layout */}
                      {short ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
                            <span style={{ fontSize: 8, color: isTask ? "#9e96b5" : (item.color || "#A78BFA"), flexShrink: 0, lineHeight: 1 }}>
                              {item.start_time?.slice(0, 5)}
                            </span>
                            <span style={{
                              flex: 1, minWidth: 0,
                              fontSize: 10, fontWeight: done ? 400 : 600,
                              color: done ? "#5a5470" : "#e0d6ff",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              textDecoration: done ? "line-through" : "none",
                            }}>
                              {item.emoji && <span style={{ marginRight: 2 }}>{item.emoji}</span>}
                              {item.title}
                            </span>
                          </span>
                          <span onClick={(e) => { e.stopPropagation(); toggleTask(item, { x: e.clientX, y: e.clientY }); }}
                            style={{ flexShrink: 0, cursor: "pointer", display: "flex", marginLeft: "auto", animation: done ? "checkPop 0.3s ease" : "none" }}>
                            {done
                              ? <CheckCircle2 size={12} color="#7C5CFF" />
                              : <div style={{ width: 12, height: 12, borderRadius: "50%", border: isTask ? "1.5px solid rgba(167,139,250,0.35)" : "1.5px solid rgba(167,139,250,0.2)" }} />
                            }
                          </span>
                        </div>
                      ) : (
                        /* Tall mode: stacked layout */
                        <>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 9, color: isTask ? "#9e96b5" : (item.color || "#A78BFA"), flexShrink: 0, lineHeight: 1 }}>
                              {item.start_time?.slice(0, 5)}{item.end_time ? ` – ${item.end_time.slice(0, 5)}` : ""}
                              {crossesMidnight && " ↗"}
                            </span>
                            <span onClick={(e) => { e.stopPropagation(); toggleTask(item, { x: e.clientX, y: e.clientY }); }}
                              style={{ flexShrink: 0, cursor: "pointer", display: "flex", animation: done ? "checkPop 0.3s ease" : "none" }}>
                              {done
                                ? <CheckCircle2 size={12} color="#7C5CFF" />
                                : <div style={{ width: 12, height: 12, borderRadius: "50%", border: isTask ? "1.5px solid rgba(167,139,250,0.35)" : "1.5px solid rgba(167,139,250,0.2)" }} />
                              }
                            </span>
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: done ? 400 : 600,
                            color: done ? "#5a5470" : "#e0d6ff",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textDecoration: done ? "line-through" : "none",
                            lineHeight: 1.3,
                          }}>
                            {item.emoji && <span style={{ marginRight: 3 }}>{item.emoji}</span>}
                            {item.title}
                          </span>
                          {!isTask && roomy && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8, color: priorityCfg.color, whiteSpace: "nowrap", lineHeight: 1 }}>
                              <PriorityIcon size={8} /> {priorityCfg.shortLabel}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── LISTA ───────────────────────────────────────────── */}
      {viewMode === "lista" && (
        <ListView allWeekTasks={allWeekTasks} compromissos={items} selectedDate={selectedDate} setAllWeekTasks={setAllWeekTasks} refreshItems={() => fetchItems(selectedDate)} loading={loading || weekLoading} toggleAgendaTask={toggleTask} />
      )}

      {/* ── Detail popup for compromisso ────────────────────── */}
      {editingItem && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {editingItem.color && (
                  <div style={{ width: 10, height: 40, borderRadius: 5, background: editingItem.color, flexShrink: 0 }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>
                    {editingItem.emoji && <span style={{ marginRight: 6 }}>{editingItem.emoji}</span>}
                    {editingItem.title}
                  </h3>
                  {editingItem.start_time && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#A78BFA" }}>
                      {editingItem.start_time.slice(0, 5)} – {editingItem.end_time?.slice(0, 5)}
                    </p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setEditingItem(null)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {editingItem.description && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9e96b5", lineHeight: 1.5 }}>{editingItem.description}</p>
            )}

            {editingItem.notify_minutes && (
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "#9e96b5" }}>🔔 {editingItem.notify_minutes} min antes</p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => openEditor(editingItem)}
                style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ✏️ Editar
              </button>
              <button type="button" onClick={() => {
                const isSynth = editingItem.id.includes("_r_") || editingItem.id.includes("_cross");
                const isRepeating = isRepeatingItem(editingItem);
                if (isSynth || isRepeating) {
                  setDeleteDialog(editingItem);
                } else {
                  showConfirm("Excluir este compromisso?", () => {
                    fetch(`/api/agenda?id=${realId(editingItem)}`, { method: "DELETE" }).then(() => {
                      setEditingItem(null); fetchItems(selectedDate);
                    });
                  });
                }
              }}
                style={{ flex: 1, padding: 10, borderRadius: 12, border: 0, background: "rgba(255,92,92,0.1)", color: "#FF5C5C", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                🗑 Excluir
              </button>
            </div>
            <button type="button" onClick={() => {
              setNewItemType("compromisso");
              setNewStartTime(editingItem.start_time?.slice(0,5) || "09:00");
              setNewEndTime(editingItem.end_time?.slice(0,5) || "10:00");
              setNewEmoji(editingItem.emoji || "");
              setNewPriority(editingItem.priority as EisenhowerPriority);
              setNewTitle(editingItem.title);
              setNewDate(editingItem.date || selectedDate);
              setShowNewItem(true);
              setEditingItem(null);
            }}
              style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(167,139,250,0.15)", background: "rgba(167,139,250,0.05)", color: "#9e96b5", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              📋 Duplicar
            </button>
          </div>
        </div>
      )}

      {/* ── Mini editor for weekly plan tasks ────────────────── */}
      {editingPlanTask && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ width: "100%", maxWidth: 380, background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Editar tarefa do plano</h3>
              <button type="button" onClick={() => setEditingPlanTask(null)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {/* Title */}
            <input value={planEditTitle} onChange={e => setPlanEditTitle(e.target.value)}
              placeholder="Título"
              style={{...modalInput, marginBottom: 12}} autoFocus />

            {/* Day selector */}
            <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Mover para</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label, i) => (
                <button key={i} type="button" onClick={() => setPlanEditDay(i)}
                  style={{
                    padding: "6px 10px", borderRadius: 9999, border: 0, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                    background: planEditDay === i ? "#7C5CFF" : "#1e1840",
                    color: planEditDay === i ? "#fff" : "#9e96b5",
                  }}>{label}</button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={async () => {
                if (!confirm("Excluir esta tarefa?")) return;
                await fetch(`/api/weekly-plans/tasks/${editingPlanTask.id}`, { method: "DELETE" });
                setAllWeekTasks((prev: any[]) => prev.filter((wt: any) => wt.id !== editingPlanTask.id));
                setEditingPlanTask(null);
              }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 14, border: 0, background: "rgba(255,92,92,0.1)", color: "#FF5C5C", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                🗑 Excluir
              </button>
              <button type="button" onClick={async () => {
                const updates: Record<string, unknown> = {
                  title: planEditTitle.trim() || editingPlanTask.title,
                  day_of_week: planEditDay,
                };
                const res = await fetch(`/api/weekly-plans/tasks/${editingPlanTask.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updates),
                });
                if (res.ok) {
                  const updated = await res.json();
                  setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === editingPlanTask.id ? updated : wt));
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

      {/* ── FAB (Dia) ────────────────────────────────────────── */}
      {(activeModule === "agenda" && viewMode === "dia") && (
        <button type="button" onClick={() => { setNewItemType("tarefa"); setNewDate(selectedDate); setShowNewItem(true); }}
          style={{
            position: "fixed", bottom: 84, right: 20, zIndex: 40,
            width: 56, height: 56, borderRadius: "50%",
            background: "#7C5CFF", border: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
          }}>
          <Plus size={24} color="#fff" />
        </button>
      )}

      {/* ── New Item Modal ──────────────────────────────────── */}
      {showNewItem && (
        <div
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "16px 12px", paddingTop: "max(40px, env(safe-area-inset-top))",
            overflowY: "auto", WebkitOverflowScrolling: "touch",
          }}>
          <div style={{
            width: "100%", maxWidth: 420,
            background: "#151520", borderRadius: 24,
            padding: 20, overflow: "hidden",
            border: "1px solid rgba(167,139,250,0.15)",
          }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>
              {editingId
                ? `Editar ${newItemType === "compromisso" ? "compromisso" : "tarefa"}`
                : newItemType === "compromisso" ? "Novo compromisso" : "Nova tarefa"}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9e96b5" }}>
              {formatDateLabel(selectedDate)}
            </p>

            {/* Type toggle */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button type="button" onClick={() => setNewItemType("compromisso")}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: newItemType === "compromisso" ? "#7C5CFF" : "#1a1530",
                  color: newItemType === "compromisso" ? "#fff" : "#9e96b5",
                }}>📅 Compromisso</button>
              <button type="button" onClick={() => setNewItemType("tarefa")}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: newItemType === "tarefa" ? "#7C5CFF" : "#1a1530",
                  color: newItemType === "tarefa" ? "#fff" : "#9e96b5",
                }}>☑️ Tarefa</button>
            </div>

            {/* Title */}
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título"
              style={modalInput} autoFocus />

            {/* Emoji */}
            <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="Emoji (opcional) — ex: 💪"
              style={{ ...modalInput, marginTop: 10 }} />

            {/* Date */}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4, display: "block" }}>Data</label>
              <div style={nativeInputWrapper}>
                <input type="date" value={newDate || selectedDate} onChange={(e) => setNewDate(e.target.value)}
                  style={nativeInputInner} />
              </div>
            </div>

            {/* Time (only for compromisso) */}
            {newItemType === "compromisso" && (
              <>
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4, display: "block" }}>Início</label>
                  <div style={nativeInputWrapper}>
                    <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)}
                      style={nativeInputInner} />
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4, display: "block" }}>Fim</label>
                  <div style={nativeInputWrapper}>
                    <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)}
                      style={nativeInputInner} />
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              style={{ ...modalInput, marginTop: 10, resize: "none", height: 56 }} />

            {/* Área — vincula à Roda da Vida */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>
                Área da Roda da Vida {newArea && <span style={{ color: "#A78BFA" }}>· {AREA_LABELS[newArea as TaskArea]}</span>}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                {(Object.keys(AREA_CONFIG) as TaskArea[]).filter(a => a !== "outros").map(a => {
                  const area = AREA_CONFIG[a];
                  const active = newArea === a;
                  return (
                    <button key={a} type="button" onClick={() => setNewArea(active ? "" : a)}
                      style={{
                        padding: "7px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        border: active ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)",
                        background: active ? "rgba(124,92,255,0.1)" : "#0B0B10",
                      }}>
                      <span style={{ fontSize: 14 }}>{area?.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: active ? "#A78BFA" : "#9e96b5" }}>{AREA_LABELS[a]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vincular a meta */}
            {(activeGoals.length > 0 || weekPedras.length > 0) && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Vincular a meta (opcional)</label>
                <select value={newLinkedGoalId} onChange={e => setNewLinkedGoalId(e.target.value)}
                  style={{
                    ...modalInput, height: 44, appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A78BFA' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                    paddingRight: 36,
                  }}>
                  <option value="">Nenhuma</option>
                  {weekPedras.length > 0 && (
                    <optgroup label="Pedras da semana">
                      {weekPedras.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {activeGoals.filter((g: any) => !weekPedras.some(p => p.id === g.id)).length > 0 && (
                    <optgroup label="Demais metas">
                      {activeGoals.filter((g: any) => !weekPedras.some(p => p.id === g.id)).map((g: any) => (
                        <option key={g.id} value={g.id}>{g.emoji || "🎯"} {g.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {/* Color picker */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Cor</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["#7C5CFF", "#FF4D4D", "#FF9F43", "#FFD43B", "#4CD97B", "#5EEAD4", "#F472B6", "#818CF8"].map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: c, border: newColor === c ? "2.5px solid #fff" : "2px solid transparent", cursor: "pointer", transition: "all .1s", boxShadow: newColor === c ? "0 0 8px " + c + "66" : "none",
                    }} />
                ))}
              </div>
            </div>

            {/* Repeat (só compromisso) */}
            {newItemType === "compromisso" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Repetir</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[
                    { val: "none", label: "Não" },
                    { val: "daily", label: "Diário" },
                    { val: "weekdays", label: "Dias úteis" },
                    { val: "weekly", label: "Semanal" },
                    { val: "monthly", label: "Mensal" },
                  ].map(r => (
                    <button key={r.val} type="button" onClick={() => setNewRepeat(r.val)}
                      style={{
                        padding: "5px 10px", borderRadius: 9999, border: 0, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 10, fontWeight: 600, background: newRepeat === r.val ? "#7C5CFF" : "#1e1840",
                        color: newRepeat === r.val ? "#fff" : "#9e96b5",
                      }}>{r.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Notification */}
            {newItemType === "compromisso" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Notificação</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {[
                    { val: null, label: "Nenhum" },
                    { val: 5, label: "5 min" },
                    { val: 15, label: "15 min" },
                    { val: 30, label: "30 min" },
                    { val: 60, label: "1 hora" },
                  ].map(n => (
                    <button key={String(n.val)} type="button" onClick={() => setNewNotify(n.val)}
                      style={{
                        padding: "5px 10px", borderRadius: 9999, border: 0, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 10, fontWeight: 600, background: newNotify === n.val ? "#7C5CFF" : "#1e1840",
                        color: newNotify === n.val ? "#fff" : "#9e96b5",
                      }}>{n.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Due date (só tarefa) */}
            {newItemType === "tarefa" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Data limite</label>
                <div style={nativeInputWrapper}>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                    style={nativeInputInner} />
                </div>
              </div>
            )}

            {/* Priority */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 6, display: "block" }}>Prioridade</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(Object.entries(PRIORITY_CONFIG) as [EisenhowerPriority, typeof PRIORITY_CONFIG[EisenhowerPriority]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} type="button" onClick={() => setNewPriority(key)}
                      style={{
                        padding: "6px 10px", borderRadius: 9999, border: 0, cursor: "pointer",
                        fontFamily: "inherit", fontSize: 10, fontWeight: 600,
                        background: newPriority === key ? cfg.color + "22" : "#1a1530",
                        color: newPriority === key ? cfg.color : "#9e96b5",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                      <Icon size={10} /> {cfg.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={closeNewItemModal}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 14,
                  border: "1px solid rgba(167,139,250,0.2)", background: "transparent",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#9e96b5",
                }}>Cancelar</button>
              <button type="button" onClick={handleSave} disabled={saving || !newTitle.trim()}
                style={{
                  flex: 2, padding: "14px 0", borderRadius: 14, border: 0,
                  cursor: (saving || !newTitle.trim()) ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: (saving || !newTitle.trim()) ? "#1e1840" : "#7C5CFF",
                  color: (saving || !newTitle.trim()) ? "#9e96b5" : "#fff",
                }}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete dialog (compromisso repetido) ───────────── */}
      {deleteDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#1a1530", borderRadius: 20, padding: 24, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#e0d6ff", lineHeight: 1.5 }}>
              {deleteDialog.emoji && <span style={{ marginRight: 6 }}>{deleteDialog.emoji}</span>}
              {deleteDialog.title}
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#9e96b5", lineHeight: 1.5 }}>
              Este compromisso se repete. O que deseja excluir?
            </p>
            <button type="button" onClick={() => deleteThisOccurrence(deleteDialog)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)", color: "#e0d6ff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Apenas este
            </button>
            <button type="button" onClick={() => deleteThisAndFuture(deleteDialog)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)", color: "#e0d6ff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Este e os seguintes
            </button>
            <button type="button" onClick={() => deleteAllOccurrences(deleteDialog)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: 0, background: "rgba(255,92,92,0.12)", color: "#FF5C5C", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Todos (passado e futuro)
            </button>
            <button type="button" onClick={() => setDeleteDialog(null)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Custom confirm dialog ───────────────────────── */}
      {confirmDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#1a1530", borderRadius: 20, padding: 24, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <p style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.5 }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { confirmDialog.onCancel?.(); setConfirmDialog(null); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {confirmDialog.cancelLabel || "Cancelar"}
              </button>
              <button type="button" onClick={() => { confirmDialog.onOk(); setConfirmDialog(null); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: 0, background: confirmDialog.okColor || "#FF5C5C", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {confirmDialog.okLabel || "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", color: "#e0d6ff", fontSize: 14,
  fontFamily: "inherit", outline: "none",
};

const nativeInputWrapper: React.CSSProperties = {
  overflow: "hidden", borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10",
};

const nativeInputInner: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  border: "none", outline: "none",
  background: "transparent", color: "#e0d6ff",
  fontSize: 14, fontFamily: "inherit",
};

const navBtnStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.15)",
  background: "#1a1530", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#e0d6ff",
};

function ListView({ allWeekTasks, compromissos, selectedDate, setAllWeekTasks, refreshItems, loading, toggleAgendaTask }: { allWeekTasks: any[]; compromissos: AgendaItem[]; selectedDate: string; setAllWeekTasks: React.Dispatch<React.SetStateAction<any[]>>; refreshItems: () => void; loading: boolean; toggleAgendaTask: (item: AgendaItem, coords?: { x: number; y: number }) => void }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDone, setEditDone] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deleteOpts, setDeleteOpts] = useState<any | null>(null);

  const refreshGoals = () => {
    setGoalsLoading(true);
    fetch("/api/goals").then(r => r.json()).then(d => { if (Array.isArray(d)) setGoals(d.filter((g: any) => g.status === "ativa")); }).catch(() => {}).finally(() => setGoalsLoading(false));
  };

  useEffect(() => {
    refreshGoals();
  }, []); // eslint-disable-line

  function getCurrentWeekMonday(): string {
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const todayStr = getLocalDate();
  const shortDate = (dateStr: string) => {
    const [, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  };

  // Segunda (0) .. Domingo (6) de uma data YYYY-MM-DD
  const dowOf = (dateStr: string): number => {
    const d = new Date(dateStr + "T12:00:00");
    return d.getDay() === 0 ? 6 : d.getDay() - 1;
  };

  // Segunda-feira (YYYY-MM-DD) da semana que contém dateStr
  const weekStartOf = (dateStr: string): string => {
    const d = new Date(dateStr + "T12:00:00");
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;
  };

  // Data YYYY-MM-DD de uma tarefa semanal (a partir de _weekStart + day_of_week)
  const taskDate = (t: any): string => {
    if (t._weekStart && t.day_of_week != null && t.day_of_week >= 0) {
      const mon = new Date(t._weekStart + "T12:00:00");
      mon.setDate(mon.getDate() + t.day_of_week);
      return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;
    }
    return todayStr;
  };

  // Garante que existe um plano semanal para a semana e devolve o id (cria se faltar)
  const ensureWeeklyPlan = async (weekStart: string): Promise<string | null> => {
    let planId: string | null = null;
    const getRes = await fetch(`/api/weekly-plans?week=${weekStart}`);
    if (getRes.ok) {
      const data = await getRes.json();
      planId = data.current?.id ?? null;
    }
    if (!planId) {
      const createRes = await fetch("/api/weekly-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart }),
      });
      if (createRes.ok) {
        const plan = await createRes.json();
        planId = plan.id;
      }
    }
    return planId;
  };

  // Move uma tarefa semanal para um dia específico (cria o plano da semana se preciso)
  const moveTaskToDay = async (t: any, dateStr: string, extra: Record<string, unknown> = {}) => {
    const dow = dowOf(dateStr);
    const weekStart = weekStartOf(dateStr);
    const planId = await ensureWeeklyPlan(weekStart);
    if (!planId) return { ok: false, weekStart, dow, planId };
    const moveRes = await fetch(`/api/weekly-plans/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_of_week: dow, weekly_plan_id: planId, ...extra }),
    });
    return { ok: moveRes.ok, weekStart, dow, planId };
  };

  // Marca/desmarca uma tarefa semanal como concluída (atualiza o estado local)
  const toggleTaskDone = async (t: any, coords?: { x: number; y: number }) => {
    const completing = t.status !== "concluida";
    const newStatus = completing ? "concluida" : "pendente";
    const isOpen = t.day_of_week == null;
    if (completing) celebrate(coords?.x, coords?.y);

    // Completar uma tarefa "Em aberto": grava no dia de hoje (referência p/ análises)
    if (completing && isOpen) {
      const { ok, weekStart, dow, planId } = await moveTaskToDay(t, todayStr, { status: "concluida" });
      if (ok) {
        setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === t.id
          ? { ...wt, status: "concluida", day_of_week: dow, _weekStart: weekStart, weekly_plan_id: planId }
          : wt));
        toast.success(`"${t.title}" concluída hoje`);
        return;
      }
      // fallback: se falhar criar o plano, só marca o status abaixo
    }

    setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === t.id ? { ...wt, status: newStatus } : wt));
    await fetch(`/api/weekly-plans/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success(newStatus === "concluida" ? `"${t.title}" concluída` : `"${t.title}" reaberta`);
  };

  const moveToToday = async (t: any, dateLabel: string, kind: "overdue" | "open" = "overdue") => {
    if (movingId) return;
    setMovingId(t.id);
    const { ok, weekStart, dow, planId } = await moveTaskToDay(t, todayStr);
    if (ok) {
      if (kind === "overdue") {
        toast.warning(`⚠️ ${t.title} estava atrasada`, {
          description: dateLabel ? `Movida de ${dateLabel} para hoje` : "Movida para hoje",
        });
      } else {
        toast.success(`➕ ${t.title} adicionada ao plano de hoje`);
      }
      // Pequena pausa para o pulso aparecer antes de sair da lista
      setTimeout(() => {
        setAllWeekTasks((prev: any[]) => prev.map((wt: any) =>
          wt.id === t.id
            ? { ...wt, day_of_week: dow, _weekStart: weekStart, weekly_plan_id: planId }
            : wt
        ));
        setMovingId(null);
      }, 450);
    } else {
      setMovingId(null);
    }
  };

  const todayComp = compromissos.filter(c => c.item_type === "compromisso");
  const todayAgendaTarefas = compromissos.filter(c => c.item_type === "tarefa");

  const activeGoals = goals.slice(0, 5);
  const selD = new Date(selectedDate + "T12:00:00");
  const selDow = selD.getDay() === 0 ? 6 : selD.getDay() - 1;
  const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const currentWeekMonday = getCurrentWeekMonday();
  const dayPlanTasks = allWeekTasks.filter((t: any) => t.day_of_week === selDow && t._weekStart === weekStartOf(selectedDate) && t.status !== "pulada");
  // Tasks without a specific day (Em aberto) — from all loaded weeks
  const openWeekTasks = allWeekTasks.filter((t: any) => t.day_of_week == null && t.status !== "pulada");
  // Overdue tasks: from previous days this week OR past weeks, not completed/skipped
  const overdueTasks = allWeekTasks.filter((t: any) => {
    if (t.status === "concluida" || t.status === "pulada") return false;
    if (t.day_of_week == null || t.day_of_week < 0) return false;
    const taskWeek = t._weekStart;
    // From a past week (always overdue)
    if (taskWeek && taskWeek < currentWeekMonday) return true;
    // From this week but earlier day
    if (t.day_of_week < todayDow) return true;
    return false;
  });
  // Tarefas puladas (descartadas sem apagar) — ficam fora das listas ativas
  const puladaTasks = allWeekTasks.filter((t: any) => t.status === "pulada");

  const isLoading = loading || goalsLoading;

  // Skeleton enquanto as seções carregam (evita os "buracos" de baixo pra cima)
  if (isLoading) {
    const skelTitle = { width: 90, height: 12, borderRadius: 6, marginBottom: 10, background: "linear-gradient(90deg, #1a1530 25%, #241d45 50%, #1a1530 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.4s ease-in-out infinite" };
    const skelRow = { height: 42, borderRadius: 10, marginBottom: 8, background: "linear-gradient(90deg, #151220 25%, #221b3d 50%, #151220 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.4s ease-in-out infinite" };
    return (
      <div style={{ padding: "0 20px" }}>
        {[0, 1, 2].map((s) => (
          <div key={s} style={{ marginBottom: 18 }}>
            <div style={skelTitle} />
            {(s === 0 ? [0, 1] : [0, 1, 2]).map((r) => (
              <div key={r} style={skelRow} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const openEditor = (item: any) => {
    setEditingItem(item);
    setEditTitle(item.title || "");
    setEditDone(item.status === "concluida");
    // Para tarefas "Em aberto" (sem dia), o campo de data começa vazio para o usuário escolher
    const isOpen = !item.item_type && item.day_of_week == null;
    setEditDate(item.item_type ? (item.date || selectedDate) : (isOpen ? "" : taskDate(item)));
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editingItem) return;
    const updates: Record<string, unknown> = {
      title: editTitle.trim(),
      status: editDone ? "concluida" : "pendente",
    };
    // Tarefa semanal sem dia definido ("Em aberto")
    const isWeeklyOpen = !editingItem.item_type && editingItem.day_of_week == null;
    // Data atual do item (para detectar mudança de dia)
    const originalDate = editingItem.item_type
      ? (editingItem.date || selectedDate)
      : (isWeeklyOpen ? "" : taskDate(editingItem));
    // "Em aberto": qualquer data escolhida já agenda o item (é uma mudança)
    const dayChanged = isWeeklyOpen ? !!editDate : (!!editDate && editDate !== originalDate);
    if (editingItem.item_type) {
      // Item da agenda (compromisso/tarefa): pode mudar o dia
      await fetch("/api/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: (editingItem as any)._origId || editingItem.id, ...updates, date: editDate || originalDate }),
      });
      setEditingItem(null);
      refreshItems();
    } else {
      // Tarefa do plano semanal: pode mudar o dia (mover para outra data)
      if (dayChanged) {
        const { ok, weekStart, dow, planId } = await moveTaskToDay(editingItem, editDate, updates);
        if (ok) {
          setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === editingItem.id
            ? { ...wt, ...updates, day_of_week: dow, _weekStart: weekStart, weekly_plan_id: planId }
            : wt));
        }
      } else if (isWeeklyOpen && editDone) {
        // "Em aberto" marcada como concluída sem escolher dia: grava no dia de hoje
        const { ok, weekStart, dow, planId } = await moveTaskToDay(editingItem, todayStr, updates);
        if (ok) {
          setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === editingItem.id
            ? { ...wt, ...updates, day_of_week: dow, _weekStart: weekStart, weekly_plan_id: planId }
            : wt));
        }
      } else {
        await fetch(`/api/weekly-plans/tasks/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === editingItem.id ? { ...wt, ...updates } : wt));
      }
      setEditingItem(null);
    }
    toast.success(dayChanged ? `Movida para ${shortDate(editDate)}` : (isWeeklyOpen && editDone ? `"${editTitle.trim()}" concluída hoje` : "Alterações salvas"));
  };

  const realItemId = (item: any) => item._origId || item.id;

  const deleteThisOccurrence = async (item: any) => {
    await fetch("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title, item_type: item.item_type, date: item.date,
        start_time: item.start_time, end_time: item.end_time,
        priority: item.priority, emoji: item.emoji || null,
        description: item.description || null, color: item.color || null,
        area: item.area || null, repeat_type: "none", excluded: true,
      }),
    });
    setDeleteOpts(null); setEditingItem(null); refreshItems();
  };

  const deleteThisAndFuture = async (item: any) => {
    const isOriginal = !(item.id.includes("_r_") || item.id.includes("_cross"));
    if (isOriginal) {
      await fetch(`/api/agenda?id=${realItemId(item)}&scope=all&${seriesDeleteParams(item)}`, { method: "DELETE" });
    } else {
      const d = new Date(item.date + "T12:00:00");
      d.setDate(d.getDate() - 1);
      const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await fetch("/api/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: realItemId(item), repeat_until: prev }),
      });
    }
    setDeleteOpts(null); setEditingItem(null); refreshItems();
  };

  const deleteAllOccurrences = async (item: any) => {
    await fetch(`/api/agenda?id=${realItemId(item)}&scope=all&${seriesDeleteParams(item)}`, { method: "DELETE" });
    setDeleteOpts(null); setEditingItem(null); refreshItems();
  };

  const deleteItem = async () => {
    if (!editingItem) return;
    if (editingItem.item_type) {
      const isSynth = editingItem.id.includes("_r_") || editingItem.id.includes("_cross");
      if (isSynth || isRepeatingItem(editingItem)) {
        setDeleteOpts(editingItem);
        return;
      }
      if (!confirm("Tem certeza que deseja excluir?")) return;
      await fetch(`/api/agenda?id=${realItemId(editingItem)}`, { method: "DELETE" });
      refreshItems();
      setEditingItem(null);
      toast.success("Atividade excluída");
    } else {
      if (!confirm("Tem certeza que deseja excluir?")) return;
      await fetch(`/api/weekly-plans/tasks/${editingItem.id}`, { method: "DELETE" });
      setAllWeekTasks((prev: any[]) => prev.filter((wt: any) => wt.id !== editingItem.id));
      setEditingItem(null);
      toast.success("Atividade excluída");
    }
  };

  // Pular (descartar) uma tarefa semanal sem apagar o registro
  const skipItem = async () => {
    if (!editingItem || editingItem.item_type) return;
    await fetch(`/api/weekly-plans/tasks/${editingItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pulada" }),
    });
    setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === editingItem.id ? { ...wt, status: "pulada" } : wt));
    setEditingItem(null);
    toast.success(`⏭️ "${editingItem.title}" pulada`);
  };

  // Reabrir uma tarefa pulada (volta a "pendente")
  const reopenTask = async (t: any) => {
    setAllWeekTasks((prev: any[]) => prev.map((wt: any) => wt.id === t.id ? { ...wt, status: "pendente" } : wt));
    await fetch(`/api/weekly-plans/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pendente" }),
    });
    toast.success(`↩️ "${t.title}" reaberta`);
  };

  return (
    <div style={{ padding: "0 20px" }}>
      {/* Atrasadas (overdue weekly plan tasks) */}
      {overdueTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#FF9F43", textTransform: "uppercase", letterSpacing: ".06em" }}>⚠️ Atrasadas</h3>
          {overdueTasks.map((t: any) => {
            const area = AREA_CONFIG_PT[t.area] || { emoji: "⚪" };
            let dateLabel = "";
            if (t._weekStart && t.day_of_week != null && t.day_of_week >= 0) {
              const mon = new Date(t._weekStart + "T12:00:00");
              mon.setDate(mon.getDate() + t.day_of_week);
              dateLabel = `${String(mon.getDate()).padStart(2, "0")}/${String(mon.getMonth() + 1).padStart(2, "0")}`;
            }
            return (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 6px",
                borderTop: "1px solid rgba(167,139,250,0.05)", borderRadius: 8,
                animation: movingId === t.id ? "agendaMovePulse 0.45s ease" : "none",
              }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: "1.5px solid rgba(255,159,67,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={(e) => { e.stopPropagation(); toggleTaskDone(t, { x: e.clientX, y: e.clientY }); }}
                />
                <span style={{ flex: 1, fontSize: 11, color: "#FF9F43", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => openEditor(t)}>{t.title}</span>
                <span style={{ fontSize: 8, color: "#9e96b5", flexShrink: 0 }}>{dateLabel}</span>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); moveToToday(t, dateLabel); }}
                  disabled={movingId === t.id}
                  title="Mover para esta semana"
                  style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(124,92,255,0.06)", color: "#A78BFA", fontSize: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap", opacity: movingId === t.id ? 0.5 : 1 }}>
                  {movingId === t.id ? "…" : "Hoje →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Em aberto (weekly tasks without day) */}
      {openWeekTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".06em" }}>📋 Em aberto</h3>
          {openWeekTasks.map((t: any) => {
            const area = AREA_CONFIG_PT[t.area] || { emoji: "⚪" };
            const done = t.status === "concluida";
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(167,139,250,0.05)", animation: movingId === t.id ? "agendaMovePulse 0.45s ease" : "none" }}>
                <span style={{ fontSize: 12, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)", background: done ? "#7C5CFF" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: done ? "checkPop 0.3s ease" : "none" }}
                  onClick={(e) => { e.stopPropagation(); toggleTaskDone(t, { x: e.clientX, y: e.clientY }); }}>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="m5 12 5 5 9-10"/></svg>}
                </span>
                <span style={{ flex: 1, fontSize: 11, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => openEditor(t)}>{t.title}</span>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); moveToToday(t, "", "open"); }}
                  disabled={movingId === t.id}
                  title="Adicionar ao plano de hoje"
                  style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(124,92,255,0.06)", color: "#A78BFA", fontSize: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap", opacity: movingId === t.id ? 0.5 : 1 }}>
                  {movingId === t.id ? "…" : "Hoje →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Compromissos do dia */}
      {todayComp.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".06em" }}>Compromissos do dia</h3>
          {todayComp.map(c => (
            <button key={c.id} type="button" onClick={() => openEditor(c)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid rgba(167,139,250,0.05)", background: "none", borderLeft: 0, borderRight: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12 }}>{c.emoji || "📅"}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#e0d6ff" }}>{c.title}</span>
              {c.start_time && <span style={{ fontSize: 9, color: "#9e96b5", fontFamily: "monospace" }}>{c.start_time.slice(0,5)}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Tarefas da agenda */}
      {todayAgendaTarefas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".06em" }}>Tarefas do dia</h3>
          {todayAgendaTarefas.map(t => {
            const done = t.status === "concluida";
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(167,139,250,0.05)" }}>
                <span style={{ fontSize: 12, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)", background: done ? "#7C5CFF" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: done ? "checkPop 0.3s ease" : "none" }}
                  onClick={(e) => { e.stopPropagation(); toggleAgendaTask(t, { x: e.clientX, y: e.clientY }); }}>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="m5 12 5 5 9-10"/></svg>}
                </span>
                {t.emoji && <span style={{ fontSize: 12, flexShrink: 0 }}>{t.emoji}</span>}
                <span style={{ flex: 1, fontSize: 12, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => openEditor(t)}>{t.title}</span>
                {t.start_time && <span style={{ fontSize: 9, color: "#9e96b5", fontFamily: "monospace", flexShrink: 0 }}>{t.start_time.slice(0,5)}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Tarefas do planejamento */}
      {dayPlanTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".06em" }}>Plano do dia</h3>
          {dayPlanTasks.map((t: any) => {
            const area = AREA_CONFIG_PT[t.area] || { emoji: "⚪" };
            const done = t.status === "concluida";
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(167,139,250,0.05)" }}>
                <span style={{ fontSize: 12, flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: done ? "none" : "1.5px solid rgba(167,139,250,0.3)", background: done ? "#7C5CFF" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: done ? "checkPop 0.3s ease" : "none" }}
                  onClick={(e) => { e.stopPropagation(); toggleTaskDone(t, { x: e.clientX, y: e.clientY }); }}>
                  {done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="m5 12 5 5 9-10"/></svg>}
                </span>
                <span style={{ fontSize: 12 }}>{area.emoji}</span>
                <span style={{ flex: 1, fontSize: 12, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none", cursor: "pointer" }} onClick={() => openEditor(t)}>{t.title}</span>
                {t.scheduled_time && <span style={{ fontSize: 9, color: "#9e96b5", fontFamily: "monospace" }}>{t.scheduled_time.slice(0,5)}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Metas ativas */}
      {activeGoals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", letterSpacing: ".06em" }}>Metas ativas</h3>
          {activeGoals.map((g: any) => (
            <button key={g.id} type="button" onClick={() => setDetailGoalId(g.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid rgba(167,139,250,0.05)", background: "none", borderLeft: 0, borderRight: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ fontSize: 12 }}>{(AREA_CONFIG_PT as any)[g.area]?.emoji || "🎯"}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#9e96b5" }}>{g.title}</span>
              <span style={{ fontSize: 9, color: "#A78BFA" }}>{(g.goal_stages?.filter((s: any) => s.status === "concluida").length || 0)}/{g.goal_stages?.length || 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Puladas (descartadas sem apagar) */}
      {puladaTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#5a5470", textTransform: "uppercase", letterSpacing: ".06em" }}>⏭️ Puladas</h3>
          {puladaTasks.map((t: any) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(167,139,250,0.05)" }}>
              <span style={{ flex: 1, fontSize: 11, color: "#5a5470", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              <button type="button" onClick={() => reopenTask(t)}
                style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}>
                ↩ Reabrir
              </button>
            </div>
          ))}
        </div>
      )}

      {todayComp.length === 0 && todayAgendaTarefas.length === 0 && dayPlanTasks.length === 0 && openWeekTasks.length === 0 && overdueTasks.length === 0 && activeGoals.length === 0 && puladaTasks.length === 0 && (
        <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center", padding: 32 }}>Nenhuma atividade</p>
      )}

      {/* Delete dialog (compromisso repetido) */}
      {deleteOpts && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 320, background: "#1a1530", borderRadius: 20, padding: 24, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#e0d6ff", lineHeight: 1.5 }}>
              {deleteOpts.emoji && <span style={{ marginRight: 6 }}>{deleteOpts.emoji}</span>}
              {deleteOpts.title}
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#9e96b5", lineHeight: 1.5 }}>
              Este compromisso se repete. O que deseja excluir?
            </p>
            <button type="button" onClick={() => deleteThisOccurrence(deleteOpts)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)", color: "#e0d6ff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Apenas este
            </button>
            <button type="button" onClick={() => deleteThisAndFuture(deleteOpts)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)", color: "#e0d6ff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Este e os seguintes
            </button>
            <button type="button" onClick={() => deleteAllOccurrences(deleteOpts)}
              style={{ width: "100%", padding: "12px 0", marginBottom: 8, borderRadius: 12, border: 0, background: "rgba(255,92,92,0.12)", color: "#FF5C5C", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Todos (passado e futuro)
            </button>
            <button type="button" onClick={() => setDeleteOpts(null)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {detailGoalId && <GoalDetailSheet goalId={detailGoalId} onClose={() => setDetailGoalId(null)} onUpdated={refreshGoals} />}

      {editingItem && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 20px 20px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>Editar</h3>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Título" autoFocus
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            {/* Mudar de dia */}
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 10, color: "#9e96b5", marginBottom: 4, display: "block" }}>Mudar de dia</label>
              <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10" }}>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "none", outline: "none", background: "transparent", color: "#e0d6ff", fontSize: 14, fontFamily: "inherit" }} />
              </div>
            </div>
            {/* Toggle concluído */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={editDone} onChange={e => setEditDone(e.target.checked)}
                style={{ accentColor: "#7C5CFF", width: 20, height: 20 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>Concluído</span>
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setEditingItem(null)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button type="button" onClick={saveEdit}
                style={{ flex: 2, padding: 14, borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Salvar</button>
            </div>
            {/* Pular (apenas tarefas do plano semanal) */}
            {!editingItem.item_type && (
              <button type="button" onClick={skipItem}
                style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(124,92,255,0.06)", color: "#A78BFA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ⏭️ Pular (não vou fazer)
              </button>
            )}
            {/* Delete */}
            <button type="button" onClick={deleteItem}
              style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 14, border: 0, background: "rgba(255,92,92,0.1)", color: "#FF5C5C", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              🗑 Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const AREA_CONFIG_PT: Record<string, { emoji: string }> = {
  saude: { emoji: "💚" }, carreira: { emoji: "💼" }, financas: { emoji: "💰" },
  relacionamentos: { emoji: "❤️" }, desenvolvimento: { emoji: "🧠" }, familia: { emoji: "🏡" },
  lazer: { emoji: "🌊" }, espiritualidade: { emoji: "✨" }, outros: { emoji: "⚪" },
};

const DAY_FULL_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const hubBtnStyle: React.CSSProperties = {
  flex: 1, padding: "12px 0", borderRadius: 14, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
  background: "#1a1530", color: "#9e96b5",
  border: "1px solid rgba(167,139,250,0.15)",
};
