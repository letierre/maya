import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { callLLM, toImageBlock } from "@/lib/llm";

const EXPENSE_IDS = ["moradia", "alimentacao", "transporte", "saude_beleza", "educacao", "lazer", "pessoal", "servicos_fin", "comunicacao", "doacoes", "pet", "personalizada"];
const INCOME_IDS = ["salario", "freelance", "investimentos", "presente", "outros"];

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}

/**
 * Normaliza o valor do recibo que a IA retorna. LLMs costumam escrever
 * "4.000" (milhar) ou "4.000,50" (latino) e isso vira 4 em `Number()`.
 * Aqui tratamos separador de milhar vs decimal para não "comer" zeros.
 */
function normalizeAmount(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim().replace(/[^0-9.,\-]/g, "");
  if (!s) return null;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  if (commaCount > 1 || dotCount > 1) {
    // Múltiplos separadores = agrupamento de milhar → remove todos
    s = s.replace(/[.,]/g, "");
  } else if (commaCount === 1 && dotCount === 1) {
    // "1.234,56" ou "1,234.56" — o último separador é o decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", "."); // ponto=milhar, vírgula=decimal
    } else {
      s = s.replace(/,/g, ""); // vírgula=milhar, ponto=decimal
    }
  } else if (commaCount === 1) {
    // "4,000" (milhar) vs "4,5" (decimal)
    if (s.length - s.lastIndexOf(",") - 1 === 3) {
      s = s.replace(",", "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (dotCount === 1) {
    // "4.000" (milhar) vs "4000.50" (decimal)
    if (s.length - s.lastIndexOf(".") - 1 === 3) {
      s = s.replace(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { photoBase64, mediaType } = await req.json();
  if (!photoBase64) return NextResponse.json({ error: "Foto obrigatória" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const safeMediaType = (mediaType as string) || "image/jpeg";
  const cleanBase64 = (photoBase64 as string).replace(/^data:image\/\w+;base64,/, "");

  const systemPrompt = `Você analisa recibos, notas fiscais e fotos de compras. Retorne APENAS um JSON válido, sem texto adicional.

Formato exato:
{
  "type": "despesa",
  "amount": 0.00,
  "category": "categoria",
  "subcategory": "subcategoria",
  "description": "descrição curta",
  "date": "YYYY-MM-DD"
}

Categorias de despesa: ${EXPENSE_IDS.join(", ")}
Categorias de receita: ${INCOME_IDS.join(", ")}

Regras:
- type: "despesa" para compras/pagamentos, "receita" para recebimentos
- amount: o valor total como NÚMERO PURO, sem símbolo de moeda e SEM separador de milhar.
  Escreva 4000 (quatro mil), NUNCA "4.000" nem "4,000" nem "4.000,00".
  Para centavos, use ponto decimal: 1250.50
- category: escolha a categoria mais adequada das listas acima
- subcategory: texto curto descrevendo a subcategoria específica (ex: "Supermercado", "Uber", "Plano de Saúde")
- description: máximo 60 caracteres, texto simples
- date: data do recibo no formato YYYY-MM-DD; se não encontrar, use hoje: ${today}

NUNCA use markdown, apenas o JSON puro.`;

  try {
    const imageDataUrl = `data:${safeMediaType};base64,${cleanBase64}`;

    const text = await callLLM(systemPrompt, [
      { type: "text", text: "Analise este recibo e retorne o JSON." },
      toImageBlock(imageDataUrl),
    ], { maxTokens: 256, temperature: 0.1 });

    try {
      const parsed = JSON.parse(extractJson(text));
      const amount = normalizeAmount(parsed.amount);
      return NextResponse.json({
        type: parsed.type ?? "despesa",
        amount: amount ?? "",
        category: parsed.category ?? "outros",
        subcategory: parsed.subcategory ?? "",
        description: parsed.description ?? "",
        date: parsed.date ?? today,
      });
    } catch {
      return NextResponse.json({ error: "Não foi possível interpretar a foto" }, { status: 422 });
    }
  } catch (error) {
    console.error("POST /api/financas/analyze error:", error);
    return NextResponse.json({ error: "Erro ao processar foto" }, { status: 500 });
  }
}
