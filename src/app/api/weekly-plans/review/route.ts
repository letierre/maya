import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getWeekMondayDate } from "@/lib/utils";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { biggest_win, blocked_lesson, main_learning, week_score } = body;

  if (!biggest_win || !week_score) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const weekStart = getWeekMondayDate();

  // Find current week's plan
  const { data: plan } = await admin
    .from("weekly_plans")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("week_start", weekStart)
    .single();

  if (!plan) return NextResponse.json({ error: "Plano semanal não encontrado" }, { status: 404 });

  const { data: review, error } = await admin
    .from("weekly_reviews")
    .upsert(
      { weekly_plan_id: plan.id, biggest_win, blocked_lesson, main_learning, week_score },
      { onConflict: "weekly_plan_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(review, { status: 201 });
}
