import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Singleton do cliente Stripe (server-only). */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  }
  return _stripe;
}

export type Plan = "monthly" | "annual";

/** Mapeia o plano para o Price ID configurado nas env vars. */
export function priceIdFor(plan: Plan): string {
  return plan === "annual"
    ? process.env.STRIPE_PRICE_ANNUAL_ID || ""
    : process.env.STRIPE_PRICE_MONTHLY_ID || "";
}

/** Fim do período da assinatura. A API "dahlia" (2026-08) removeu
 *  `current_period_end` do objeto Subscription — agora mora em cada item
 *  (`items.data[].current_period_end`). Retorna ISO ou null. */
export function periodEndFromSubscription(sub: Stripe.Subscription): string | null {
  const items = ((sub as unknown as { items?: { data?: Array<{ current_period_end?: number | null }> } }).items?.data ?? []) as Array<{ current_period_end?: number | null }>;
  const ts = items.reduce((max, it) => Math.max(max, it.current_period_end ?? 0), 0);
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// isSubscriptionActive vive em módulo puro (sem importar o SDK Stripe) para poder
// ser usado no middleware (edge). Reexportado aqui para manter a compatibilidade.
export { isSubscriptionActive } from "./subscription-status";
