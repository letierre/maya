// "Pular" agora conta como "não fez": todo hábito habilitado entra no score.
// A coluna `answered_questions` foi descontinuada. Estas funções preservam a
// assinatura usada nos consumers, mas retornam "tudo conta".

/** Todo hábito habilitado conta no score (pular = não fez). */
export function answeredKeys(_ci: unknown, keys: string[]): string[] {
  return keys;
}

/** Todo hábito é tratado como "respondido" (pular = não fez). */
export function habitAnswered(_ci: unknown, _key: string): boolean {
  return true;
}
