import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe, priceIdFor, type Plan } from "@/lib/stripe";

// POST /api/stripe/checkout — cria uma sessão de Checkout (assinatura com 7 dias de trial).
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

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(plan as Plan), quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: user.id, plan },
      },
      customer_email: user.email || undefined,
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
