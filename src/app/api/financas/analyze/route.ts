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

  const systemPrompt = `Você extrai transações financeiras de fotos. A imagem pode ser:
- um recibo ou nota fiscal (uma transação);
- um print de extrato bancário ou fatura de cartão, com VÁRIAS transações listadas.

Extraia TODAS as transações que conseguir identificar na imagem.

Retorne APENAS um JSON válido, sem texto, sem markdown, sem comentários.

Formato exato:
{
  "transactions": [
    {
      "type": "despesa",
      "amount": 4000,
      "category": "alimentacao",
      "subcategory": "Supermercado",
      "description": "Supermercado X",
      "date": "YYYY-MM-DD"
    }
  ]
}

Se a imagem tiver apenas UMA transação, retorne uma lista com um único item.

Categorias de despesa: ${EXPENSE_IDS.join(", ")}
Categorias de receita: ${INCOME_IDS.join(", ")}

Regras:
- type: "despesa" para compras/pagamentos, "receita" para recebimentos
- amount: o valor total como NÚMERO PURO, sem símbolo de moeda e SEM separador de milhar.
  Escreva 4000 (quatro mil), NUNCA "4.000" nem "4,000" nem "4.000,00".
  Para centavos, use ponto decimal: 1250.50
- category: escolha a mais adequada das listas acima, exatamente como escrita (minúscula)
- subcategory: nome curto do estabelecimento ou tipo de gasto
- description: nome do estabelecimento (máximo 60 caracteres)
- date: data da transação em YYYY-MM-DD; se não encontrar, use hoje: ${today}

IMPORTANTE: responda SEMPRE com o JSON válido, mesmo que precise estimar a categoria. Nunca responda com texto dizendo que não conseguiu.`;

  try {
    const imageDataUrl = `data:${safeMediaType};base64,${cleanBase64}`;

    const text = await callLLM(systemPrompt, [
      { type: "text", text: "Extraia todas as transações desta imagem e retorne o JSON." },
      toImageBlock(imageDataUrl),
    ], { maxTokens: 1200, temperature: 0.1 });

    try {
      const parsed = JSON.parse(extractJson(text));
      // Aceita: { transactions: [...] }, um array direto, ou um objeto único (compat)
      let list: unknown[] = [];
      if (Array.isArray(parsed)) list = parsed;
      else if (Array.isArray(parsed?.transactions)) list = parsed.transactions;
      else if (parsed && typeof parsed === "object") list = [parsed];

      const transactions = list
        .map((raw) => {
          const t = (raw ?? {}) as Record<string, unknown>;
          const amount = normalizeAmount(t.amount);
          return {
            type: t.type === "receita" ? "receita" : "despesa",
            amount: amount ?? "",
            category: (t.category as string) || "outros",
            subcategory: (t.subcategory as string) || "",
            description: (t.description as string) || "",
            date: (t.date as string) || today,
          };
        })
        .filter((t) => t.amount !== "");

      return NextResponse.json({ transactions });
    } catch {
      console.error("[financas/analyze] JSON inválido retornado pela IA:", text?.slice(0, 400));
      return NextResponse.json({ error: "Não foi possível interpretar a foto" }, { status: 422 });
    }
  } catch (error) {
    console.error("POST /api/financas/analyze error:", error);
    return NextResponse.json({ error: "Erro ao processar foto" }, { status: 500 });
  }
}
