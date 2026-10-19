/**
 * Escrita de memória de longo prazo da Maya (Fase 2).
 *
 * Fluxo: extração estruturada (Sonnet 5) → embeddings (Voyage) → dedup híbrido
 * (vetor top-K + LLM decide new/duplicate/merge/supersede) → gravação.
 *
 * Roda em background (via `after()` no chat) e é best-effort: se algo falhar,
 * a conversa nunca é afetada — apenas logamos o erro.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { callLLM, responseLanguageLine } from "@/lib/llm";
import { embedDocuments, toPgVector } from "@/lib/embeddings";
import { logError } from "@/lib/error-log";

const MEMORY_MODEL = "claude-sonnet-5"; // raciocínio de memória ≠ Haiku do chat
const DEDUP_SIM_THRESHOLD = 0.75; // abaixo disso é claramente novo (não chama LLM)
const DEDUP_TOP_K = 3;

type Kind = "identity" | "preference" | "event" | "episode";
const KINDS: Kind[] = ["identity", "preference", "event", "episode"];

interface ExtractedFact {
  fact: string;
  kind: Kind;
  event_date: string | null;
  temporal_hint: string | null;
  importance: number;
  confidence: number;
}

interface Candidate {
  memory_id: string;
  fact: string;
  similarity: number;
}

interface Decision {
  action: "new" | "duplicate" | "merge" | "supersede";
  target_id: string | null;
  merged_text: string | null;
}

// ── Helpers de parse/sanitização ─────────────────────────────────────────

function sanitizeDate(d: unknown): string | null {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function clamp(n: unknown, lo: number, hi: number, def: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.min(hi, Math.max(lo, v));
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// ── Extração estruturada (Sonnet 5) ──────────────────────────────────────

async function extractFacts(
  recentMessages: { role: string; content: string }[],
  reply: string,
  language?: string,
): Promise<ExtractedFact[]> {
  const transcript = recentMessages
    .map((m) => `${m.role === "assistant" ? "Maya" : "Usuário"}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const system = `Você é o sistema de MEMÓRIA de longo prazo da Maya. Extraia fatos DURÁVEIS e NOVOS sobre a vida da pessoa a partir da conversa. ${responseLanguageLine(language)}`;

  const user = `Conversa (mais recente por último):
${transcript}

Resposta da Maya:
"${reply.slice(0, 500)}"

## INSTRUÇÕES
1. Extraia apenas o que é NOVO e DURÁVEL sobre a vida da pessoa (identidade, preferências, eventos com data, episódios marcantes).
2. NÃO extraia dados de check-in (sono, humor, exercício pontual, água, comida).
3. Classifique cada fato em:
   - "identity": traço estável (familiar, profissão, onde mora, crenças, pets).
   - "preference": gosto duradouro ("adora cozinhar", "gosta de caminhar à noite").
   - "event": acontecimento com data concreta ("consulta na sexta", "viagem em julho").
   - "episode": acontecimento emocional significativo sem data exata ("teve uma conversa difícil com a mãe").
4. "event_date": APENAS se houver data concreta no formato AAAA-MM-DD; senão null.
5. "temporal_hint": referência temporal vaga ("semana que vem", "em julho"); senão null.
6. "importance": 1 (trivial) a 3 (muito importante/identidade).
7. "confidence": 0.5 a 1.0 (certeza de que é real e durável).
8. Máximo 4 fatos.

Retorne APENAS JSON, sem texto fora, no formato exato:
{"facts":[{"fact":"...","kind":"identity","event_date":null,"temporal_hint":null,"importance":3,"confidence":0.95}]}
Se não houver fatos novos: {"facts":[]}`;

  const raw = await callLLM(system, user, {
    maxTokens: 900,
    temperature: 0.2,
    model: MEMORY_MODEL,
    feature: "maya_memory_extract",
  });

  const parsed = parseJsonObject(raw);
  const list = Array.isArray((parsed as { facts?: unknown[] } | null)?.facts)
    ? ((parsed as { facts: unknown[] }).facts)
    : [];

  const out: ExtractedFact[] = [];
  for (const item of list) {
    const it = item as Record<string, unknown> | null;
    if (!it || typeof it.fact !== "string") continue;
    const fact = it.fact.trim();
    if (fact.length < 3) continue;
    const kind: Kind = KINDS.includes(it.kind as Kind) ? (it.kind as Kind) : "event";
    out.push({
      fact,
      kind,
      event_date: sanitizeDate(it.event_date),
      temporal_hint:
        typeof it.temporal_hint === "string" && it.temporal_hint.trim()
          ? it.temporal_hint.trim()
          : null,
      importance: clamp(it.importance, 1, 3, 2),
      confidence: clamp(it.confidence, 0.5, 1, 0.8),
    });
  }
  return out;
}

// ── Busca / gravação via RPCs pgvector ───────────────────────────────────

async function searchSimilarFacts(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  vectorStr: string,
  k: number,
): Promise<Candidate[]> {
  const { data, error } = await admin.rpc("match_memory_facts", {
    p_user_id: userId,
    query_embedding: vectorStr,
    match_count: k,
  });
  if (error) {
    logError({ path: "memory-write match_memory_facts", message: String(error.message ?? error), userId });
    return [];
  }
  return ((data ?? []) as Array<{ memory_id: string; fact: string; similarity: number | string }>).map(
    (r) => ({ memory_id: r.memory_id, fact: r.fact, similarity: Number(r.similarity) || 0 }),
  );
}

async function insertFactWithVector(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  f: ExtractedFact,
  vectorStr: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("insert_memory_fact", {
    p_user_id: userId,
    p_fact: f.fact,
    p_kind: f.kind,
    p_event_date: f.event_date,
    p_temporal_hint: f.temporal_hint,
    p_source: "chat",
    p_importance: f.importance,
    p_confidence: f.confidence,
    p_embedding: vectorStr,
  });
  if (error) throw error;
  return (data as string) ?? null;
}

async function logMemoryOp(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  op: "write" | "merge" | "supersede" | "duplicate",
  opts: { ref_id?: string; detail?: string },
): Promise<void> {
  try {
    await admin.from("memory_ops").insert({
      user_id: userId,
      op,
      ref_type: "fact",
      ref_id: opts.ref_id ?? null,
      detail: opts.detail ?? null,
    });
  } catch {
    // best-effort: o log de auditoria nunca derruba a escrita de memória.
  }
}

async function decideAction(f: ExtractedFact, candidates: Candidate[], language?: string): Promise<Decision> {
  const system = `Você é o curador da memória de longo prazo da Maya. Decida se um fato novo já está representado nas memórias existentes da pessoa. ${responseLanguageLine(language)}`;
  const user = `Fato novo: "${f.fact}"

Memórias existentes mais parecidas:
${candidates.map((c) => `- (${c.memory_id}) [${Math.round(c.similarity * 100)}%] "${c.fact}"`).join("\n")}

Classifique a relação do fato novo com as existentes e retorne APENAS JSON no formato:
{"action":"new|duplicate|merge|supersede","target_id":"<uuid da existente, se aplicável>","merged_text":"<texto consolidado, se merge>"}

- "new": não existe → adicionar (target_id null)
- "duplicate": já existe igual → descartar (target_id = a duplicada)
- "merge": complementa uma existente → devolva o texto fundido (target_id = a existente)
- "supersede": contradiz uma existente → a nova substitui a antiga (target_id = a antiga)`;

  const raw = await callLLM(system, user, {
    maxTokens: 300,
    temperature: 0,
    model: MEMORY_MODEL,
    feature: "maya_memory_dedup",
  });

  const p = parseJsonObject(raw) as Record<string, unknown> | null;
  const action = (["new", "duplicate", "merge", "supersede"] as const).includes(p?.action as Decision["action"])
    ? (p?.action as Decision["action"])
    : "new";
  return {
    action,
    target_id: typeof p?.target_id === "string" ? p.target_id : null,
    merged_text: typeof p?.merged_text === "string" ? p.merged_text : null,
  };
}

// ── Orquestração (entry point) ───────────────────────────────────────────

export async function extractAndStoreMemory(opts: {
  userId: string;
  recentMessages: { role: string; content: string }[];
  reply: string;
  language?: string;
}): Promise<{ extracted: number; stored: number; skipped: number }> {
  const { userId, recentMessages, reply, language } = opts;

  const facts = await extractFacts(recentMessages, reply, language);
  if (facts.length === 0) return { extracted: 0, stored: 0, skipped: 0 };

  const embeddings = await embedDocuments(facts.map((f) => f.fact), { userId, feature: "maya_memory_embeddings" });
  if (embeddings.length !== facts.length) throw new Error("embedding count mismatch");

  const admin = getSupabaseAdmin();
  let stored = 0;
  let skipped = 0;

  for (let i = 0; i < facts.length; i++) {
    const f = facts[i];
    const vec = embeddings[i];
    if (!vec || vec.length === 0) continue;
    const vectorStr = toPgVector(vec);

    try {
      const candidates = await searchSimilarFacts(admin, userId, vectorStr, DEDUP_TOP_K);
      const best = candidates[0];

      // Claramente novo → grava direto (sem gastar LLM de dedup).
      if (!best || best.similarity < DEDUP_SIM_THRESHOLD) {
        const newId = await insertFactWithVector(admin, userId, f, vectorStr);
        await logMemoryOp(admin, userId, "write", { ref_id: newId ?? undefined, detail: f.fact });
        stored++;
        continue;
      }

      // Ambíguo → LLM decide.
      const decision = await decideAction(f, candidates, language);

      if (decision.action === "duplicate") {
        await logMemoryOp(admin, userId, "duplicate", { ref_id: decision.target_id ?? undefined, detail: f.fact });
        skipped++;
      } else if (decision.action === "merge" && decision.target_id && decision.merged_text) {
        // Re-embeds o texto fundido (não o fato original).
        const [mergedVec] = await embedDocuments([decision.merged_text], { userId, feature: "maya_memory_embeddings" });
        await admin.rpc("update_memory_fact", {
          p_memory_id: decision.target_id,
          p_fact: decision.merged_text,
          p_embedding: toPgVector(mergedVec),
        });
        await logMemoryOp(admin, userId, "merge", { ref_id: decision.target_id, detail: decision.merged_text });
        stored++;
      } else if (decision.action === "supersede") {
        const newId = await insertFactWithVector(admin, userId, f, vectorStr);
        if (decision.target_id && newId) {
          await admin
            .from("user_memories")
            .update({ archived: true, superseded_by: newId })
            .eq("id", decision.target_id);
        }
        await logMemoryOp(admin, userId, "supersede", { ref_id: newId ?? undefined, detail: f.fact });
        stored++;
      } else {
        // "new" ou fallback
        const newId = await insertFactWithVector(admin, userId, f, vectorStr);
        await logMemoryOp(admin, userId, "write", { ref_id: newId ?? undefined, detail: f.fact });
        stored++;
      }
    } catch (e) {
      // best-effort: um fato que falha não derruba os demais nem a conversa.
      logError({ path: "memory-write fact", message: String(e), userId });
    }
  }

  return { extracted: facts.length, stored, skipped };
}
