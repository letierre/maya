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

/** Check-in antigo que marcou exercício só no agregado legado (granular ficou false). */
export function isLegacyExercise(ci: {
  exercise_walk?: boolean;
  walked?: boolean;
  ran?: boolean;
  strength_training?: boolean;
}): boolean {
  return (
    ci.exercise_walk === true &&
    ci.walked !== true &&
    ci.ran !== true &&
    ci.strength_training !== true
  );
}

/** Check-in antigo que marcou pausa só no agregado legado (granular ficou false). */
export function isLegacyPause(ci: {
  meditation_prayer_breathing?: boolean;
  meditation?: boolean;
  prayer?: boolean;
  breathing?: boolean;
}): boolean {
  return (
    ci.meditation_prayer_breathing === true &&
    ci.meditation !== true &&
    ci.prayer !== true &&
    ci.breathing !== true
  );
}

const EXERCISE_KEYS = ["walked", "ran", "strength_training"];
const PAUSE_KEYS = ["meditation", "prayer", "breathing"];

type HabitCheckIn = {
  exercise_walk?: boolean;
  meditation_prayer_breathing?: boolean;
  walked?: boolean;
  ran?: boolean;
  strength_training?: boolean;
  meditation?: boolean;
  prayer?: boolean;
  breathing?: boolean;
};

/** Feitos/total dos hábitos habilitados, tratando o legado: exercício/pausa
 *  legados (só agregado) colapsam para 1 hábito, não 3. */
export function habitProgress(
  ci: HabitCheckIn,
  habitKeys: string[]
): { done: number; total: number } {
  const legacyExercise = isLegacyExercise(ci);
  const legacyPause = isLegacyPause(ci);
  const record = ci as unknown as Record<string, unknown>;

  let done = 0;
  let total = 0;
  let exerciseDone = false;
  let pauseDone = false;

  for (const k of habitKeys) {
    const isExercise = EXERCISE_KEYS.includes(k);
    const isPause = PAUSE_KEYS.includes(k);

    if (legacyExercise && isExercise) {
      if (!exerciseDone) {
        done += 1;
        total += 1;
        exerciseDone = true;
      }
      continue;
    }
    if (legacyPause && isPause) {
      if (!pauseDone) {
        done += 1;
        total += 1;
        pauseDone = true;
      }
      continue;
    }

    total += 1;
    if (record[k] === true) done += 1;
  }

  return { done, total };
}
