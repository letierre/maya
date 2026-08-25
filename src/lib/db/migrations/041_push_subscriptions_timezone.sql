-- Armazena o fuso horário (IANA, ex: "America/Sao_Paulo") de cada assinatura push,
-- para que as notificações do cron disparem no horário local do usuário.
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone TEXT;
