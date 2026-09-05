// Helpers de mês (formato `YYYY-MM`) para o módulo de orçamento.
// Mantém a aritmética/comparação de meses num só lugar, sem mexer em datas cruas.

/** Soma `n` meses a um `YYYY-MM` (n pode ser negativo). */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

/** O mês `target` está dentro de [start, end]? (`end` null = sem limite superior). */
export function monthInRange(start: string, target: string, end: string | null): boolean {
  if (target < start) return false;
  if (end !== null && target > end) return false;
  return true;
}

/** Número de meses de `start` a `end`, inclusivo (start === end → 1). */
export function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}
