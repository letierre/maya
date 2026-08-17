export interface MoodChip {
  id: string;
  label: string;   // masculino / neutro
  labelF: string;  // feminino
  emoji: string;
  valence: "positive" | "negative";
}

export const MOOD_CHIPS: MoodChip[] = [
  // positivos
  { id: "feliz",         label: "Feliz",          labelF: "Feliz",          emoji: "😄", valence: "positive" },
  { id: "animada",       label: "Animado",        labelF: "Animada",        emoji: "✨", valence: "positive" },
  { id: "grata",         label: "Grato",          labelF: "Grata",          emoji: "🙏", valence: "positive" },
  { id: "tranquila",     label: "Tranquilo",      labelF: "Tranquila",      emoji: "😌", valence: "positive" },
  { id: "esperancosa",   label: "Esperançoso",    labelF: "Esperançosa",    emoji: "🌱", valence: "positive" },
  { id: "disposta",      label: "Disposto",       labelF: "Disposta",       emoji: "⚡", valence: "positive" },
  { id: "confiante",     label: "Confiante",      labelF: "Confiante",      emoji: "💪", valence: "positive" },
  { id: "aliviada",      label: "Aliviado",       labelF: "Aliviada",       emoji: "😮‍💨", valence: "positive" },
  // negativos
  { id: "cansada",       label: "Cansado",        labelF: "Cansada",        emoji: "😴", valence: "negative" },
  { id: "ansiosa",       label: "Ansioso",        labelF: "Ansiosa",        emoji: "😰", valence: "negative" },
  { id: "estressada",    label: "Estressado",     labelF: "Estressada",     emoji: "😫", valence: "negative" },
  { id: "triste",        label: "Triste",         labelF: "Triste",         emoji: "😢", valence: "negative" },
  { id: "irritada",      label: "Irritado",       labelF: "Irritada",       emoji: "😤", valence: "negative" },
  { id: "desanimada",    label: "Desanimado",     labelF: "Desanimada",     emoji: "😞", valence: "negative" },
  { id: "sobrecarregada",label: "Sobrecarregado", labelF: "Sobrecarregada", emoji: "🌊", valence: "negative" },
  { id: "raiva",         label: "Com raiva",      labelF: "Com raiva",      emoji: "😡", valence: "negative" },
  { id: "culpada",       label: "Culpado",        labelF: "Culpada",        emoji: "😔", valence: "negative" },
  { id: "exausta",       label: "Exausto",        labelF: "Exausta",        emoji: "🫠", valence: "negative" },
  { id: "entediada",     label: "Entediado",      labelF: "Entediada",      emoji: "🥱", valence: "negative" },
  { id: "solitaria",     label: "Solitário",      labelF: "Solitária",      emoji: "🫥", valence: "negative" },
];

export function getMoodLabel(chip: MoodChip, gender: string): string {
  return gender === "feminino" ? chip.labelF : chip.label;
}

export function getMoodById(id: string): MoodChip | undefined {
  return MOOD_CHIPS.find((m) => m.id === id);
}
