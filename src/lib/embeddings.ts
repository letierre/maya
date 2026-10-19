/**
 * Embeddings via Voyage AI (`voyage-3-large`, 1024 dims, multilíngue).
 *
 * - `input_type "document"`: para fatos/episódios/resumos que ARMAZENAMOS.
 * - `input_type "query"`:    para a pergunta de busca (mensagem atual do usuário).
 * Usar o tipo errado derruba o recall — mantemos os dois separados de propósito.
 *
 * Robustez de rate limit: o tier gratuito do Voyage (sem cartão) é 3 RPM / 10K
 * TPM. Lote menor (64) + retry com backoff exponencial em 429/5xx evita que um
 * pico derrube a escrita/recall/backfill.
 */

import { logAiUsage } from "@/lib/ai-usage";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";
const BATCH = 64; // cabe folgado nos 10K tokens/min do tier gratuito
const MAX_RETRIES = 6;

function apiKey(): string {
  const k = process.env.VOYAGE_API_KEY || "";
  if (!k) throw new Error("VOYAGE_API_KEY não configurada");
  return k;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface EmbedMeta {
  userId?: string;
  feature?: string;
}

async function voyageEmbed(
  inputs: string[],
  inputType: "document" | "query",
  meta?: EmbedMeta,
): Promise<number[][]> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify({ model: MODEL, input: inputs, input_type: inputType }),
      });
    } catch (err) {
      throw new Error(`Voyage network error: ${String(err)}`);
    }

    if (res.ok) {
      const data = await res.json();
      // Telemetria de custo (fire-and-forget) — Voyage cobra por token total.
      const totalTokens = data?.usage?.total_tokens ?? 0;
      if (meta?.userId && totalTokens > 0) {
        logAiUsage({
          userId: meta.userId,
          feature: meta.feature ?? "maya_memory_embeddings",
          model: MODEL,
          inputTokens: totalTokens,
          outputTokens: 0,
        });
      }
      const rows = Array.isArray(data?.data) ? data.data : [];
      // Voyage devolve `index` por item; garante a ordem de entrada.
      return rows
        .slice()
        .sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
        .map((d: { embedding?: number[] }) => d.embedding ?? []);
    }

    lastStatus = res.status;
    // 429 (rate limit) e 5xx são transitórios → tenta de novo com backoff.
    const retriable = res.status === 429 || res.status >= 500;
    if (retriable && attempt < MAX_RETRIES) {
      const wait = Math.min(60000, 2000 * Math.pow(2, attempt)); // 2s,4s,8s,16s,32s,60s
      await sleep(wait);
      continue;
    }

    const err = await res.text();
    throw new Error(`Voyage API error (${res.status}): ${err.slice(0, 200)}`);
  }
  throw new Error(`Voyage API error (${lastStatus}): limite de tentativas excedido`);
}

/** Embutir textos a armazenar (fatos/episódios/resumos). */
export async function embedDocuments(texts: string[], meta?: EmbedMeta): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await voyageEmbed(texts.slice(i, i + BATCH), "document", meta)));
  }
  return out;
}

/** Embutir a pergunta de busca (mensagem atual do usuário). */
export async function embedQuery(text: string, meta?: EmbedMeta): Promise<number[]> {
  const r = await voyageEmbed([text], "query", meta);
  return r[0] ?? [];
}

/** Serializa um vetor no formato de texto que o pgvector entende ("[0.1,0.2,...]"). */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
