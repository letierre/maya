/**
 * Constantes canônicas usadas pela Maya (persona, sinais, nudge).
 * Fonte única — evita deriva de thresholds entre os módulos.
 */

// Humores considerados "negativos" (a pessoa marcou algum destes).
export const NEGATIVE_MOODS = new Set([
  "ansiosa", "triste", "cansada", "sobrecarregada", "irritada", "frustrada",
]);

// Sono: qualidade < 3 OU duração < 360min (6h) = dormiu mal.
export const SLEEP_QUALITY_MIN = 3;
export const SLEEP_MIN_MINUTES = 360;

// Hidratação: meta de 4 copos = 1L.
export const WATER_GOAL_CUPS = 4;

// Alimentação: classificações consideradas "ruins" por refeição.
export const BAD_MEAL_CLASSIFICATIONS = new Set(["alta_acucar", "alta_gordura", "alta_sal"]);

// Meta ativa considerada "parada" após N dias sem atividade.
export const GOAL_STALE_DAYS = 7;

// Gastos do mês acima deste valor (R$) disparam alerta.
export const SPENDING_THRESHOLD = 80;
