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

// A migration 035 dividiu os hábitos de exercício/pausa em campos granulares
// (walked/ran/strength_training e meditation/prayer/breathing) SEM backfill.
// Para check-ins antigos os granulares ficam `false` e só o agregado legado
// (`exercise_walk` / `meditation_prayer_breathing`) guarda a resposta. Estas
// funções unificam a leitura para "fez qualquer um", cobrindo ambos os casos.

/** Fez qualquer exercício (caminhada, corrida ou musculação), novo ou legado. */
export function didExercise(ci: {
  exercise_walk?: boolean;
  walked?: boolean;
  ran?: boolean;
  strength_training?: boolean;
}): boolean {
  return (
    ci.exercise_walk === true ||
    ci.walked === true ||
    ci.ran === true ||
    ci.strength_training === true
  );
}

/** Fez qualquer pausa (meditação, oração ou respiração), novo ou legado. */
export function didPause(ci: {
  meditation_prayer_breathing?: boolean;
  meditation?: boolean;
  prayer?: boolean;
  breathing?: boolean;
}): boolean {
  return (
    ci.meditation_prayer_breathing === true ||
    ci.meditation === true ||
    ci.prayer === true ||
    ci.breathing === true
  );
}
