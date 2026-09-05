-- Compras 2.0 — listas personalizadas + itens enriquecidos

-- 1) Nova tabela de listas
CREATE TABLE IF NOT EXISTS shopping_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🛒',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id, position);

-- 2) Novos campos em shopping_items
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS list_id UUID;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS quantity TEXT;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS estimated_price NUMERIC(10,2);
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) Backfill: uma lista padrão "Mercado" por usuário que já tem itens (e ainda não tem nenhuma lista)
INSERT INTO shopping_lists (user_id, name, emoji, position)
SELECT DISTINCT si.user_id, 'Mercado', '🛒', 0
FROM shopping_items si
WHERE NOT EXISTS (
  SELECT 1 FROM shopping_lists sl WHERE sl.user_id = si.user_id
);

-- 4) Associar itens existentes à lista padrão do usuário
UPDATE shopping_items si
SET list_id = sl.id
FROM shopping_lists sl
WHERE si.list_id IS NULL
  AND sl.user_id = si.user_id;

-- 5) list_id NOT NULL + FK (com CASCADE)
ALTER TABLE shopping_items ALTER COLUMN list_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_shopping_items_list'
  ) THEN
    ALTER TABLE shopping_items
      ADD CONSTRAINT fk_shopping_items_list
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6) Índice por lista + posição
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id, position);
