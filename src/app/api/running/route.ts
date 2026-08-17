import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTimezoneOffset, getLocalDateFromISO } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const limit = parseInt(searchParams.get("limit") || "30");

  if (id) {
    const { data } = await admin.from("running_sessions").select("*").eq("id", id).eq("user_id", session.user.id).single();
    return NextResponse.json(data || null);
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const tz = searchParams.get("tz") || "America/Sao_Paulo";
    let query = admin.from("running_sessions").select("*").eq("user_id", session.user.id);
    if (from) query = query.gte("start_time", `${from}T00:00:00${getTimezoneOffset(tz, from)}`);
    if (to) query = query.lte("start_time", `${to}T23:59:59${getTimezoneOffset(tz, to)}`);
    query = query.order("start_time", { ascending: false }).limit(500);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  const { data, error } = await admin.from("running_sessions").select("*").eq("user_id", session.user.id).order("start_time", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Save completed session
  if (body.end_time) {
    const { data, error } = await admin.from("running_sessions").insert({
      user_id: session.user.id,
      start_time: body.start_time,
      end_time: body.end_time,
      distance_meters: body.distance_meters || 0,
      duration_seconds: body.duration_seconds || 0,
      avg_pace: body.avg_pace || null,
      max_speed: body.max_speed || null,
      calories_estimate: body.calories_estimate || null,
      route_coordinates: body.route_coordinates || [],
      notes: body.notes || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-marca "correu" no check-in do dia (só atualiza se a linha já existir)
    const runDate = getLocalDateFromISO(body.start_time);
    const { data: existingCi } = await admin
      .from("check_ins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("date", runDate)
      .maybeSingle();
    if (existingCi) {
      await admin
        .from("check_ins")
        .update({ ran: true, exercise_walk: true, updated_at: new Date().toISOString() })
        .eq("id", existingCi.id);
    }

    return NextResponse.json(data, { status: 201 });
  }

  // Start session — just return OK, full save comes later
  return NextResponse.json({ ok: true, sessionId: null });
}

// PATCH — update active session
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("running_sessions").update(updates).eq("id", id).eq("user_id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove uma sessão (confirmação é feita no cliente)
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("running_sessions").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
