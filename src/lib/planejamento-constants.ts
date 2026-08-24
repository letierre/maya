import type { TaskArea } from "@/types";

// ── Áreas da vida ──────────────────────────────────────────────────────────

export const AREA_CONFIG: Record<TaskArea, { emoji: string; hue: number; labelKey: string }> = {
  saude:           { emoji: "💚", hue: 160, labelKey: "area_saude" },
  carreira:        { emoji: "💼", hue: 220, labelKey: "area_carreira" },
  financas:        { emoji: "💰", hue: 85,  labelKey: "area_financas" },
  relacionamentos: { emoji: "❤️", hue: 15,  labelKey: "area_relacionamentos" },
  desenvolvimento: { emoji: "🧠", hue: 270, labelKey: "area_desenvolvimento" },
  familia:         { emoji: "🏡", hue: 40,  labelKey: "area_familia" },
  lazer:           { emoji: "🌊", hue: 185, labelKey: "area_lazer" },
  espiritualidade: { emoji: "✨", hue: 300, labelKey: "area_espiritualidade" },
  outros:          { emoji: "⚪", hue: 200, labelKey: "area_outros" },
};

export const ALL_AREAS = Object.keys(AREA_CONFIG) as TaskArea[];

// As 8 áreas da vida (exclui "outros", removida da Roda da Vida)
export const LIFE_AREAS = ALL_AREAS.filter((a) => a !== "outros");

export const AREA_LABELS: Record<TaskArea, string> = {
  saude: "Saúde", carreira: "Carreira", financas: "Finanças",
  relacionamentos: "Relac.", desenvolvimento: "Mente", familia: "Família",
  lazer: "Lazer", espiritualidade: "Espirit.", outros: "Outros",
};

// ── Dias da semana ─────────────────────────────────────────────────────────

export const DAY_KEYS = ["dia_seg", "dia_ter", "dia_qua", "dia_qui", "dia_sex", "dia_sab", "dia_dom"];
export const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const DAY_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// ── Meses ──────────────────────────────────────────────────────────────────

export const MONTHS_SHORT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
export const MONTHS_LOWER = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

// ── Helpers de cor ─────────────────────────────────────────────────────────

export function ac(hue: number, l = 0.5, c = 0.12) { return `oklch(${l} ${c} ${hue})`; }
export function al(hue: number) { return `oklch(.95 .05 ${hue})`; }

// ── Input style padrão para modais ─────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
  background: "oklch(.98 .005 160)", fontFamily: "inherit",
  fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
};

// ── Helpers de data ────────────────────────────────────────────────────────

/** Retorna o label ex: "14 AGO – 20 AGO" para uma semana. */
export function weekRangeFromDate(baseDate?: string): string {
  const now = baseDate ? new Date(baseDate + "T12:00:00") : new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return `${fmt(mon)} – ${fmt(sun)}`;
}

/** Retorna segunda-feira de uma semana com offset (0=atual, 1=próxima, -1=anterior). */
export function getMondayForOffset(offset: number): string {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = d.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + daysToMonday + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Label compacto da semana (ex: "14 AGO – 20 AGO"). */
export function weekLabelForOffset(offset: number): string {
  const mon = getMondayForOffset(offset);
  return weekRangeFromDate(mon);
}

/** Dia da semana atual (0=Seg..6=Dom). */
export function todayDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

/** Dia em formato ISO (YYYY-MM-DD) a partir de offset de semana + dia. */
export function dateForWeekDay(offset: number, dow: number): string {
  const mon = getMondayForOffset(offset);
  const d = new Date(mon + "T12:00:00");
  d.setDate(d.getDate() + dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
