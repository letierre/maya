import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { biggest_win, blocked_lesson, main_learning, week_score, week_start } = body;

  if (!biggest_win || !week_score) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const weekStart = week_start || getWeekMondayDate();

  // Find (or create) the current week's plan, so a review can always be saved —
  // even if the user never added a task/pedra for that week.
  const { data: existing } = await admin
    .from("weekly_plans")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  let planId: string;
  if (existing) {
    planId = existing.id;
  } else {
    const { data: newPlan, error: createErr } = await admin
      .from("weekly_plans")
      .upsert(
        { user_id: session.user.id, week_start: weekStart, main_focus: "" },
        { onConflict: "user_id,week_start" }
      )
      .select("id")
      .single();
    if (createErr || !newPlan) {
      return NextResponse.json({ error: createErr?.message || "Falha ao criar plano" }, { status: 500 });
    }
    planId = newPlan.id;
  }

  const { data: review, error } = await admin
    .from("weekly_reviews")
    .upsert(
      { weekly_plan_id: planId, biggest_win, blocked_lesson, main_learning, week_score },
      { onConflict: "weekly_plan_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(review, { status: 201 });
}
