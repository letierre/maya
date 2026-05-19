import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: goal_id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { title, description, due_date } = body;
  if (!title) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Verify ownership
  const { data: goal } = await admin
    .from("goals")
    .select("id")
    .eq("id", goal_id)
    .eq("user_id", session.user.id)
    .single();
  if (!goal) return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });

  // Get next position
  const { count } = await admin
    .from("goal_stages")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goal_id);

  const { data: stage, error } = await admin
    .from("goal_stages")
    .insert({ goal_id, title, description: description || null, due_date: due_date || null, position: count ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(stage, { status: 201 });
}
