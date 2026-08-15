-- Split meditation_prayer_breathing (meditar/orar/respirar) and exercise_walk (caminhar/correr/musculação)
-- into granular boolean columns. The legacy columns are kept and derived as "did any" aggregates.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS meditation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS prayer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS breathing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS walked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS ran BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS strength_training BOOLEAN NOT NULL DEFAULT false;
