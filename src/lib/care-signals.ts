import { computeSignals, type Signal } from "@/lib/signals";

// ── Tipos (shape pública preservada para os consumidores existentes) ───────────

export type CareSignalTier = "biologico" | "fisico" | "emocional";

export interface CareSignal {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tier: CareSignalTier;
  /** Dias consecutivos abaixo do mínimo (sem teto — usado na descrição). */
  streak: number;
  /** Peso ranqueável = base × (1 + min(streak, teto)). */
  weight: number;
  action?: { label: string; href: string };
}

function toCareSignal(s: Signal): CareSignal {
  return {
    id: s.id,
    emoji: s.emoji,
    title: s.title,
    description: s.description,
    tier: s.tier as CareSignalTier,
    streak: s.streak,
    weight: s.weight,
    action: s.action,
  };
}

/**
 * Wrapper fino do motor único de sinais: devolve apenas o feed "care",
 * ranqueado por peso (maior primeiro). Mantém a assinatura antiga para não
 * quebrar `care-list`, `home-message` e `planning-companion`.
 */
export async function computeCareSignals(userId: string): Promise<CareSignal[]> {
  const { signals } = await computeSignals(userId);
  return signals
    .filter((s) => s.feed.includes("care"))
    .sort((a, b) => b.weight - a.weight)
    .map(toCareSignal);
}
