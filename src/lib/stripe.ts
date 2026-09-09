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

// isSubscriptionActive vive em módulo puro (sem importar o SDK Stripe) para poder
// ser usado no middleware (edge). Reexportado aqui para manter a compatibilidade.
export { isSubscriptionActive } from "./subscription-status";
