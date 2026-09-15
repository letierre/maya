import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const admin = getSupabaseAdmin();

  const allowed = ["title", "area", "task_type", "linked_goal_id", "linked_action_id",
                   "day_of_week", "scheduled_time", "status", "position", "weekly_plan_id", "stone_rank"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await admin
    .from("weekly_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("user_id", session.user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { taskId } = await params;
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from("weekly_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
