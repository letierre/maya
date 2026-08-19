import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTimezoneOffset, getLocalDateFromISO } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

// Marca "correu" + exercício no check-in do dia (só se a linha já existir)
async function markRanCheckIn(admin: any, userId: string, startTime: string) {
  const runDate = getLocalDateFromISO(startTime);
  const { data: existingCi } = await admin
    .from("check_ins")
    .select("id")
    .eq("user_id", userId)
    .eq("date", runDate)
    .maybeSingle();
  if (existingCi) {
    await admin
      .from("check_ins")
      .update({ ran: true, exercise_walk: true, updated_at: new Date().toISOString() })
      .eq("id", existingCi.id);
  }
}

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

  // Sessão ativa (em andamento) — usada para restaurar após recarga/segundo plano
  const active = searchParams.get("active") === "1";
  if (active) {
    const { data, error } = await admin.from("running_sessions")
      .select("*").eq("user_id", session.user.id).is("end_time", null)
      .order("start_time", { ascending: false }).limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) {
    const tz = searchParams.get("tz") || "America/Sao_Paulo";
    let query = admin.from("running_sessions").select("*").eq("user_id", session.user.id).not("end_time", "is", null);
    if (from) query = query.gte("start_time", `${from}T00:00:00${getTimezoneOffset(tz, from)}`);
    if (to) query = query.lte("start_time", `${to}T23:59:59${getTimezoneOffset(tz, to)}`);
    query = query.order("start_time", { ascending: false }).limit(500);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  const { data, error } = await admin.from("running_sessions").select("*").eq("user_id", session.user.id).not("end_time", "is", null).order("start_time", { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Save completed session (fallback quando não há sessão ativa)
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
      map_snapshot: body.map_snapshot || null,
      notes: body.notes || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await markRanCheckIn(admin, session.user.id, body.start_time);
    return NextResponse.json(data, { status: 201 });
  }

  // Start session — cria a linha (end_time NULL) e retorna o id para os syncs
  const { data: started, error: startError } = await admin.from("running_sessions").insert({
    user_id: session.user.id,
    start_time: body.start_time || new Date().toISOString(),
    distance_meters: body.distance_meters || 0,
    duration_seconds: body.duration_seconds || 0,
    route_coordinates: body.route_coordinates || [],
  }).select().single();
  if (startError) return NextResponse.json({ error: startError.message }, { status: 500 });
  return NextResponse.json({ id: started.id }, { status: 201 });
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

  // Finalização (end_time) → marca "correu" no check-in do dia
  if (updates.end_time) {
    const { data: run } = await admin.from("running_sessions").select("start_time").eq("id", id).eq("user_id", session.user.id).single();
    if (run?.start_time) await markRanCheckIn(admin, session.user.id, run.start_time);
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove uma sessão e, se for a última corrida do dia, desmarca "correu" do check-in
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const userId = session.user.id;

  // Busca a data antes de excluir, para poder desmarcar o check-in do dia
  const { data: run } = await admin.from("running_sessions").select("start_time").eq("id", id).eq("user_id", userId).single();

  const { error } = await admin.from("running_sessions").delete().eq("id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (run?.start_time) {
    const runDate = getLocalDateFromISO(run.start_time);
    const offset = getTimezoneOffset("America/Sao_Paulo", runDate);

    // Se ainda existir outra corrida no mesmo dia, mantém o check-in marcado
    const { data: remaining } = await admin
      .from("running_sessions")
      .select("id")
      .eq("user_id", userId)
      .gte("start_time", `${runDate}T00:00:00${offset}`)
      .lte("start_time", `${runDate}T23:59:59${offset}`);

    if (remaining && remaining.length === 0) {
      const { data: ci } = await admin
        .from("check_ins")
        .select("id, walked, strength_training")
        .eq("user_id", userId)
        .eq("date", runDate)
        .maybeSingle();

      if (ci) {
        // "exercise_walk" é o agregado de caminhar/correr/musculação — só desmarca se nada mais foi feito
        const stillExercised = ci.walked === true || ci.strength_training === true;
        await admin
          .from("check_ins")
          .update({ ran: false, exercise_walk: stillExercised, updated_at: new Date().toISOString() })
          .eq("id", ci.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
