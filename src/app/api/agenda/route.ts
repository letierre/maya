import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/agenda?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("agenda_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/agenda
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("agenda_items")
    .insert({
      user_id: user.id,
      title: body.title,
      item_type: body.item_type || "tarefa",
      date: body.date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      priority: body.priority || "importante_nao_urgente",
      emoji: body.emoji || null,
      status: "pendente",
      linked_goal_id: body.linked_goal_id || null,
      linked_action_id: body.linked_action_id || null,
      linked_weekly_task_id: body.linked_weekly_task_id || null,
      position: body.position || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/agenda — update status, title, etc.
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.status !== undefined) updates.status = body.status;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.emoji !== undefined) updates.emoji = body.emoji;
  if (body.date !== undefined) updates.date = body.date;
  if (body.item_type !== undefined) updates.item_type = body.item_type;
  if (body.position !== undefined) updates.position = body.position;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("agenda_items")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/agenda?id=...
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("agenda_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
