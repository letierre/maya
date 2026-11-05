import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  const { data: action, error } = await admin
    .from("goal_actions")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", actionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(action);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Verifica que a ação pertence a uma meta do usuário (ação → etapa → meta).
  const { data: action } = await admin
    .from("goal_actions").select("stage_id").eq("id", actionId).single();
  if (!action) return NextResponse.json({ error: "Ação não encontrada" }, { status: 404 });

  const { data: stage } = await admin
    .from("goal_stages").select("goal_id").eq("id", action.stage_id).single();
  if (!stage) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });

  const { data: goal } = await admin
    .from("goals").select("id").eq("id", stage.goal_id).eq("user_id", user.id).single();
  if (!goal) return NextResponse.json({ error: "Não autorizado" }, { status: 404 });

  const { error } = await admin.from("goal_actions").delete().eq("id", actionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
