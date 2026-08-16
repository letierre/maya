// "Pular" agora conta como "não fez": todo hábito habilitado entra no score.
// A coluna `answered_questions` deixou de ser usada para scoring. Estas funções
// preservam a assinatura usada nos consumers (achievements, analise, histórico,
// Maya, analyzer), mas retornam "tudo conta". A remoção definitiva da coluna
// fica para a fase 2.

// Aceita `CheckIn`, `Record<string, unknown>` ou `any` — basta ter a coluna.
type AnsweredLike = { answered_questions?: unknown };

/** Todo hábito habilitado conta no score (pular = não fez). */
export function answeredKeys(_ci: AnsweredLike, keys: string[]): string[] {
  return keys;
}

/** Todo hábito é tratado como "respondido" (pular = não fez). */
export function habitAnswered(_ci: AnsweredLike, _key: string): boolean {
  return true;
}
