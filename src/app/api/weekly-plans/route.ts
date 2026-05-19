import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const weekStart = getWeekMondayDate();

  const { data: plan, error } = await admin
    .from("weekly_plans")
    .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id, goals(*))`)
    .eq("user_id", session.user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also return last 4 weeks for history
  const { data: history } = await admin
    .from("weekly_plans")
    .select(`*, weekly_reviews(*), weekly_focus_goals(goal_id)`)
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
  const { main_focus, linked_goal_id, focus_goal_ids } = body;

  if (!main_focus) return NextResponse.json({ error: "Foco principal obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const weekStart = getWeekMondayDate();

  const { data: plan, error } = await admin
    .from("weekly_plans")
    .upsert(
      {
        user_id: session.user.id,
        week_start: weekStart,
        main_focus,
        linked_goal_id: linked_goal_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    )
    .select()
    .single();

  if (error || !plan) return NextResponse.json({ error: error?.message }, { status: 500 });

  // Replace focus goals
  await admin.from("weekly_focus_goals").delete().eq("weekly_plan_id", plan.id);

  if (focus_goal_ids?.length) {
    await admin.from("weekly_focus_goals").insert(
      focus_goal_ids.map((gid: string) => ({ weekly_plan_id: plan.id, goal_id: gid }))
    );
  }

  return NextResponse.json(plan, { status: 201 });
}
