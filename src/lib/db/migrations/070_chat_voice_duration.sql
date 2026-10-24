-- ── 070: coluna audio_duration no chat_messages (notas de voz do usuário) ──
-- Duração do áudio em segundos. O webm do MediaRecorder não grava a duração no
-- header (audio.duration = Infinity), então guardamos aqui a duração medida no
-- STT (Deepgram metadata.duration) p/ o contador/seek funcionarem após reload.
-- NULL = texto, ou áudio com duração legível no próprio header (mp3 da Maya).
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS audio_duration double precision;
