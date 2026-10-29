import { NextRequest, NextResponse } from "next/server";

// GET /api/checkout — recebe a atribuição do anúncio que o quiz repassa
// (fbp/fbc/fbclid + UTMs), captura IP/User-Agent do navegador e cria a sessão de
// Checkout. O plano é decidido DENTRO do Stripe (upsell mensal → anual), então só
// entra o preço mensal base. Tudo vai no `metadata` da sessão para o webhook
// `checkout.session.completed` montar o evento CAPI completo pra Oryen.
//
// Roda no Edge (runtime) e chama a API REST do Stripe via `fetch` em vez do SDK:
// o SDK é pesado e não roda no Edge. Isso elimina o cold start (~1–3s do Node
// serverless) e corta o import do SDK — o maior gargalo do fluxo quiz → checkout.

export const runtime = "edge";

const STRIPE_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

// Marco de carregamento do módulo — usado pra estimar o cold start (tempo entre o
// boot/isolate e a entrada do handler).
const MODULE_LOAD_TS = Date.now();

// Mesmo mapeamento de `priceIdFor` de @/lib/stripe, inlined pra não puxar o SDK
// (Node-only) no Edge.
function priceIdFor(plan: "monthly" | "annual"): string {
  return plan === "annual"
    ? process.env.STRIPE_PRICE_ANNUAL_ID || ""
    : process.env.STRIPE_PRICE_MONTHLY_ID || "";
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const coldStartMs = t0 - MODULE_LOAD_TS;

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
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 500);

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

  const origin = req.nextUrl.origin;

  // Corpo form-encoded (equivale 1:1 ao que o SDK envia). `adaptive_pricing`
  // cobra na moeda local do cliente (evita "moeda não suportada").
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("line_items[0][price]", price);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", `${origin}/checkout/success`);
  body.set("cancel_url", `${origin}/login`);
  body.set("adaptive_pricing[enabled]", "true");
  for (const [k, v] of Object.entries(metadata)) {
    body.set(`metadata[${k}]`, v);
  }

  try {
    const res = await fetch(STRIPE_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY || ""}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const totalMs = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      console.error(`[checkout] Stripe ${res.status}: ${text.slice(0, 300)}`);
      return NextResponse.json({ error: "Erro ao criar checkout" }, { status: 500 });
    }

    const data = (await res.json()) as { url?: string };
    const url = data.url;
    if (!url) {
      return NextResponse.json({ error: "Falha ao criar checkout" }, { status: 500 });
    }

    console.log(`[checkout] timing cold_start_ms=${coldStartMs} handler_ms=${totalMs}`);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("GET /api/checkout error:", error);
    return NextResponse.json(
      { error: "Erro ao criar checkout", detail: String(error) },
      { status: 500 }
    );
  }
}
