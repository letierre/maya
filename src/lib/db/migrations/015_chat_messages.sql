-- ── Chat Messages (persistência server-side) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages(user_id, created_at DESC);
