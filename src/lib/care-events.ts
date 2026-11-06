/**
 * Barramento de eventos (client-only) para avisar componentes que os dados
 * que alimentam os "sinais de cuidado" mudaram — ex.: check-in salvo, corrida,
 * sono ou refeição registrados. O CareList escuta e re-busca em tempo real.
 */

export const CARE_DATA_CHANGED = "maya:care-data-changed";

/** Dispara o evento. Seguro em SSR (no-op fora do browser). */
export function emitCareDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CARE_DATA_CHANGED));
}

/** Registra um listener e devolve a função de limpeza. */
export function onCareDataChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CARE_DATA_CHANGED, cb);
  return () => window.removeEventListener(CARE_DATA_CHANGED, cb);
}

export const RUN_LOCK_CHANGED = "maya:run-lock-changed";

/** Avisa a BottomNav global que a tela de corrida está travada (rodando em 1º plano). */
export function emitRunLockChanged(locked: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ locked: boolean }>(RUN_LOCK_CHANGED, { detail: { locked } }));
}

/** Registra um listener que recebe o estado do lock; devolve a função de limpeza. */
export function onRunLockChanged(cb: (locked: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<{ locked: boolean }>).detail?.locked === true);
  window.addEventListener(RUN_LOCK_CHANGED, handler);
  return () => window.removeEventListener(RUN_LOCK_CHANGED, handler);
}
