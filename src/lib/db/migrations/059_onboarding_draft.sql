-- Rascunho do onboarding: respostas parciais + etapa atual, para retomar o fluxo
-- de onde o usuário parou (ex.: fechou o app no meio e voltou depois).
-- JSON: { step, goal, pains, tinderAgreed, tinderIdx, areas, gender, lang, ctx, demo, waterCups }
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_draft jsonb;
