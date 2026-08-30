import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// Mapeia uma Stripe.Subscription para a linha da tabela `subscriptions`.
function subscriptionRow(sub: Stripe.Subscription, plan: string) {
  return {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    // A API "dahlia" (2026-08) removeu current_period_end do objeto Subscription
    // (o período agora vem em `billing_schedules`). Deixamos null por ora — o gate usa só `status`.
    current_period_end: null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
}

// POST /api/stripe/webhook — recebe eventos do Stripe e sincroniza a assinatura.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || "", webhookSecret);
  } catch (error) {
    console.error("Webhook assinatura inválida:", error);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const subId = typeof session.subscription === "string" ? session.subscription : null;
        if (!userId || !subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await admin.from("subscriptions").upsert(
          { user_id: userId, ...subscriptionRow(sub, session.metadata?.plan || "monthly") },
          { onConflict: "user_id" }
        );
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.user_id;
        let plan = sub.metadata?.plan || "monthly";
        if (!userId) {
          const { data: existing } = await admin
            .from("subscriptions")
            .select("user_id, plan")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();
          if (!existing) break;
          userId = existing.user_id;
          plan = existing.plan || plan;
        }
        await admin.from("subscriptions").upsert(
          { user_id: userId, ...subscriptionRow(sub, plan) },
          { onConflict: "user_id" }
        );
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
