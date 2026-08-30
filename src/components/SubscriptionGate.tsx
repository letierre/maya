"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

/** Redireciona para /assinar quando não há assinatura ativa (fora do trial). */
export function SubscriptionGate() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchActive().then((active) => {
      if (!cancelled && !active) router.replace("/assinar");
    });
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
