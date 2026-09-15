"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

async function onboardingComplete(): Promise<boolean> {
  try {
    const res = await fetch("/api/preferences");
    const data = await res.json();
    return Boolean(data?.onboarding_completed);
  } catch {
    return true; // em caso de erro, não bloqueia o usuário
  }
}

async function fetchActive(attempt = 0): Promise<boolean> {
  try {
    const res = await fetch("/api/subscription");
    const data = await res.json();
    if (data?.isActive) return true;
    // O webhook pode levar ~1s pra gravar após o pagamento — retenta antes de bloquear.
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchActive(attempt + 1);
    }
    return false;
  } catch {
    return true; // em caso de erro, não bloqueia o usuário
  }
}

/** Redireciona para /onboarding se o onboarding não foi concluído, ou para
 * /assinar quando não há assinatura ativa (fora do trial). */
export function SubscriptionGate() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Quem ainda não terminou o onboarding volta pro questionário — sem isso,
      // cai direto no paywall e fica preso sem trial.
      const done = await onboardingComplete();
      if (cancelled) return;
      if (!done) {
        router.replace("/onboarding");
        return;
      }

      const active = await fetchActive();
      if (cancelled) return;
      if (!active) router.replace("/assinar");
    })();
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
