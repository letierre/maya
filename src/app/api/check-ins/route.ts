import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate, getTimezoneOffset } from "@/lib/utils";
import { ateWellFromMeals } from "@/lib/meal-utils";
import { analyzeAllSpecialists } from "@/lib/specialists";
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
      meditation: body.meditation ?? false,
      prayer: body.prayer ?? false,
      breathing: body.breathing ?? false,
      // Legado: agregado "fez qualquer um" derivado dos campos granulares
      meditation_prayer_breathing:
        (body.meditation ?? false) || (body.prayer ?? false) || (body.breathing ?? false) ||
        (body.meditation_prayer_breathing ?? false),
      creative_activity: body.creative_activity ?? false,
      ate_well: body.ate_well ?? false,
      bowel_movement: body.bowel_movement ?? false,
      walked: body.walked ?? false,
      ran: body.ran ?? false,
      strength_training: body.strength_training ?? false,
      read: body.read ?? false,
      // Legado: agregado "fez qualquer um" derivado dos campos granulares
      exercise_walk:
        (body.walked ?? false) || (body.ran ?? false) || (body.strength_training ?? false) ||
        (body.exercise_walk ?? false),
      water_cups: body.water_cups ?? 0,
      drank_water: body.water_cups !== undefined ? body.water_cups >= 4 : (body.drank_water ?? false),
      slept_well: body.slept_well ?? false,
      suicidal_thoughts: body.suicidal_thoughts ?? false,
      did_something_enjoyable: body.did_something_enjoyable ?? false,
      worked_on_goals: body.worked_on_goals ?? false, // será recalculado abaixo
      feeling: body.feeling ?? "",
      mood_tags: body.mood_tags ?? [],
      gratitude: body.gratitude ?? "",
      gratitude_photos: body.gratitude_photos ?? [],
    };

    const admin = getSupabaseAdmin();

    // ── Auto-detect "trabalhou nas metas" ──────────────────────────
    // Check if user completed any goal-related tasks today
    const checkDate = row.date;
    const todayDow = new Date(checkDate + "T12:00:00").getDay();
    const monDow = todayDow === 0 ? 6 : todayDow - 1; // 0=Mon..6=Sun

    const [planRes, agendaRes, actionsRes, runningRes, readingRes, mealsRes, sleepRes] = await Promise.all([
      // Weekly plan tasks completed today
      admin.from("weekly_tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("day_of_week", monDow)
        .eq("status", "concluida")
        .limit(1),
      // Agenda items linked to goals, completed today
      admin.from("agenda_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "concluida")
        .eq("date", checkDate)
        .not("linked_goal_id", "is", null)
        .limit(1),
      // Goal actions completed today (via updated_at)
      admin.from("goal_actions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "concluida")
        .gte("updated_at", `${checkDate}T00:00:00`)
        .lte("updated_at", `${checkDate}T23:59:59`)
        .limit(1),
      // Corrida registrada hoje (auto-marca "correu")
      admin.from("running_sessions")
        .select("id")
        .eq("user_id", user.id)
        .gte("start_time", `${checkDate}T00:00:00${getTimezoneOffset("America/Sao_Paulo", checkDate)}`)
        .lte("start_time", `${checkDate}T23:59:59${getTimezoneOffset("America/Sao_Paulo", checkDate)}`)
        .limit(1),
      // Leitura registrada hoje (auto-marca "leu")
      admin.from("reading_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", checkDate)
        .limit(1),
      // Refeições do dia (auto-detecta "comeu bem")
      admin.from("meals")
        .select("macros, status_analise, classificacao")
        .eq("user_id", user.id)
        .gte("data_hora", `${checkDate}T00:00:00${getTimezoneOffset("America/Sao_Paulo", checkDate)}`)
        .lte("data_hora", `${checkDate}T23:59:59${getTimezoneOffset("America/Sao_Paulo", checkDate)}`),
      // Sono do dia (auto-detecta "dormiu bem")
      admin.from("sleep_logs")
        .select("quality")
        .eq("user_id", user.id)
        .eq("date", checkDate)
        .order("date", { ascending: false })
        .limit(1),
    ]);

    const workedOnGoals =
      (planRes.data?.length ?? 0) > 0 ||
      (agendaRes.data?.length ?? 0) > 0 ||
      (actionsRes.data?.length ?? 0) > 0;

    if (workedOnGoals) {
      row.worked_on_goals = true;
    }

    // Auto-marca "correu" quando há sessão de corrida no dia (independente do que o cliente enviou)
    if ((runningRes.data?.length ?? 0) > 0) {
      row.ran = true;
      row.exercise_walk = true;
    }

    // Auto-marca "leu" quando há sessão de leitura no dia
    if ((readingRes.data?.length ?? 0) > 0) {
      row.read = true;
    }

    // Auto-detecta "comeu bem" a partir das refeições do dia (fonte de verdade)
    if ((mealsRes.data?.length ?? 0) > 0) {
      row.ate_well = ateWellFromMeals((mealsRes.data ?? []) as any[]);
    }

    // Auto-detecta "dormiu bem" a partir do sono do dia (fonte de verdade)
    if ((sleepRes.data?.length ?? 0) > 0) {
      row.slept_well = (sleepRes.data?.[0]?.quality ?? 0) >= 3;
    }

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

      // Invalidate Maya nudge cache so next dashboard load reflects today's data
      await invalidateMayaNudgeCache(admin, user.id);
      // Fire-and-forget: refresh all specialist insights
      analyzeAllSpecialists(user.id).catch(() => {});

      return NextResponse.json(updated);
    }

    const { data: created, error } = await admin
      .from("check_ins")
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    // Invalidate Maya nudge cache so next dashboard load reflects today's data
    invalidateMayaNudgeCache(admin, user.id);
    // Fire-and-forget: refresh all specialist insights
    analyzeAllSpecialists(user.id).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/check-ins error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar check-in", detail: String(error) },
      { status: 500 }
    );
  }
}

// Clears the Maya nudge & home-message caches so the next dashboard load
// generates fresh messages reflecting the latest data.
async function invalidateMayaNudgeCache(
  admin: ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>,
  userId: string
) {
  try {
    const { data } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", userId)
      .single();
    if (!data) return;
    const ctx = { ...(data.context as Record<string, unknown>) };
    delete ctx.maya_nudge;
    delete ctx.maya_home_message;
    await admin.from("user_preferences").update({ context: ctx }).eq("user_id", userId);
  } catch {
    /* best-effort */
  }
}
