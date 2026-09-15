import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ── Preços Anthropic (USD por 1M tokens) — set/2026 ────────────────────
// Haiku 4.5 = $1/$5 · Sonnet 5 = $2/$10 · Opus = $5/$25.
// Se os preços mudarem, ajuste AQUI — é o único lugar.
const PRICE_PER_MTok: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
};

export function modelFamily(model?: string | null): string {
  const m = (model ?? "").toLowerCase();
  if (m.includes("opus")) return "claude-opus-5";
  if (m.includes("sonnet")) return "claude-sonnet-5";
  return "claude-haiku-4-5"; // default
}

export function costUsd(model: string | null | undefined, inputTokens: number, outputTokens: number): number {
  const p = PRICE_PER_MTok[modelFamily(model)];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export interface AiUsageLog {
  userId?: string | null;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Grava o uso de IA (fire-and-forget) — nunca bloqueia nem derruba a chamada.
// Se a tabela ai_usage ainda não existir (migration 057), falha em silêncio.
export function logAiUsage(log: AiUsageLog): void {
  if (!log.userId) return;
  void (async () => {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("ai_usage").insert({
        user_id: log.userId,
        feature: log.feature,
        model: log.model,
        input_tokens: log.inputTokens,
        output_tokens: log.outputTokens,
      });
    } catch { /* telemetria nunca derruba o app */ }
  })();
}
