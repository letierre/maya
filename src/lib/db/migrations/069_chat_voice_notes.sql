-- ── 069: coluna audio_url no chat_messages (notas de voz da Maya) ──────────
-- Guarda o caminho do áudio (Supabase Storage, bucket user-content) da resposta
-- por voz da Maya. NULL = mensagem de texto (sem áudio).
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_url text;
