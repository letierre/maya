import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; krId: string }> }
) {
  const { id, krId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Verify ownership via parent cycle
  const { data: cycle } = await admin
    .from("quarterly_cycles")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!cycle) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };

  // Auto-complete if current >= target
  if (body.current !== undefined) {
    const { data: existing } = await admin
      .from("key_results")
      .select("target")
      .eq("id", krId)
      .single();

    if (existing && body.current >= existing.target) {
      updates.status = "completed";
    }
  }

  const { data: kr, error } = await admin
    .from("key_results")
    .update(updates)
    .eq("id", krId)
    .select()
    .single();

  if (error || !kr) return NextResponse.json({ error: error?.message }, { status: 500 });

  return NextResponse.json(kr);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; krId: string }> }
) {
  const { id, krId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Verify ownership via parent cycle
  const { data: cycle } = await admin
    .from("quarterly_cycles")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!cycle) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const { error } = await admin
    .from("key_results")
    .delete()
    .eq("id", krId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
