-- Assinatura da Maya (Stripe) — uma linha por usuário.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'none',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
