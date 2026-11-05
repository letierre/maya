-- ── 075: client_id no chat_messages (idempotência de envio de voz) ──────────
-- O cliente gera uma chave estável (clientId) p/ cada nota de voz e a mantém
-- entre o envio original e o reenvio. A rota de transcrição reusa a linha já
-- persistida quando a chave existe — assim reenviar a mesma nota de voz (ex.:
-- resposta perdida no caminho, ou durante um deploy) NÃO duplica a mensagem.
-- UNIQUE permite múltiplos NULLs (mensagens de texto/legado ficam sem chave).
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS client_id text;

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_id_idx
  ON chat_messages (user_id, client_id);
