import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { detectNewAchievements } from "@/lib/achievements";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("user_achievements")
      .select("*")
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/achievements error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar conquistas", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: prefs } = await admin
      .from("user_preferences")
      .select("enabled_questions")
      .eq("user_id", user.id)
      .single();

    const { data: checkIns } = await admin
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const { data: existing } = await admin
      .from("user_achievements")
      .select("achievement_type, tier")
      .eq("user_id", user.id);

    const enabledKeys = prefs?.enabled_questions || [];
    const newAchievements = detectNewAchievements(
      checkIns || [],
      enabledKeys,
      existing || []
    );

    for (const a of newAchievements) {
      await admin.from("user_achievements").insert({
        user_id: user.id,
        achievement_type: a.type,
        tier: a.tier,
        metadata: { label: a.label, icon: a.icon },
      });
    }

    return NextResponse.json({
      new_achievements: newAchievements,
      total_unlocked: (existing?.length || 0) + newAchievements.length,
    });
  } catch (error) {
    console.error("POST /api/achievements error:", error);
    return NextResponse.json(
      { error: "Erro ao processar conquistas", detail: String(error) },
      { status: 500 }
    );
  }
}
