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

    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const lang: Lang = (context.language as Lang) || "pt";
    const userName =
      (user.user_metadata?.name as string) ||
      (context.name as string) ||
      "";
    const gender = (context.gender as string) || "nao_dizer";

    // Check if user has any check-ins (new user detection)
    const { data: checkIns } = await admin
      .from("check_ins")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1);

    // New user — no check-ins → welcome message, no AI cost
    if (!checkIns || checkIns.length === 0) {
      return NextResponse.json({
        nudges: [{ id: "boas_vindas", message: t(lang, "nudge_boas_vindas") }],
      });
    }

    // ── Nudge cache ──────────────────────────────────────────────────────────
    // Regenerate only when: (1) new day, or (2) no cache exists yet today
    const cachedNudge = context.maya_nudge as { message: string; date: string } | undefined;

    if (cachedNudge?.date === today && cachedNudge.message) {
      return NextResponse.json({
        nudges: [{ id: "maya_personal", message: cachedNudge.message }],
      });
    }

    // ── Need a new nudge ─────────────────────────────────────────────────────

    const hasTodayCheckIn = checkIns[0]?.date === today;

    // Get or generate specialist insights
    let insights = await getLatestInsights(user.id);
    if (!insights) {
      try {
        insights = await analyzeAllSpecialists(user.id);
      } catch (err) {
        console.error("Specialist analysis failed:", err);
        const message = hasTodayCheckIn
          ? t(lang, "nudge_streak")
          : t(lang, "nudge_checkin_miss_nofeel");
        return NextResponse.json({ nudges: [{ id: "fallback", message }] });
      }
    }

    // Generate personalized nudge
    let message: string;
    try {
      message = await generateMayaNudge(insights, userName, gender);
    } catch (err) {
      console.error("Maya nudge generation failed:", err);
      const fallback = hasTodayCheckIn
        ? t(lang, "nudge_streak")
        : t(lang, "nudge_checkin_miss_nofeel");
      return NextResponse.json({ nudges: [{ id: "fallback", message: fallback }] });
    }

    // Persist nudge to cache (fire and forget — don't block the response)
    admin
      .from("user_preferences")
      .update({ context: { ...context, maya_nudge: { message, date: today } } })
      .eq("user_id", user.id)
      .then(() => {})
      .catch(() => {});

    return NextResponse.json({
      nudges: [{ id: "maya_personal", message }],
    });
  } catch (error) {
    console.error("GET /api/maya/nudge error:", error);
    return NextResponse.json({ nudges: [] });
  }
}
