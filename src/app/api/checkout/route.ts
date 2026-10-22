import { NextRequest, NextResponse } from "next/server";
import { getStripe, priceIdFor } from "@/lib/stripe";

// GET /api/checkout — recebe a atribuição do anúncio que o quiz repassa
// (fbp/fbc/fbclid + UTMs), captura IP/User-Agent do navegador e cria a sessão de
// Checkout. O plano é decidido DENTRO do Stripe (upsell mensal → anual), então só
// entra o preço mensal base. Tudo vai no `metadata` da sessão para o webhook
// `checkout.session.completed` montar o evento CAPI completo pra Oryen.
export async function GET(req: NextRequest) {
  const stripe = getStripe();
  const params = req.nextUrl.searchParams;

  const get = (k: string) => params.get(k)?.slice(0, 500) ?? "";

  const fbp = get("fbp");
  let fbc = get("fbc");
  const fbclid = get("fbclid");
  // Quiz sem pixel só repassa o fbclid → monta o cookie _fbc no formato do Meta.
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;

  const utm_source = get("utm_source");
  const utm_medium = get("utm_medium");
  const utm_campaign = get("utm_campaign");
  const utm_content = get("utm_content");

  // IP e User-Agent do visitante (esta requisição vem do navegador dele via redirect).
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  const userAgent = req.headers.get("user-agent") || "";

  // Plano escolhido na landing do quiz: "monthly" (padrão) ou "annual".
  const plan: "monthly" | "annual" = params.get("plan") === "annual" ? "annual" : "monthly";
  const price = priceIdFor(plan);
  if (!price) {
    return NextResponse.json({ error: "Preço não configurado para o plano" }, { status: 500 });
  }

  const metadata: Record<string, string> = {};
  if (fbp) metadata.fbp = fbp;
  if (fbc) metadata.fbc = fbc;
  if (fbclid) metadata.fbclid = fbclid;
  if (utm_source) metadata.utm_source = utm_source;
  if (utm_medium) metadata.utm_medium = utm_medium;
  if (utm_campaign) metadata.utm_campaign = utm_campaign;
  if (utm_content) metadata.utm_content = utm_content;
  if (ip) metadata.client_ip = ip;
  if (userAgent) metadata.client_user_agent = userAgent;

  // LOG TEMPORÁRIO — verificação do fluxo do quiz. Remove depois de validar.
  console.log(
    "[checkout] dados recebidos do quiz:",
    JSON.stringify({
      plan,
      fbp,
      fbc,
      fbclid,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      ip,
      userAgent,
    })
  );

  const origin = req.nextUrl.origin;

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Só o plano mensal nesta fase (sem upsell). adaptive_pricing cobra na
      // moeda local do cliente (evita "moeda não suportada").
      adaptive_pricing: { enabled: true },
      line_items: [{ price, quantity: 1 }],
      metadata,
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/assinar`,
    });

    if (!checkout.url) {
      return NextResponse.json({ error: "Falha ao criar checkout" }, { status: 500 });
    }
    return NextResponse.redirect(checkout.url);
  } catch (error) {
    console.error("GET /api/checkout error:", error);
    return NextResponse.json(
      { error: "Erro ao criar checkout", detail: String(error) },
      { status: 500 }
    );
  }
}
