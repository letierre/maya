import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { callLLM, toImageBlock } from "@/lib/llm";
import type { Macros } from "@/types";

const SYSTEM_JSON = `Você é um analisador nutricional. Retorne APENAS um JSON válido, sem texto adicional.

Formato exato:
{
  "itens_identificados": ["item1", "item2"],
  "macros_estimados": {
    "carboidratos_g": 0,
    "proteinas_g": 0,
    "gorduras_g": 0,
    "calorias_kcal": 0
  },
  "classificacao": "equilibrada",
  "observacao_curta": "breve observação em português",
  "beneficios": ["benefício 1", "benefício 2"]
}

Regras de macros: SEMPRE estime os 4 valores (carboidratos_g, proteinas_g, gorduras_g, calorias_kcal) com números MAIORES QUE ZERO. Nunca omita um macro nem retorne 0 — se não conseguir medir com precisão pela foto, estime com base na porção típica dos alimentos identificados.

Regras de classificação (escolha UMA):
- "equilibrada": refeição balanceada com proteína, carboidrato e gordura em proporções razoáveis.
- "leve_proteina": pouca proteína em relação ao total calórico.
- "alta_acucar": contém açúcar ADICIONADO em quantidade significativa (doces, refrigerante, suco industrializado, sobremesas, bala, chocolate com açúcar). Alimentos naturalmente ricos em amido como pipoca, pão, arroz, batata NÃO são "alta_acucar".
- "alta_gordura": predominantemente gordurosa (frituras, carnes gordas, queijo, manteiga em excesso).
- "alta_sal": alimentos muito salgados ou processados com alto teor de sódio (pipoca salgada, salgadinhos, embutidos, fast food, enlatados). Use quando sal/sódio for o destaque negativo.
- "vegetais_baixo": predominantemente vegetais e/ou muito baixa caloria.
Identifique cada alimento com cuidado e NÃO invente itens. Se um alimento não estiver claro na foto, não chute um nome: inclua apenas o que consegue ver com confiança. Se não conseguir identificar com confiança, use "nao_identificada".
Observação em português, 1-2 frases, tom POSITIVO e encorajador — celebre algo bom da refeição (proteína presente, variedade, escolha consciente, etc.). Não critique nem liste o que faltou.
Benefícios: liste 1-3 frases curtas em português, cada uma destacando um benefício real de um alimento CLARAMENTE identificado na refeição (ex: "A cenoura é rica em betacaroteno, boa para a visão"). Cite apenas alimentos que você realmente viu. Se não houver benefício claro, retorne lista vazia [].
NUNCA use markdown (**), travessão (—) ou caracteres especiais na observação — apenas texto plano com vírgula e ponto final.`;

async function callVision(photos: string[], description: string): Promise<string> {
  const hasMultiple = photos.length > 1;

  const system = `${SYSTEM_JSON}
${hasMultiple ? `ATENÇÃO: Você receberá ${photos.length} fotos da MESMA refeição. Se mostrarem ITENS DIFERENTES, some todos. Se forem ângulos do MESMO item, NÃO duplique.` : ""}`;

  const textPrompt = description
    ? `Analise ${hasMultiple ? `estas ${photos.length} fotos da refeição` : "esta refeição"}. Descrição do usuário: "${description}". ${hasMultiple ? "Fotos de itens DIFERENTES = somar tudo. Fotos do MESMO item = contar uma vez." : ""} Retorne APENAS o JSON.`
    : `Analise ${hasMultiple ? `estas ${photos.length} fotos da refeição` : "esta refeição"}. ${hasMultiple ? "Fotos de itens DIFERENTES = somar tudo. Fotos do MESMO item = contar uma vez." : ""} Retorne APENAS o JSON.`;

  // Send images as multimodal content blocks
  const imageBlocks = photos.map(p => {
    const dataUrl = p.startsWith("data:") ? p : `data:image/jpeg;base64,${p}`;
    return toImageBlock(dataUrl);
  });

  return callLLM(system, [{ type: "text", text: textPrompt }, ...imageBlocks], { maxTokens: 2000, model: "claude-sonnet-5" });
}

async function callTextOnly(description: string, items: string[]): Promise<string> {
  const itemsStr = items.length > 0
    ? `Itens informados: ${items.join(", ")}. `
    : "";

  const prompt = items.length > 0
    ? `Analise esta refeição. ${itemsStr}${description ? `Descrição adicional: "${description}". ` : ""}Estime os macros e calorias baseado nos itens e quantidades típicas. Retorne APENAS o JSON.`
    : description
      ? `Analise esta refeição baseado na descrição: "${description}". Estime os macros e calorias. Retorne APENAS o JSON.`
      : `Analise esta refeição. Sem detalhes específicos, faça a melhor estimativa possível. Retorne APENAS o JSON.`;

  return callLLM(SYSTEM_JSON, prompt, { maxTokens: 400, temperature: 0.3 });
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) return text.slice(start, end);
  return text;
}

function normalizeMacros(m: unknown): Macros | null {
  if (!m || typeof m !== "object") return null;
  const obj = m as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    carboidratos_g: num(obj.carboidratos_g),
    proteinas_g: num(obj.proteinas_g),
    gorduras_g: num(obj.gorduras_g),
    calorias_kcal: num(obj.calorias_kcal),
  };
}

function parseAnalysis(raw: string) {
  const jsonStr = extractJson(raw);
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  const beneficios = Array.isArray(parsed.beneficios)
    ? parsed.beneficios.filter((b: unknown) => typeof b === "string" && b.trim().length > 0)
    : [];

  return {
    itens: (parsed.itens_identificados || []).map((nome: string) => ({ nome })),
    macros: normalizeMacros(parsed.macros_estimados),
    classificacao: parsed.classificacao || "nao_identificada",
    observacao: parsed.observacao_curta || "",
    beneficios,
    status_analise: "analisado" as const,
  };
}

async function markFailed(mealId: string, userId: string) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("meals").update({ status_analise: "falha" }).eq("id", mealId).eq("user_id", userId);
  } catch { /* best-effort */ }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  let mealId = "";

  try {
    const body = await request.json();
    mealId = body.mealId || "";
    const { photosBase64, description, items } = body;

    const hasPhotos = photosBase64 && photosBase64.length > 0;
    const hasDescription = description && description.trim().length > 0;
    const hasItems = items && items.length > 0;

    if (!mealId) {
      return NextResponse.json({ error: "mealId obrigatorio" }, { status: 400 });
    }

    if (!hasPhotos && !hasDescription && !hasItems) {
      return NextResponse.json({ error: "photosBase64, description ou items obrigatorios" }, { status: 400 });
    }

    let raw: string;
    if (hasPhotos) {
      raw = await callVision(photosBase64, description || "");
    } else {
      const itemNames = items || [];
      raw = await callTextOnly(description || "", itemNames);
    }

    const analysis = parseAnalysis(raw);
    if (!analysis) {
      await markFailed(mealId, user.id);
      return NextResponse.json({ error: "Falha ao interpretar resposta da IA", raw }, { status: 422 });
    }

    const admin = getSupabaseAdmin();
    const { data: updated, error: updateError } = await admin
      .from("meals")
      .update({
        itens: analysis.itens,
        macros: analysis.macros,
        classificacao: analysis.classificacao,
        observacao: analysis.observacao,
        beneficios: analysis.beneficios,
        status_analise: "analisado",
      })
      .eq("id", mealId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/meals/analyze error:", error);
    await markFailed(mealId, user.id);
    return NextResponse.json(
      { error: "Erro ao analisar refeicao", detail: String(error) },
      { status: 500 }
    );
  }
}
