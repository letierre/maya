import { t } from "@/lib/i18n";
import { getLanguage } from "@/lib/language";

export interface MoodChip {
  id: string;
  labelKey: string;   // masculino / neutro
  labelKeyF: string;  // feminino
  emoji: string;
  valence: "positive" | "negative";
}

export const MOOD_CHIPS: MoodChip[] = [
  // positivos
  { id: "feliz",          labelKey: "mood_feliz",          labelKeyF: "mood_feliz",          emoji: "😄", valence: "positive" },
  { id: "animada",        labelKey: "mood_animado",        labelKeyF: "mood_animada",        emoji: "✨", valence: "positive" },
  { id: "grata",          labelKey: "mood_grato",          labelKeyF: "mood_grata",          emoji: "🙏", valence: "positive" },
  { id: "tranquila",      labelKey: "mood_tranquilo",      labelKeyF: "mood_tranquila",      emoji: "😌", valence: "positive" },
  { id: "esperancosa",    labelKey: "mood_esperancoso",    labelKeyF: "mood_esperancosa",    emoji: "🌱", valence: "positive" },
  { id: "disposta",       labelKey: "mood_disposto",       labelKeyF: "mood_disposta",       emoji: "⚡", valence: "positive" },
  { id: "confiante",      labelKey: "mood_confiante",      labelKeyF: "mood_confiada",       emoji: "💪", valence: "positive" },
  { id: "aliviada",       labelKey: "mood_aliviado",       labelKeyF: "mood_aliviada",       emoji: "😮‍💨", valence: "positive" },
  // negativos
  { id: "cansada",        labelKey: "mood_cansado",        labelKeyF: "mood_cansada",        emoji: "😴", valence: "negative" },
  { id: "ansiosa",        labelKey: "mood_ansioso",        labelKeyF: "mood_ansiosa",        emoji: "😰", valence: "negative" },
  { id: "estressada",     labelKey: "mood_estressado",     labelKeyF: "mood_estressada",     emoji: "😫", valence: "negative" },
  { id: "triste",         labelKey: "mood_triste",         labelKeyF: "mood_triste",         emoji: "😢", valence: "negative" },
  { id: "irritada",       labelKey: "mood_irritado",       labelKeyF: "mood_irritada",       emoji: "😤", valence: "negative" },
  { id: "desanimada",     labelKey: "mood_desanimado",     labelKeyF: "mood_desanimada",     emoji: "😞", valence: "negative" },
  { id: "sobrecarregada", labelKey: "mood_sobrecarregado", labelKeyF: "mood_sobrecarregada", emoji: "🌊", valence: "negative" },
  { id: "raiva",          labelKey: "mood_raiva",          labelKeyF: "mood_raiva",          emoji: "😡", valence: "negative" },
  { id: "culpada",        labelKey: "mood_culpado",        labelKeyF: "mood_culpada",        emoji: "😔", valence: "negative" },
  { id: "exausta",        labelKey: "mood_exausto",        labelKeyF: "mood_exausta",        emoji: "🫠", valence: "negative" },
  { id: "entediada",      labelKey: "mood_entediado",      labelKeyF: "mood_entediada",      emoji: "🥱", valence: "negative" },
  { id: "solitaria",      labelKey: "mood_solitario",      labelKeyF: "mood_solitaria",      emoji: "🫥", valence: "negative" },
];

export function getMoodLabel(chip: MoodChip, gender: string): string {
  const key = gender === "feminino" ? chip.labelKeyF : chip.labelKey;
  return t(getLanguage(), key);
}

export function getMoodById(id: string): MoodChip | undefined {
  return MOOD_CHIPS.find((m) => m.id === id);
}
