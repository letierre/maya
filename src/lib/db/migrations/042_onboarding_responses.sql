-- Respostas do onboarding de conversão (questionário), armazenadas de forma estruturada
-- para análise de perfil de usuário e otimização de anúncios/comunicação.
-- Uma linha por usuário (user_id é PK) — o upsert torna a escrita idempotente.
CREATE TABLE IF NOT EXISTS onboarding_responses (
  user_id uuid PRIMARY KEY,
  goal text,
  pain_points text[] NOT NULL DEFAULT '{}',
  tinder_agreed text[] NOT NULL DEFAULT '{}',
  area_preferences text[] NOT NULL DEFAULT '{}',
  gender text,
  language text,
  has_medication boolean,
  has_faith boolean,
  has_creative_hobby boolean,
  track_suicidal_thoughts boolean,
  utm_source text,
  utm_campaign text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
