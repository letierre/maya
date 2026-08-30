import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSubscriptionActive } from "@/lib/stripe";

// GET /api/subscription — status da assinatura do usuário logado.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({
      plan: null,
      status: "none",
      trialEndsAt: null,
      currentPeriodEnd: null,
      isActive: false,
    });
  }

  return NextResponse.json({
    plan: sub.plan,
    status: sub.status,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    isActive: isSubscriptionActive(sub.status),
  });
}
