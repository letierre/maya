export interface CheckIn {
  id: string;
  user_id: string;
  date: string;
  felt_judged: boolean;
  took_medication: boolean;
  talked_to_someone: boolean;
  meditation_prayer_breathing: boolean;
  creative_activity: boolean;
  ate_well: boolean;
  bowel_movement: boolean;
  exercise_walk: boolean;
  drank_water: boolean;
  water_cups: number;
  slept_well: boolean;
  suicidal_thoughts: boolean;
  did_something_enjoyable: boolean;
  worked_on_goals: boolean;
  feeling: string;
  mood_tags: string[];
  gratitude: string;
  gratitude_photos: string[];
  created_at: string;
  updated_at: string;
}

export type CheckInFormData = Omit<CheckIn, "id" | "user_id" | "created_at" | "updated_at">;

export interface CheckInStats {
  total_checkins: number;
  current_streak: number;
  best_streak: number;
  completion_rate_7d: number;
  completion_rate_30d: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  tier: number;
  unlocked_at: string;
  metadata: Record<string, unknown>;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  date: string;
  title: string;
  content: string;
  mood: number | null;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export type MealType = "cafe_da_manha" | "almoco" | "lanche" | "jantar" | "lanche_noturno";

export type MealClassification =
  | "equilibrada"
  | "leve_proteina"
  | "alta_acucar"
  | "alta_gordura"
  | "alta_sal"
  | "vegetais_baixo"
  | "nao_identificada";

export interface Macros {
  carboidratos_g: number;
  proteinas_g: number;
  gorduras_g: number;
  calorias_kcal: number;
}

export interface MealItem {
  nome: string;
  quantidade?: string;
}

export type MealAnalysisStatus = "pendente" | "analisado" | "falha";

export interface Meal {
  id: string;
  user_id: string;
  data_hora: string;
  tipo_refeicao: MealType;
  foto_path: string | null;
  fotos: string[];
  itens: MealItem[];
  macros: Macros | null;
  classificacao: MealClassification | null;
  observacao: string;
  texto_livre: string;
  status_analise: MealAnalysisStatus;
  criado_em: string;
}

export interface MealFormData {
  data_hora: string;
  tipo_refeicao: MealType;
  foto_path: string | null;
  fotos: string[];
  itens: MealItem[];
  macros: Macros | null;
  classificacao: MealClassification | null;
  observacao: string;
  texto_livre: string;
  status_analise: MealAnalysisStatus;
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

export type SleepSource = "checkin" | "battery" | "visibility" | "google_fit";

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;           // YYYY-MM-DD — data do despertar
  sleep_start: string | null;   // ISO timestamp
  sleep_end: string | null;     // ISO timestamp
  duration_min: number | null;
  quality: number | null;       // 1–5
  interruptions: number;
  had_dreams: boolean | null;
  notes: string | null;
  source: SleepSource;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SleepStats {
  avgDurationMin: number;
  avgQuality: number;
  totalNights: number;
  bestNight: SleepLog | null;
  worstNight: SleepLog | null;
  consistencyScore: number; // 0–100
  weeklyLogs: SleepLog[];
}

export interface DailyNutritionSummary {
  total_calorias: number;
  total_carboidratos: number;
  total_proteinas: number;
  total_gorduras: number;
  refeicoes: Meal[];
  qualidade: "bom" | "atencao" | "sem_dados";
}

// ── Goals (Metas) ─────────────────────────────────────────────────────────────

export type GoalType   = "destino" | "direcao";
export type GoalStatus = "ativa" | "pausada" | "concluida" | "arquivada";
export type GoalArea   =
  | "saude" | "carreira" | "financas" | "relacionamentos"
  | "desenvolvimento" | "familia" | "lazer" | "espiritualidade";

export type GoalStageStatus  = "pendente" | "em_progresso" | "concluida";
export type GoalActionStatus = "pendente" | "concluida";

export interface GoalAction {
  id: string;
  stage_id: string;
  title: string;
  if_then: string | null;
  status: GoalActionStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalStage {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  position: number;
  status: GoalStageStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  actions?: GoalAction[];
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  why_it_matters: string;
  type: GoalType;
  area: GoalArea;
  status: GoalStatus;
  target_date: string | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  reward: string | null;
  punishment: string | null;
  reward_claimed: boolean;
  punishment_applied: boolean;
  created_at: string;
  updated_at: string;
  stages?: GoalStage[];
}

export type TaskArea =
  | "saude" | "carreira" | "financas" | "relacionamentos"
  | "desenvolvimento" | "familia" | "lazer" | "espiritualidade" | "outros";

export type TaskType = "crescimento" | "manutencao";
export type TaskStatus = "pendente" | "concluida" | "pulada";

export interface WeeklyTask {
  id: string;
  weekly_plan_id: string;
  user_id: string;
  title: string;
  area: TaskArea;
  task_type: TaskType;
  linked_goal_id: string | null;
  linked_action_id: string | null;
  day_of_week: number;        // 0=Seg … 6=Dom
  scheduled_time: string | null; // "HH:MM"
  status: TaskStatus;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string;       // YYYY-MM-DD (segunda-feira)
  main_focus: string;
  main_focus_2: string | null;
  main_focus_3: string | null;
  linked_goal_id: string | null;
  created_at: string;
  updated_at: string;
  focus_goals?: Goal[];
  review?: WeeklyReview | null;
  tasks?: WeeklyTask[];
}

export interface WeeklyReview {
  id: string;
  weekly_plan_id: string;
  biggest_win: string;
  blocked_lesson: string;
  main_learning: string;
  week_score: number;
  created_at: string;
}

// ── Finances ──────────────────────────────────────────────────────────────────

export type FinancialType = "receita" | "despesa";

export interface FinancialTransaction {
  id: string;
  user_id: string;
  type: FinancialType;
  amount: number;
  category: string;
  subcategory: string | null;
  description: string | null;
  date: string;       // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface FinancialBudget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  month: string;      // YYYY-MM
  created_at: string;
}

// ── Agenda ─────────────────────────────────────────────────────────────────────

export type AgendaItemType = "compromisso" | "tarefa";

export type EisenhowerPriority =
  | "importante_urgente"
  | "importante_nao_urgente"
  | "nao_importante_urgente"
  | "nao_importante_nao_urgente";

export interface AgendaItem {
  id: string;
  user_id: string;
  title: string;
  item_type: AgendaItemType;
  date: string;              // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null;   // HH:MM
  priority: EisenhowerPriority;
  emoji: string | null;
  status: "pendente" | "concluida";
  linked_goal_id: string | null;
  linked_action_id: string | null;
  linked_weekly_task_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}
