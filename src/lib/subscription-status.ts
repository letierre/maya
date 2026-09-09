/** true durante o trial ou com assinatura ativa. Trial local (sem cartão) expira quando `trial_ends_at` passa. */
export function isSubscriptionActive(status: string | null | undefined, trialEndsAt?: string | null): boolean {
  if (status === "active") return true;
  if (status === "trialing") {
    if (!trialEndsAt) return true; // trialing sem data (legado) permanece ativo
    return new Date(trialEndsAt).getTime() > Date.now();
  }
  return false;
}
