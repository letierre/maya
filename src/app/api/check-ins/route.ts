import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    const admin = getSupabaseAdmin();

    if (date) {
      const { data, error } = await admin
        .from("check_ins")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return NextResponse.json(data || null);
    }

    const { data, error } = await admin
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/check-ins error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar check-ins", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const today = getLocalDate();
    const row = {
      user_id: user.id,
      date: body.date || today,
      felt_judged: body.felt_judged ?? false,
      took_medication: body.took_medication ?? false,
      talked_to_someone: body.talked_to_someone ?? false,
      meditation_prayer_breathing: body.meditation_prayer_breathing ?? false,
      creative_activity: body.creative_activity ?? false,
      ate_well: body.ate_well ?? false,
      bowel_movement: body.bowel_movement ?? false,
      exercise_walk: body.exercise_walk ?? false,
      water_cups: body.water_cups ?? 0,
      drank_water: body.water_cups !== undefined ? body.water_cups >= 4 : (body.drank_water ?? false),
      slept_well: body.slept_well ?? false,
      suicidal_thoughts: body.suicidal_thoughts ?? false,
      did_something_enjoyable: body.did_something_enjoyable ?? false,
      worked_on_goals: body.worked_on_goals ?? false,
      feeling: body.feeling ?? "",
      mood_tags: body.mood_tags ?? [],
      gratitude: body.gratitude ?? "",
      gratitude_photos: body.gratitude_photos ?? [],
    };

    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", row.date)
      .limit(1)
      .single();

    if (existing) {
      const { data: updated, error } = await admin
        .from("check_ins")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json(updated);
    }

    const { data: created, error } = await admin
      .from("check_ins")
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/check-ins error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar check-in", detail: String(error) },
      { status: 500 }
    );
  }
}
