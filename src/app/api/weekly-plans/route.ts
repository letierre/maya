import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const weekStart = weekParam || getWeekMondayDate();

  // Período: devolve todos os planos do intervalo (com tarefas e reviews)
  if (from || to) {
    let query = admin
      .from("weekly_plans")
      .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id), weekly_tasks(*)`)
      .eq("user_id", session.user.id);
    if (from) query = query.gte("week_start", from);
    if (to) query = query.lte("week_start", to);
    query = query.order("week_start", { ascending: true });
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plans: data ?? [] });
  }

  const { data: plan, error } = await admin
    .from("weekly_plans")
    .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id, goals(*)), weekly_tasks(*)`)
    .eq("user_id", session.user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: history } = await admin
    .from("weekly_plans")
    .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id), weekly_tasks(*)`)
    .eq("user_id", session.user.id)
    .neq("week_start", weekStart)
    .order("week_start", { ascending: false })
    .limit(4);

  return NextResponse.json({ current: plan, history: history ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { main_focus, main_focus_2, main_focus_3, linked_goal_id, focus_goal_ids, week_start } = body;

  // At least one of main_focus, main_focus_2, main_focus_3 must be provided
  if (!main_focus && !main_focus_2 && !main_focus_3) return NextResponse.json({ error: "Foco principal obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const weekStart = week_start || getWeekMondayDate();

  const { data: plan, error } = await admin
    .from("weekly_plans")
    .upsert(
      {
        user_id: session.user.id,
        week_start: weekStart,
        main_focus,
        main_focus_2: main_focus_2 || null,
        main_focus_3: main_focus_3 || null,
        linked_goal_id: linked_goal_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  if (error || !plan) return NextResponse.json({ error: error?.message }, { status: 500 });

  await admin.from("weekly_focus_goals").delete().eq("weekly_plan_id", plan.id);
  if (focus_goal_ids?.length) {
    await admin.from("weekly_focus_goals").insert(
      focus_goal_ids.map((gid: string) => ({ weekly_plan_id: plan.id, goal_id: gid }))
    );
  }

  return NextResponse.json(plan, { status: 201 });
}
