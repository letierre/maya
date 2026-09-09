import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe, priceIdFor, type Plan } from "@/lib/stripe";

// POST /api/stripe/checkout — cria uma sessão de Checkout (cobrança imediata, sem trial).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { plan } = await req.json();
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const stripe = getStripe();
  const admin = getSupabaseAdmin();

  // Reaproveita o customer existente (evita duplicar cliente no Stripe em re-assinatura)
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const stripeCustomerId = existing?.stripe_customer_id ?? null;

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(plan as Plan), quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: user.email || undefined }),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/assinar`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("POST /api/stripe/checkout error:", error);
    return NextResponse.json(
      { error: "Erro ao criar checkout", detail: String(error) },
      { status: 500 }
    );
  }
}
