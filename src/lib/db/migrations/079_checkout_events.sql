-- Funil de checkout (Stripe) — fonte de verdade pra "chegou no checkout" e
-- "pagou", já que o gráfico do Stripe não registra link de assinatura de forma
-- confiável (marca 0 no dia em que há venda). Escrita só via webhook (service
-- role). RLS SEM policy (mesmo padrão de `app_events` / `subscriptions`).
CREATE TABLE IF NOT EXISTS checkout_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type           TEXT NOT NULL,          -- 'session.created' | 'session.completed'
  checkout_session_id  TEXT NOT NULL,
  payment_link         TEXT,
  customer_email       TEXT,
  mode                 TEXT,
  amount_cents         INTEGER,
  currency             TEXT,
  status               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_type, checkout_session_id)
);

CREATE INDEX IF NOT EXISTS checkout_events_created_idx ON checkout_events (created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_events_type_created_idx ON checkout_events (event_type, created_at DESC);

ALTER TABLE checkout_events ENABLE ROW LEVEL SECURITY;
