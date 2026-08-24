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
