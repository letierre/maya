import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { computeSignals } from "@/lib/signals";

// ── Types ──────────────────────────────────────────────────────────────

interface PlanInsight {
  id: string;
  priority: number; // 1=urgent, 2=attention, 3=suggestion
  message: string;
  action?: { label: string; href: string };
}

interface PlanMetrics {
  strongest: string;
  weakest: string;
  balance: number;    // 0–100, higher = more balanced
  variation: number;  // % change vs last week
}

// ── GET ─────────────────────────────────────────────────────────────────

// GET /api/maya/plan-insight?week=YYYY-MM-DD — insights do planejamento da semana
// (e métricas de equilíbrio), derivados do motor único de sinais da Maya.
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week") || undefined;

  try {
    // Profile (para saudação/concordância de gênero nos sinais que viram nudge).
    const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", user.id).single();
    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const userName = (user.user_metadata?.name as string) || "";
    const firstName = userName.split(" ")[0];
    const gender = (context.gender as string) || "nao_dizer";

    // Motor único: mesma fonte de sinais do care-list e do nudge.
    const { signals, plan } = await computeSignals(
      user.id,
      { firstName, gender },
      { weekStart: weekParam },
    );

    // Insights de planejamento (feed "plan"), top 3 por prioridade.
    const insights = signals
      .filter((s) => s.feed.includes("plan"))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map((s) => ({ id: s.id, priority: s.priority, message: s.description, action: s.action }));

    const metrics: PlanMetrics = plan ?? { strongest: "—", weakest: "—", balance: 50, variation: 0 };

    return NextResponse.json({ insights, metrics });
  } catch (error) {
    console.error("GET /api/maya/plan-insight error:", error);
    return NextResponse.json({ insights: [], metrics: { strongest: "—", weakest: "—", balance: 50, variation: 0 } });
  }
}
