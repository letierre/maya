// Helpers para distinguir hábito "respondido" de "pulado".
//
// A coluna `answered_questions` (text[] nullable) guarda apenas as chaves
// granulares que a pessoa de fato respondeu no check-in. `null` ou `[]` = check-in
// legado (anterior à coluna) → consideramos todos os hábitos como respondidos.
// Array não-vazio = só as chaves presentes contam; as demais foram puladas.

// Agregados "fez qualquer um" (derivados dos campos granulares) NÃO aparecem em
// answered_questions, então mapeamos o grupo para saber se foi respondido.
const GROUP_KEYS: Record<string, string[]> = {
  exercise_walk: ["walked", "ran", "strength_training"],
  meditation_prayer_breathing: ["meditation", "prayer", "breathing"],
};

// Aceita `CheckIn`, `Record<string, unknown>` ou `any` — basta ter a coluna.
type AnsweredLike = { answered_questions?: unknown };

/** Retorna as chaves respondidas como string[], ou null se não há array válido. */
function answeredArray(ci: AnsweredLike): string[] | null {
  const a = ci.answered_questions;
  if (!Array.isArray(a)) return null;
  return a.filter((x): x is string => typeof x === "string");
}

/** Check-in legado (sem answered_questions preenchido) → tudo conta como respondido. */
export function isLegacy(ci: AnsweredLike): boolean {
  const a = answeredArray(ci);
  return a === null || a.length === 0;
}

/** Dentre `keys`, retorna apenas as efetivamente respondidas (legado → todas). */
export function answeredKeys(ci: AnsweredLike, keys: string[]): string[] {
  const a = answeredArray(ci);
  if (a === null || a.length === 0) return keys;
  const set = new Set(a);
  return keys.filter((k) => set.has(k));
}

/**
 * Um hábito (ou grupo agregado) foi respondido no check-in? Legado → true.
 * Chaves agregadas (exercise_walk, meditation_prayer_breathing) contam como
 * respondidas se QUALQUER uma das chaves granulares do grupo estiver presente.
 */
export function habitAnswered(ci: AnsweredLike, key: string): boolean {
  const a = answeredArray(ci);
  if (a === null || a.length === 0) return true;
  const group = GROUP_KEYS[key];
  if (group) return group.some((k) => a.includes(k));
  return a.includes(key);
}
