import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

// Cache em memória (60s) — a API do Stripe é lenta e o painel é consultado
// poucas vezes; evita chamadas repetidas a cada reload.
let _cache: { at: number; data: unknown } | null = null;
const CACHE_TTL = 60_000;

function asMajor(unitAmountCents: number): number {
  return Math.round(unitAmountCents) / 100;
}

// Lista todas as assinaturas de um status (paginação automática), expandindo
// o price de cada item para ler amount/currency/interval.
async function listSubs(stripe: Stripe, status: string): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: Record<string, unknown> = { status, limit: 100, expand: ["data.items.data.price"] };
    if (startingAfter) params.starting_after = startingAfter;
    const res = await stripe.subscriptions.list(params as Stripe.SubscriptionListParams);
    out.push(...res.data);
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1].id;
    if (out.length >= 1000) break;
  }
  return out;
}

// GET /api/admin/revenue — MRR/ARPU/churn direto do Stripe (admin only)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const now = Date.now();
  if (_cache && now - _cache.at < CACHE_TTL) {
    return NextResponse.json(_cache.data);
  }

  try {
    const stripe = getStripe();

    const [active, canceled] = await Promise.all([
      listSubs(stripe, "active"),
      listSubs(stripe, "canceled"),
    ]);

    // MRR por moeda (plano anual vira equivalente mensal ÷12).
    const mrrCents: Record<string, number> = {};
    const activeByCurrency: Record<string, number> = {};
    for (const sub of active) {
      const price = (sub.items?.data?.[0] as { price?: Stripe.Price } | undefined)?.price;
      const unitCents = price?.unit_amount ?? 0;
      const currency = (price?.currency || "brl").toLowerCase();
      const interval = price?.recurring?.interval ?? "month";
      const monthlyCents = interval === "year" ? unitCents / 12 : unitCents;

      mrrCents[currency] = (mrrCents[currency] ?? 0) + monthlyCents;
      activeByCurrency[currency] = (activeByCurrency[currency] ?? 0) + 1;
    }

    const mrrByCurrency: Record<string, number> = {};
    for (const c of Object.keys(mrrCents)) mrrByCurrency[c] = Math.round(asMajor(mrrCents[c]) * 100) / 100;

    const arpuByCurrency: Record<string, number> = {};
    for (const c of Object.keys(activeByCurrency)) {
      arpuByCurrency[c] = activeByCurrency[c] ? Math.round((mrrByCurrency[c] / activeByCurrency[c]) * 100) / 100 : 0;
    }

    // Churn: cancelados nos últimos 30 dias + total.
    const thirtyDaysAgo = Date.now() / 1000 - 30 * 86400;
    let canceled30d = 0;
    for (const sub of canceled) {
      const at = (sub as { canceled_at?: number | null }).canceled_at ?? 0;
      if (at && at >= thirtyDaysAgo) canceled30d++;
    }

    const activeCount = active.length;
    const churnRate = activeCount + canceled30d > 0 ? +(canceled30d / (activeCount + canceled30d)).toFixed(3) : 0;

    // LTV (só moeda dominante BRL; sem FX para outras moedas).
    const brlArpu = arpuByCurrency["brl"] ?? 0;
    const ltv = churnRate > 0 && brlArpu > 0 ? Math.round(brlArpu / churnRate) : null;

    const data = {
      activeCount,
      mrrByCurrency,
      activeByCurrency,
      arpuByCurrency,
      canceledTotal: canceled.length,
      canceled30d,
      churnRate,
      ltv,
      fetchedAt: new Date().toISOString(),
    };

    _cache = { at: now, data };
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/admin/revenue error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar Stripe", detail: String(error) },
      { status: 500 }
    );
  }
}
