import { t as tFn, type Lang } from "@/lib/i18n";

// ── Pausa: Meditação & Respiração Consciente ─────────────────────────────
// Metadata das práticas/padrões + roteiros falados (voz da Maya). O texto real
// vive nas chaves i18n (pt/es/en) — buildScript monta o que vai ser sintetizado.

export type PracticeKind = "meditation" | "breathing";

export interface MeditationPractice {
  key: string;
  emoji: string;
  labelKey: string;
  introKey: string;
}

export interface BreathingPhase {
  inhale: number; // segundos
  hold1: number;
  exhale: number;
  hold2: number;
}

export interface BreathingPattern {
  key: string;
  emoji: string;
  labelKey: string;
  descKey: string;
  phases: BreathingPhase;
  introKey: string;
}

export const MEDITATION_PRACTICES: MeditationPractice[] = [
  { key: "breath", emoji: "🌬️", labelKey: "md_pratica_respiracao", introKey: "md_intro_respiracao" },
  { key: "body", emoji: "🧍", labelKey: "md_pratica_body", introKey: "md_intro_body" },
  { key: "kindness", emoji: "💗", labelKey: "md_pratica_bondade", introKey: "md_intro_bondade" },
  { key: "gratitude", emoji: "🙏", labelKey: "md_pratica_gratidao", introKey: "md_intro_gratidao" },
];

export const BREATHING_PATTERNS: BreathingPattern[] = [
  { key: "calm", emoji: "🌊", labelKey: "rb_padrao_calma", descKey: "rb_padrao_calma_desc", phases: { inhale: 4, hold1: 0, exhale: 6, hold2: 0 }, introKey: "rb_intro_calma" },
  { key: "box", emoji: "⬜", labelKey: "rb_padrao_caixa", descKey: "rb_padrao_caixa_desc", phases: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }, introKey: "rb_intro_caixa" },
  { key: "478", emoji: "🌙", labelKey: "rb_padrao_relaxar", descKey: "rb_padrao_relaxar_desc", phases: { inhale: 4, hold1: 7, exhale: 8, hold2: 0 }, introKey: "rb_intro_relaxar" },
];

export function getMeditationPractice(key: string): MeditationPractice | undefined {
  return MEDITATION_PRACTICES.find((p) => p.key === key);
}

export function getBreathingPattern(key: string): BreathingPattern | undefined {
  return BREATHING_PATTERNS.find((p) => p.key === key);
}

/** Monta o texto falado (intro + guia) para síntese de voz. */
export function buildScript(kind: PracticeKind, key: string, lang: Lang): string {
  if (kind === "meditation") {
    const p = getMeditationPractice(key);
    return p ? tFn(lang, p.introKey) : "";
  }
  const b = getBreathingPattern(key);
  return b ? tFn(lang, b.introKey) : "";
}
