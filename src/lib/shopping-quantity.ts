// Quantidade e unidade da lista de compras.
// Unidades de contagem (un, pct) multiplicam o preço (preço × quantidade);
// medidas (peso/volume) não — o preço é da medida inteira.

const COUNT_UNITS = new Set(["un", "pct"]);

export interface ParsedQuantity {
  num: string;           // parte numérica ("150")
  unit: string | null;   // "un" | "pct" | "g" | "kg" | "ml" | "l" | null
}

// Extrai número + unidade. Se `unit` já vem normalizado, usa direto;
// senão tenta derivar do texto legado ("2x", "1kg", "100g", "20", "2 un"…).
export function parseQuantity(
  quantity: string | null | undefined,
  unit: string | null | undefined,
): ParsedQuantity {
  if (unit) return { num: quantity ?? "", unit };
  const s = (quantity ?? "").trim().toLowerCase();
  if (!s) return { num: "", unit: null };
  const m = s.match(/^(\d+(?:[.,]\d+)?)/);
  const num = m ? m[1] : "";
  if (/kg|kilo|quilo/.test(s)) return { num, unit: "kg" };
  if (/g|gr|grama/.test(s)) return { num, unit: "g" };
  if (/ml|mililitro/.test(s)) return { num, unit: "ml" };
  if (/litro|l$/.test(s)) return { num, unit: "l" };
  if (/pct|pacote|caixa|bandeja|embalagem/.test(s)) return { num, unit: "pct" };
  if (num) return { num, unit: "un" };
  return { num: "", unit: null };
}

// Multiplicador do preço: contagem → número; medida → 1.
export function lineMultiplier(
  quantity: string | null | undefined,
  unit: string | null | undefined,
): number {
  const { num, unit: u } = parseQuantity(quantity, unit);
  if (!u || !COUNT_UNITS.has(u)) return 1;
  const n = parseFloat((num || "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Total da linha = preço × multiplicador.
export function lineTotal(
  estimated_price: number | null | undefined,
  quantity: string | null | undefined,
  unit: string | null | undefined,
): number {
  return (estimated_price ?? 0) * lineMultiplier(quantity, unit);
}
