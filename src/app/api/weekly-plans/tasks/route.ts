import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const { title, area, task_type, linked_goal_id, linked_action_id, day_of_week, scheduled_time, week_start, stone_rank } = body;

    if (!title || area === undefined) {
      return NextResponse.json({ error: "Campos obrigatórios: title, area" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const weekStart = week_start || getWeekMondayDate();

    // Ensure a plan exists for this week
    const { data: plan, error: planErr } = await admin
      .from("weekly_plans")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json({ error: "plan_query: " + planErr.message, code: planErr.code }, { status: 500 });
    }

    let planId: string;

    if (!plan) {
      const { data: newPlan, error: createErr } = await admin
        .from("weekly_plans")
        .upsert(
          { user_id: session.user.id, week_start: weekStart, main_focus: "" },
          { onConflict: "user_id,week_start" }
        )
        .select("id")
        .single();

      if (createErr || !newPlan) {
        return NextResponse.json({
          error: "plan_create: " + (createErr?.message || "unknown"),
          code: createErr?.code,
          details: createErr?.details,
          hint: createErr?.hint,
        }, { status: 500 });
      }
      planId = newPlan.id;
    } else {
      planId = plan.id;
    }

    const { data: task, error: insertErr } = await admin
      .from("weekly_tasks")
      .insert({
        weekly_plan_id: planId,
        user_id: session.user.id,
        title,
        area,
        task_type: task_type || "manutencao",
        linked_goal_id: linked_goal_id || null,
        linked_action_id: linked_action_id || null,
        day_of_week,
        scheduled_time: scheduled_time || null,
        stone_rank: stone_rank ?? null,
      })
      .select()
      .single();

    if (insertErr || !task) {
      return NextResponse.json({
        error: "task_insert: " + (insertErr?.message || "unknown"),
        code: insertErr?.code,
        details: insertErr?.details,
        hint: insertErr?.hint,
      }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({
      error: "unexpected: " + (err?.message || String(err)),
      stack: err?.stack,
    }, { status: 500 });
  }
}
