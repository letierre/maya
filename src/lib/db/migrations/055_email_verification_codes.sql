-- Fluxo OTP de 6 dígitos para confirmar o email no cadastro (substitui o link).
-- Guardamos apenas HASH+SALT do código — nunca o texto plano.
-- Acesso exclusivo via service role: RLS habilitado SEM policy (mesmo padrão de `subscriptions`).

CREATE TABLE IF NOT EXISTS email_verification_codes (
  user_id      UUID PRIMARY KEY,
  email        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  salt         TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

alter table email_verification_codes enable row level security;
