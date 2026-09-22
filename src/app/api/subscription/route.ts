import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, isSubscriptionActive, periodEndFromSubscription } from "@/lib/stripe";

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

  let status = sub.status as string;
  let trialEndsAt = sub.trial_ends_at as string | null;
  let currentPeriodEnd = sub.current_period_end as string | null;

  // Auto-reconciliação: se o status local não está ativo mas existe uma
  // assinatura no Stripe, busca o estado REAL e corrige o banco. Cobre falhas
  // de sincronização do webhook (ex.: assinatura ativa que ficou "trialing"/
  // "canceled" porque um evento de sub antiga sobrescreveu a linha).
  if (sub.stripe_subscription_id && !isSubscriptionActive(status, trialEndsAt)) {
    try {
      const stripe = getStripe();
      const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      status = live.status;
      trialEndsAt = live.trial_end ? new Date(live.trial_end * 1000).toISOString() : null;
      currentPeriodEnd = periodEndFromSubscription(live);
      await admin
        .from("subscriptions")
        .update({
          status,
          trial_ends_at: trialEndsAt,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch {
      // mantém o estado local se o Stripe falhar (não bloqueia o app por rede)
    }
  }

  return NextResponse.json({
    plan: sub.plan,
    status,
    trialEndsAt,
    currentPeriodEnd,
    isActive: isSubscriptionActive(status, trialEndsAt),
  });
}
