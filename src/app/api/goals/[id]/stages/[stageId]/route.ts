import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id: goal_id, stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Verify ownership via goal
  const { data: goal } = await admin
    .from("goals").select("id").eq("id", goal_id).eq("user_id", session.user.id).single();
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const { data: stage, error } = await admin
    .from("goal_stages")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", stageId)
    .eq("goal_id", goal_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If stage completed, check if all stages are done → auto-suggest goal completion
  if (body.status === "concluida") {
    const { data: stages } = await admin
      .from("goal_stages")
      .select("status")
      .eq("goal_id", goal_id);
    const allDone = stages?.every((s) => s.status === "concluida") ?? false;
    return NextResponse.json({ stage, all_stages_done: allDone });
  }

  return NextResponse.json({ stage, all_stages_done: false });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id: goal_id, stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: goal } = await admin
    .from("goals").select("id").eq("id", goal_id).eq("user_id", session.user.id).single();
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const { error } = await admin.from("goal_stages").delete().eq("id", stageId).eq("goal_id", goal_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
