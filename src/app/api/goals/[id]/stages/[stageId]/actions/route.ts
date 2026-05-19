import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  const { id: goal_id, stageId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { title, if_then, due_date } = body;
  if (!title) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Verify ownership
  const { data: goal } = await admin
    .from("goals").select("id").eq("id", goal_id).eq("user_id", session.user.id).single();
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  const { data: action, error } = await admin
    .from("goal_actions")
    .insert({ stage_id: stageId, title, if_then: if_then || null, due_date: due_date || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(action, { status: 201 });
}
