export type BodySex = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type BodyGoal = "lose" | "maintain" | "gain";

export interface BodyData {
  sex?: BodySex;
  birth_date?: string; // YYYY-MM-DD
  weight_kg?: number;
  height_cm?: number;
  body_fat_pct?: number;
  neck_cm?: number;
  chest_cm?: number;
  waist_cm?: number;
  hip_cm?: number;
  arm_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
  activity_level?: ActivityLevel;
  goal?: BodyGoal;
}

// Um lançamento no histórico de medidas (tabela body_measurements).
export interface Measurement {
  id?: string;
  recorded_at?: string; // ISO timestamp
  weight_kg?: number | null;
  height_cm?: number | null;
  body_fat_pct?: number | null;
  neck_cm?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
  calf_cm?: number | null;
  activity_level?: ActivityLevel | null;
  goal?: BodyGoal | null;
}

// Campos que mudam ao longo do tempo (entram no histórico). Sexo e data de
// nascimento são dados fixos e ficam fora desta lista.
export const MEASUREMENT_FIELDS = [
  "weight_kg", "height_cm", "body_fat_pct",
  "neck_cm", "chest_cm", "waist_cm", "hip_cm", "arm_cm", "thigh_cm", "calf_cm",
  "activity_level", "goal",
] as const;

// Fatores de atividade (multiplicador sobre o metabolismo basal)
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function computeAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

export function computeBMI(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

// Mifflin-St Jeor: metabolismo basal (TMB) em kcal/dia
export function computeBMR(
  sex: BodySex | undefined,
  weightKg?: number,
  heightCm?: number,
  age?: number | null,
): number | null {
  if (!weightKg || !heightCm || !age || age <= 0) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "female" ? -161 : 5));
}

export function computeTDEE(bmr?: number | null, activity?: ActivityLevel): number | null {
  if (!bmr) return null;
  return Math.round(bmr * ACTIVITY_FACTORS[activity || "sedentary"]);
}

// Classificação do IMC (OMS)
export function bmiClass(bmi: number): "baixo" | "normal" | "sobrepeso" | "obesidade" {
  if (bmi < 18.5) return "baixo";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "sobrepeso";
  return "obesidade";
}

// Estimativa de gordura corporal pela fórmula US Navy (circunferências em cm).
// - homem:  usa pescoço + cintura + altura
// - mulher: usa pescoço + cintura + quadril + altura
// Retorna null quando faltam as medidas necessárias ou o valor é incoerente.
export function computeBodyFatNavy(
  sex: BodySex | undefined,
  heightCm?: number | null,
  waistCm?: number | null,
  neckCm?: number | null,
  hipCm?: number | null,
): number | null {
  if (!heightCm || !waistCm || !neckCm || heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;
  const clamp = (v: number) => Math.min(60, Math.max(2, Math.round(v * 10) / 10));
  if (sex === "female") {
    if (!hipCm || hipCm <= 0) return null;
    const v = 163.205 * Math.log10(waistCm + hipCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
    return clamp(v);
  }
  const v = 86.010 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
  return clamp(v);
}
