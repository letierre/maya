import { createServerSupabaseClient } from "@/lib/supabase/server";
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
    const signals = await computeCareSignals(user.id);
    return NextResponse.json({ items: signals.slice(0, 3) });
  } catch (error) {
    console.error("GET /api/maya/care-list error:", error);
    return NextResponse.json({ items: [] });
  }
}
