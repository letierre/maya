-- ── Area Visions — permitir múltiplas visões por área ─────────────────────────
-- Antes: UNIQUE(user_id, area) obrigava 1 visão por área. Agora o usuário pode
-- escrever quantas quiser por área (ou nenhuma). Removemos a restrição e criamos
-- um índice composto não-único para leituras por usuário+área.
ALTER TABLE area_visions DROP CONSTRAINT IF EXISTS area_visions_user_id_area_key;
CREATE INDEX IF NOT EXISTS idx_area_visions_user_area ON area_visions(user_id, area);
