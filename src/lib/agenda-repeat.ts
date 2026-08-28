// Lógica de repetição da agenda (compartilhada entre o hub "dia" e o módulo
// de Análise). Mantém as regras num só lugar para que uma ocorrência isolada
// de um item repetido nunca afete a série inteira.

export interface AgendaRepeatFields {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM — distingue itens de mesmo título em horários diferentes
  end_time?: string | null; // HH:MM
  repeat_type?: string | null;
  repeat_until?: string | null; // YYYY-MM-DD — limite superior (inclusive) da série
  excluded?: boolean; // ocorrência isolada excluída ("apenas este")
}

/** Chave de ocorrência (data + título + horários). Dois compromissos de mesmo título
 *  em horários diferentes são ocorrências distintas, não duplicatas. */
export function occKey(item: { date: string; title: string; start_time?: string | null; end_time?: string | null }): string {
  return `${item.date}|${(item.title ?? "").toLowerCase().trim()}|${item.start_time ?? ""}|${item.end_time ?? ""}`;
}

/** Item que se repete (tem um repeat_type diferente de "none"). */
export function isRepeatingItem(item: AgendaRepeatFields): boolean {
  return !!item.repeat_type && item.repeat_type !== "none";
}

/** A regra de repetição gera uma ocorrência em `target`? (respeita repeat_until) */
export function repeatMatches(item: AgendaRepeatFields, target: string): boolean {
  if (!item.repeat_type || item.repeat_type === "none") return false;
  const orig = new Date(item.date + "T12:00:00");
  const tgt = new Date(target + "T12:00:00");
  if (tgt <= orig) return false; // não repete antes da data original
  if (item.repeat_until) {
    const until = new Date(item.repeat_until + "T12:00:00");
    if (tgt > until) return false; // série cortada a partir de repeat_until
  }
  switch (item.repeat_type) {
    case "daily": return true;
    case "weekly": return orig.getDay() === tgt.getDay();
    case "monthly": return orig.getDate() === tgt.getDate();
    case "weekdays": return tgt.getDay() >= 1 && tgt.getDay() <= 5;
    case "yearly":
      return orig.getDate() === tgt.getDate() && orig.getMonth() === tgt.getMonth();
    default: return false;
  }
}

/** Prioridade para deduplicar (date+title): excluída > avulsa > regra de repetição. */
function overridePriority(item: AgendaRepeatFields): number {
  if (item.excluded) return 2;
  return isRepeatingItem(item) ? 0 : 1;
}

/** Remove duplicatas com a mesma (data, título, horários), mantendo a ocorrência
 *  avulsa (concluída/excluída) no lugar da regra de repetição original naquela data. */
export function dedupeByDateTitle<T extends AgendaRepeatFields>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const it of items) {
    const key = occKey(it);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, it);
    } else if (overridePriority(it) > overridePriority(existing)) {
      byKey.set(key, it);
    }
  }
  return [...byKey.values()];
}

/** Prepara itens da agenda para contagem/exibição: remove ocorrências excluídas
 *  ("apenas este") e duplicatas (avulsa sobrepõe a regra de repetição). */
export function filterActiveAgenda<T extends AgendaRepeatFields>(items: T[]): T[] {
  return dedupeByDateTitle(items).filter((it) => !it.excluded);
}

/** Query string (title + horários) para o DELETE "excluir todos" de uma série.
 *  Incluir o horário evita apagar séries de mesmo título em horários diferentes. */
export function seriesDeleteParams(item: { title: string; start_time?: string | null; end_time?: string | null }): string {
  const p = new URLSearchParams({ title: item.title });
  if (item.start_time) p.set("start_time", item.start_time);
  if (item.end_time) p.set("end_time", item.end_time);
  return p.toString();
}
