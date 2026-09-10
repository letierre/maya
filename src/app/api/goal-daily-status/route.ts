import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

const VALID = ["avançou", "parcial", "nao"] as const;
type Status = (typeof VALID)[number];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

/** 0=Seg..6=Dom para uma data YYYY-MM-DD. */
function dowOf(dateStr: string): number {
  const js = new Date(dateStr + "T12:00:00").getDay();
  return js === 0 ? 6 : js - 1;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const js = d.getDay();
  const daysToMonday = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + daysToMonday);
  return ymd(d);
}

/** Itens concluídos hoje (agenda + tarefas da semana) ligados à meta. */
async function getDoneToday(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  goalId: string,
  date: string,
): Promise<string[]> {
  const { data: agenda } = await admin
    .from("agenda_items")
    .select("title")
    .eq("user_id", userId)
    .eq("linked_goal_id", goalId)
    .eq("date", date)
    .eq("status", "concluida");

  const monday = mondayOf(date);
  const dow = dowOf(date);
  const { data: planRow } = await admin
    .from("weekly_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", monday)
    .maybeSingle();

  let weekly: { title: string }[] = [];
  if (planRow?.id) {
    const { data: wt } = await admin
      .from("weekly_tasks")
      .select("title")
      .eq("weekly_plan_id", planRow.id)
      .eq("linked_goal_id", goalId)
      .eq("status", "concluida")
      .eq("day_of_week", dow);
    weekly = wt ?? [];
  }

  return [...(agenda ?? []).map((a) => a.title), ...weekly.map((w) => w.title)];
}

// GET /api/goal-daily-status?date=YYYY-MM-DD
// Retorna, para cada meta ativa, o status do dia (reflexão manual + "travado"
// derivado de atividade concluída) e a sequência (streak) de dias avançando.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || getLocalDate("America/Sao_Paulo");

  const admin = getSupabaseAdmin();

  const { data: goals } = await admin
    .from("goals")
    .select("id, title, area")
    .eq("user_id", user.id)
    .in("status", ["ativa", "pausada"]);
  const goalList = goals ?? [];
  if (goalList.length === 0) return NextResponse.json({ statuses: [] });
  const goalIds = goalList.map((g) => g.id);

  const from = addDays(date, -120);

  // Agenda concluída hoje (ligada a metas)
  const { data: agendaToday } = await admin
    .from("agenda_items")
    .select("title, linked_goal_id")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("status", "concluida")
    .in("linked_goal_id", goalIds);

  // Tarefas da semana concluídas hoje (ligadas a metas)
  const monday = mondayOf(date);
  const dow = dowOf(date);
  const { data: planRow } = await admin
    .from("weekly_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", monday)
    .maybeSingle();
  let weeklyToday: { title: string; linked_goal_id: string }[] = [];
  if (planRow?.id) {
    const { data: wt } = await admin
      .from("weekly_tasks")
      .select("title, linked_goal_id")
      .eq("weekly_plan_id", planRow.id)
      .eq("status", "concluida")
      .eq("day_of_week", dow)
      .in("linked_goal_id", goalIds);
    weeklyToday = wt ?? [];
  }

  // Histórico: status manuais + agenda concluída (para o streak)
  const { data: stored } = await admin
    .from("goal_daily_status")
    .select("goal_id, date, status")
    .eq("user_id", user.id)
    .in("goal_id", goalIds)
    .gte("date", from)
    .lte("date", date);

  const { data: agendaHistory } = await admin
    .from("agenda_items")
    .select("date, linked_goal_id")
    .eq("user_id", user.id)
    .eq("status", "concluida")
    .in("linked_goal_id", goalIds)
    .gte("date", from)
    .lte("date", date);

  const manualByGoalDate = new Map<string, string>();
  for (const s of stored ?? []) manualByGoalDate.set(`${s.goal_id}|${s.date}`, s.status);

  const agendaDatesByGoal = new Map<string, Set<string>>();
  for (const a of agendaHistory ?? []) {
    if (!agendaDatesByGoal.has(a.linked_goal_id)) agendaDatesByGoal.set(a.linked_goal_id, new Set());
    agendaDatesByGoal.get(a.linked_goal_id)!.add(a.date);
  }

  // "Avançou" num dia passado = status manual 'avançou' OU agenda concluída naquele dia.
  const advancedOn = (goalId: string, d: string): boolean =>
    manualByGoalDate.get(`${goalId}|${d}`) === "avançou" || agendaDatesByGoal.get(goalId)?.has(d) === true;

  const statuses = goalList.map((goal) => {
    const doneToday = [
      ...(agendaToday ?? []).filter((a) => a.linked_goal_id === goal.id).map((a) => a.title),
      ...weeklyToday.filter((w) => w.linked_goal_id === goal.id).map((w) => w.title),
    ];
    const locked = doneToday.length > 0;
    const storedStatus = (manualByGoalDate.get(`${goal.id}|${date}`) ?? null) as Status | null;
    const effective: Status | null = locked ? "avançou" : storedStatus;

    const todayAdvanced = advancedOn(goal.id, date) || locked;
    let streak = 0;
    let cursor = todayAdvanced ? date : addDays(date, -1);
    while (true) {
      const advanced = cursor === date ? todayAdvanced : advancedOn(goal.id, cursor);
      if (!advanced) break;
      streak++;
      cursor = addDays(cursor, -1);
    }

    return {
      goal_id: goal.id,
      title: goal.title,
      area: goal.area,
      status: storedStatus,
      locked,
      effective,
      streak,
      doneToday,
      doneTodayCount: doneToday.length,
    };
  });

  return NextResponse.json({ statuses });
}

// POST /api/goal-daily-status — registra a reflexão manual do dia.
// Recusa quando a meta está "travada" (atividade concluída hoje).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { goal_id, date, status } = body;
  if (!goal_id || !date || !VALID.includes(status)) {
    return NextResponse.json({ error: "goal_id, date e status (avançou|parcial|nao) obrigatórios" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const doneToday = await getDoneToday(admin, user.id, goal_id, date);
  if (doneToday.length > 0) {
    return NextResponse.json({ error: "Meta travada: atividade concluída hoje" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("goal_daily_status")
    .upsert(
      { user_id: user.id, goal_id, date, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,goal_id,date" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
