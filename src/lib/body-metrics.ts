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
