import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let { display_name, display_emoji } = await req.json();

  const admin = getSupabaseAdmin();
  const userId = user.id;

  // Load existing preferences
  const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", userId).maybeSingle();
  const ctx = { ...((prefs?.context as Record<string, unknown>) || {}) };

  // If no name set, generate a random anonymous name (e.g., Anônimo8472)
  if (!display_name || display_name === "Anônimo") {
    if (ctx.community_name && ctx.community_name !== "Anônimo") {
      display_name = ctx.community_name; // keep existing custom name
    } else {
      const rnd = Math.floor(1000 + Math.random() * 9000); // 1000-9999
      display_name = `Anônimo${rnd}`;
    }
  }

  ctx.community_name = display_name;
  ctx.community_emoji = display_emoji || null;

  // Preserve existing columns when upserting
  const existing = prefs || {};
  await admin.from("user_preferences").upsert({
    user_id: userId,
    context: ctx,
    enabled_questions: (existing as any).enabled_questions || [],
    onboarding_completed: (existing as any).onboarding_completed ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Update all existing posts and comments with new display name
  await admin.from("community_posts").update({ display_name, display_emoji: display_emoji || null }).eq("user_id", userId);
  await admin.from("community_comments").update({ display_name, display_emoji: display_emoji || null }).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
