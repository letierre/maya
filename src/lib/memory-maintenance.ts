/**
 * Manutenção de memória de longo prazo da Maya (Fase 4).
 *
 * Dois trabalhos idempotentes, rodados em background pelo cron
 * `/api/cron/memory-maintenance`:
 *
 *  1) `backfillEmbeddings` — embuta as memórias antigas (pré-Fase 2) que não têm
 *     vetor, para que elas voltem a aparecer no recall por gatilho.
 *  2) `compileMemories` — quando um usuário acumula fatos crus suficientes,
 *     destila-os num `memory_summaries` (camada L3, estilo Claude Code): o
 *     essencial fica estável, e os fatos crus antigos saem naturalmente do bloco
 *     "recente" sem que a Maya esqueça o que importa.
 *
 * NADA aqui é destrutivo: só insere. Os fatos originais permanecem; o resumo
 * apenas registra quais ids ele cobre (source_memory_ids) para não re-compilar.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { callLLM } from "@/lib/llm";
import { embedDocuments, toPgVector } from "@/lib/embeddings";
import { getLocalDate, getLocalDateFromISO } from "@/lib/utils";
import { logError } from "@/lib/error-log";

const COMPILE_MODEL = "claude-sonnet-5"; // raciocínio de memória ≠ Haiku do chat
const COMPILE_THRESHOLD = 20; // fatos pendentes mínimos p/ valer a pena compilar
const MAX_FACTS = 50;         // teto de fatos por resumo (evita prompt gigante)
const MAX_USERS = 20;         // teto de usuários por execução (limita custo LLM)
const BACKFILL_LIMIT = 500;   // teto de fatos por execução de backfill

// ── Backfill de embeddings ───────────────────────────────────────────────

export async function backfillEmbeddings(): Promise<{ found: number; embedded: number; failed: number }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("get_unembedded_facts", { p_limit: BACKFILL_LIMIT });
  if (error) throw error;

  const rows = (data ?? []) as Array<{ memory_id: string; user_id: string; fact: string }>;
  if (rows.length === 0) return { found: 0, embedded: 0, failed: 0 };

  const embeddings = await embedDocuments(rows.map((r) => r.fact));
  if (embeddings.length !== rows.length) throw new Error("embedding count mismatch");

  let embedded = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const vec = embeddings[i];
    if (!vec || vec.length === 0) {
      failed++;
      continue;
    }
    try {
      await admin.rpc("insert_memory_vector", {
        p_user_id: r.user_id,
        p_ref_type: "fact",
        p_ref_id: r.memory_id,
        p_text: r.fact,
        p_embedding: toPgVector(vec),
      });
      embedded++;
    } catch (e) {
      failed++;
      logError({ path: "memory-maintenance backfill", message: String(e), userId: r.user_id });
    }
  }

  return { found: rows.length, embedded, failed };
}

// ── Compilação (L3) ──────────────────────────────────────────────────────

function spanGranularity(start: string, end: string): "daily" | "weekly" | "monthly" {
  const days = Math.round(
    (new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime()) / 86400000,
  );
  if (days <= 1) return "daily";
  if (days <= 10) return "weekly";
  return "monthly";
}

async function summarizeFacts(facts: string[], userId: string): Promise<string | null> {
  const system = `Você é o sistema de COMPILAÇÃO de memória de longo prazo da Maya. Você transforma muitos fatos crus sobre uma pessoa em UM resumo curto e estável — o essencial para a continuidade do relacionamento. Responda no idioma dos fatos (normalmente português brasileiro).`;

  const user = `Fatos crus sobre a pessoa (mais antigos primeiro):
${facts.map((f) => `- ${f}`).join("\n")}

## INSTRUÇÕES
1. Escreva um resumo de 2 a 4 frases que destile o que é DURÁVEL e IMPORTANTE: identidade, preferências, acontecimentos marcantes, decisões, mudanças.
2. Ignore fatos triviais e dados de check-in (sono, humor, comida, exercício pontual).
3. Preserve detalhes que importam para lembrar no futuro (nomes, datas de eventos, preferências).
4. NÃO invente nada que não esteja nos fatos. Não adicione interpretação.
5. NÃO use markdown, listas nem cabeçalhos — apenas um parágrafo corrido.

Retorne APENAS o texto do resumo.`;

  const raw = await callLLM(system, user, {
    maxTokens: 500,
    temperature: 0.3,
    model: COMPILE_MODEL,
    feature: "maya_memory_compile",
    userId,
  });
  const summary = raw.trim();
  return summary.length >= 10 ? summary : null;
}

async function compileUser(admin: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<boolean> {
  // Ids já cobertos por algum resumo anterior.
  const { data: summaryRows } = await admin
    .from("memory_summaries")
    .select("source_memory_ids")
    .eq("user_id", userId);
  const summarized = new Set<string>();
  for (const s of summaryRows ?? []) {
    for (const id of (s.source_memory_ids as string[]) ?? []) summarized.add(id);
  }

  const { data: facts } = await admin
    .from("user_memories")
    .select("id, fact, created_at")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  const pending = (facts ?? []).filter((f) => !summarized.has(f.id)).slice(0, MAX_FACTS);
  if (pending.length < COMPILE_THRESHOLD) return false;

  const summary = await summarizeFacts(pending.map((f) => f.fact), userId);
  if (!summary) return false;

  const createds = pending.map((f) => f.created_at as string).filter(Boolean).sort();
  const periodStart = createds.length ? getLocalDateFromISO(createds[0]) : getLocalDate();
  const periodEnd = createds.length ? getLocalDateFromISO(createds[createds.length - 1]) : getLocalDate();

  const { error: insErr } = await admin.from("memory_summaries").insert({
    user_id: userId,
    period_start: periodStart,
    period_end: periodEnd,
    granularity: spanGranularity(periodStart, periodEnd),
    summary,
    source_memory_ids: pending.map((f) => f.id),
  });
  if (insErr) throw insErr;
  return true;
}

export async function compileMemories(): Promise<{ candidates: number; compiled: number; failed: number }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("get_compile_candidates", { p_min: COMPILE_THRESHOLD });
  if (error) throw error;

  const candidates = (data ?? []) as Array<{ user_id: string }>;
  const users = candidates.slice(0, MAX_USERS).map((c) => c.user_id);

  let compiled = 0;
  let failed = 0;
  for (const userId of users) {
    try {
      if (await compileUser(admin, userId)) compiled++;
    } catch (e) {
      failed++;
      logError({ path: "memory-maintenance compile", message: String(e), userId });
    }
  }

  return { candidates: users.length, compiled, failed };
}
