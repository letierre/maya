import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET /api/admin/onboarding — métricas das respostas do questionário de onboarding
// (tabela onboarding_responses). Agregados por resposta, sem PII (admin only).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin
    .from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const goal: Record<string, number> = {};
  const pains: Record<string, number> = {};
  const tinderAgreed: Record<string, number> = {};
  const areas: Record<string, number> = {};
  const language: Record<string, number> = {};
  const gender: Record<string, number> = {};
  const context = {
    has_medication: { sim: 0, nao: 0 },
    has_faith: { sim: 0, nao: 0 },
    has_creative_hobby: { sim: 0, nao: 0 },
    track_suicidal_thoughts: { sim: 0, nao: 0 },
  };
  let total = 0;

  try {
    const { data } = await admin.from("onboarding_responses").select("*");
    for (const r of data ?? []) {
      total++;

      if (typeof r.goal === "string" && r.goal) goal[r.goal] = (goal[r.goal] ?? 0) + 1;
      for (const p of (Array.isArray(r.pain_points) ? r.pain_points : [])) pains[p] = (pains[p] ?? 0) + 1;
      for (const t of (Array.isArray(r.tinder_agreed) ? r.tinder_agreed : [])) tinderAgreed[t] = (tinderAgreed[t] ?? 0) + 1;
      for (const a of (Array.isArray(r.area_preferences) ? r.area_preferences : [])) areas[a] = (areas[a] ?? 0) + 1;

      if (typeof r.language === "string" && r.language) language[r.language] = (language[r.language] ?? 0) + 1;
      if (typeof r.gender === "string" && r.gender) gender[r.gender] = (gender[r.gender] ?? 0) + 1;

      const bump = (key: "has_medication" | "has_faith" | "has_creative_hobby" | "track_suicidal_thoughts") => {
        if (r[key] === true) context[key].sim++;
        else if (r[key] === false) context[key].nao++;
      };
      bump("has_medication");
      bump("has_faith");
      bump("has_creative_hobby");
      bump("track_suicidal_thoughts");
    }
  } catch {
    // tabela onboarding_responses pode não existir ainda — retorna zeros
  }

  return NextResponse.json({ total, goal, pains, tinderAgreed, areas, language, gender, context });
}
