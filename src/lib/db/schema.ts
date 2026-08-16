import {
  pgTable,
  uuid,
  date,
  boolean,
  integer,
  text,
  timestamp,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

const ALL_QUESTION_KEYS = [
  "felt_judged",
  "took_medication",
  "talked_to_someone",
  "meditation",
  "prayer",
  "breathing",
  "creative_activity",
  "ate_well",
  "bowel_movement",
  "walked",
  "ran",
  "strength_training",
  "drank_water",
  "slept_well",
  "suicidal_thoughts",
  "did_something_enjoyable",
  "worked_on_goals",
] as const;

export { ALL_QUESTION_KEYS };

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    date: date("date").notNull(),
    feltJudged: boolean("felt_judged").notNull().default(false),
    tookMedication: boolean("took_medication").notNull().default(false),
    talkedToSomeone: boolean("talked_to_someone").notNull().default(false),
    meditationPrayerBreathing: boolean("meditation_prayer_breathing")
      .notNull()
      .default(false),
    meditation: boolean("meditation").notNull().default(false),
    prayer: boolean("prayer").notNull().default(false),
    breathing: boolean("breathing").notNull().default(false),
    creativeActivity: boolean("creative_activity").notNull().default(false),
    ateWell: boolean("ate_well").notNull().default(false),
    bowelMovement: boolean("bowel_movement").notNull().default(false),
    exerciseWalk: boolean("exercise_walk").notNull().default(false),
    walked: boolean("walked").notNull().default(false),
    ran: boolean("ran").notNull().default(false),
    strengthTraining: boolean("strength_training").notNull().default(false),
    drankWater: boolean("drank_water").notNull().default(false),
    sleptWell: boolean("slept_well").notNull().default(false),
    suicidalThoughts: boolean("suicidal_thoughts").notNull().default(false),
    didSomethingEnjoyable: boolean("did_something_enjoyable")
      .notNull()
      .default(false),
    workedOnGoals: boolean("worked_on_goals").notNull().default(false),
    // Hábitos realmente respondidos no check-in (null = legado). Ver 037.
    answeredQuestions: text("answered_questions").array(),
    feeling: text("feeling").notNull().default(""),
    gratitude: text("gratitude").notNull().default(""),
    gratitudePhotos: jsonb("gratitude_photos").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userDateIdx: uniqueIndex("user_date_idx").on(table.userId, table.date),
  })
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  enabledQuestions: text("enabled_questions").array().notNull().default([]),
  context: jsonb("context").notNull().default({}),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    achievementType: text("achievement_type").notNull(),
    tier: integer("tier").notNull().default(1),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (table) => ({
    userAchievementUnique: uniqueIndex("user_achievement_unique").on(
      table.userId,
      table.achievementType,
      table.tier
    ),
  })
);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    date: date("date").notNull().defaultNow(),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    mood: integer("mood"),
    photos: jsonb("photos").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => ({})
);

export const userMemories = pgTable("user_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  fact: text("fact").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meals = pgTable("meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  dataHora: timestamp("data_hora", { withTimezone: true }).notNull(),
  tipoRefeicao: text("tipo_refeicao").notNull().default("almoco"),
  fotoPath: text("foto_path"),
  fotos: jsonb("fotos").notNull().default([]),
  itens: jsonb("itens").notNull().default([]),
  macros: jsonb("macros"),
  classificacao: text("classificacao"),
  observacao: text("observacao").notNull().default(""),
  textoLivre: text("texto_livre").notNull().default(""),
  statusAnalise: text("status_analise").notNull().default("pendente"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
