-- Unidade da quantidade na lista de compras (un, pct, g, kg, ml, l)
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
