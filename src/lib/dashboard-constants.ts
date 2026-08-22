import type { CheckIn } from "@/types";

export const HABIT_CHIP: Record<string, [string, (ci: CheckIn) => string]> = {
  took_medication:             ["💊", () => "Remédios"],
  talked_to_someone:           ["🗣️", () => "Conversa"],
  meditation_prayer_breathing: ["🧘", () => "Pausa"],
  meditation:                  ["🧘", () => "Meditou"],
  prayer:                      ["🙏", () => "Orou"],
  breathing:                   ["🌬️", () => "Respirou"],
  creative_activity:           ["🎨", () => "Criatividade"],
  ate_well:                    ["🍽️", () => "Comeu bem"],
  bowel_movement:              ["🚽", () => "Banheiro"],
  exercise_walk:               ["🏃", () => "Caminhou"],
  walked:                      ["🚶", () => "Caminhou"],
  ran:                         ["🏃", () => "Correu"],
  strength_training:           ["🏋️", () => "Musculação"],
  read:                        ["📖", () => "Leu"],
  slept_well:                  ["😴", () => "Sono"],
  did_something_enjoyable:     ["😊", () => "Gostou"],
  worked_on_goals:             ["🎯", () => "Metas"],
};

export const NEGATIVE_MOODS = new Set([
  "ansiosa", "triste", "cansada", "sobrecarregada", "irritada", "frustrada",
]);
