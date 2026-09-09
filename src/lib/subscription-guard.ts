import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSubscriptionActive } from "@/lib/stripe";

/** true durante o trial local (sem cartão) ou com assinatura ativa. */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  return isSubscriptionActive(sub?.status ?? null, sub?.trial_ends_at ?? null);
}

/** Resposta 403 padrão para rotas de API que exigem assinatura ativa. */
export function subscriptionRequired() {
  return NextResponse.json({ error: "Assinatura necessária" }, { status: 403 });
}
