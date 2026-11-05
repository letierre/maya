import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const DEFAULTS = { daily_goal_type: "minutes", daily_goal_value: 15 };

// GET /api/leitura/settings — meta diária do usuário
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("reading_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json(
      data
        ? { daily_goal_type: data.daily_goal_type, daily_goal_value: data.daily_goal_value }
        : DEFAULTS
    );
  } catch (error) {
    console.error("GET /api/leitura/settings error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar meta", detail: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/leitura/settings — atualizar meta diária
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const goalType = body.daily_goal_type === "pages" ? "pages" : "minutes";
    const goalValue = Math.max(1, Math.min(1000, Number(body.daily_goal_value) || 15));

    const { data, error } = await admin
      .from("reading_settings")
      .upsert(
        {
          user_id: user.id,
          daily_goal_type: goalType,
          daily_goal_value: goalValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      daily_goal_type: data.daily_goal_type,
      daily_goal_value: data.daily_goal_value,
    });
  } catch (error) {
    console.error("PATCH /api/leitura/settings error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar meta", detail: String(error) },
      { status: 500 }
    );
  }
}
