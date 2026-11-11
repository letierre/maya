import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Agregados de todas as corridas do usuário (records + totais) — sem trazer
// as coordenadas, para ser leve mesmo com muito histórico.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("running_sessions")
    .select("distance_meters, duration_seconds, avg_pace")
    .eq("user_id", user.id)
    .not("end_time", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  let totalDist = 0, bestDist = 0, bestPace = 0, longest = 0;
  for (const r of rows) {
    const d = r.distance_meters || 0;
    totalDist += d;
    if (d > bestDist) bestDist = d;
    if (r.avg_pace && (bestPace === 0 || r.avg_pace < bestPace)) bestPace = r.avg_pace;
    if (r.duration_seconds > longest) longest = r.duration_seconds;
  }

  return NextResponse.json({
    total_runs: rows.length,
    total_distance_m: Math.round(totalDist),
    best_distance_m: Math.round(bestDist),
    best_pace: Math.round(bestPace),
    longest_duration: longest,
  });
}
