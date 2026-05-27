import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getLocalDate } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import { analyzeAllSpecialists, getLatestInsights, generateMayaNudge } from "@/lib/specialists";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = getLocalDate();

  try {
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const lang: Lang = (prefs?.context?.language as Lang) || "pt";
    const userName =
      (user.user_metadata?.name as string) ||
      (prefs?.context?.name as string) ||
      "";
    const gender = (prefs?.context?.gender as string) || "nao_dizer";

    // Check if user has any check-ins (new user detection)
    const { data: checkIns } = await admin
      .from("check_ins")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1);

    // New user — no check-ins at all → welcome message (no AI)
    if (!checkIns || checkIns.length === 0) {
      return NextResponse.json({
        nudges: [{ id: "boas_vindas", message: t(lang, "nudge_boas_vindas") }],
      });
    }

    // Check if user did check-in today (to inform Maya's tone)
    const hasTodayCheckIn = checkIns[0]?.date === today;

    // Try to get cached insights from today (or yesterday)
    let insights = await getLatestInsights(user.id);

    // If no recent insights, run full analysis now
    if (!insights) {
      try {
        insights = await analyzeAllSpecialists(user.id);
      } catch (err) {
        console.error("Specialist analysis failed:", err);
        // Fall back to a simple non-AI nudge if analysis fails
        const message = hasTodayCheckIn
          ? t(lang, "nudge_streak")
          : t(lang, "nudge_checkin_miss_nofeel");
        return NextResponse.json({ nudges: [{ id: "fallback", message }] });
      }
    }

    // Generate personalized Maya nudge from insights
    const message = await generateMayaNudge(insights, userName, gender);

    return NextResponse.json({
      nudges: [{ id: "maya_personal", message }],
    });
  } catch (error) {
    console.error("GET /api/maya/nudge error:", error);
    return NextResponse.json({ nudges: [] });
  }
}
