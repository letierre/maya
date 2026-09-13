import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { computeCareSignals } from "@/lib/care-signals";
import { NextResponse } from "next/server";

// GET /api/maya/care-list — top 3 sinais priorizados de "o que cuidar".
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", user.id).maybeSingle();
    const lang = ((prefs?.context as { language?: string } | undefined)?.language as string) || "pt";

    const signals = await computeCareSignals(user.id, lang);
    return NextResponse.json({ items: signals.slice(0, 3) });
  } catch (error) {
    console.error("GET /api/maya/care-list error:", error);
    return NextResponse.json({ items: [] });
  }
}
