/**
 * Embeddings via Voyage AI (`voyage-3-large`, 1024 dims, multilíngue).
 *
 * - `input_type "document"`: para fatos/episódios/resumos que ARMAZENAMOS.
 * - `input_type "query"`:    para a pergunta de busca (mensagem atual do usuário).
 * Usar o tipo errado derruba o recall — mantemos os dois separados de propósito.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";
const BATCH = 128; // limite por chamada do voyage-3-large

function apiKey(): string {
  const k = process.env.VOYAGE_API_KEY || "";
  if (!k) throw new Error("VOYAGE_API_KEY não configurada");
  return k;
}

async function voyageEmbed(inputs: string[], inputType: "document" | "query"): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: MODEL, input: inputs, input_type: inputType }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows = Array.isArray(data?.data) ? data.data : [];
  // Voyage devolve `index` por item; garante a ordem de entrada.
  return rows
    .slice()
    .sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
    .map((d: { embedding?: number[] }) => d.embedding ?? []);
}

/** Embutir textos a armazenar (fatos/episódios/resumos). */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await voyageEmbed(texts.slice(i, i + BATCH), "document")));
  }
  return out;
}

/** Embutir a pergunta de busca (mensagem atual do usuário). */
export async function embedQuery(text: string): Promise<number[]> {
  const r = await voyageEmbed([text], "query");
  return r[0] ?? [];
}

/** Serializa um vetor no formato de texto que o pgvector entende ("[0.1,0.2,...]"). */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
