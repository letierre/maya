import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { embedDocuments, toPgVector } from "@/lib/embeddings";
import { logError } from "@/lib/error-log";
import { t as tt, type Lang } from "@/lib/i18n";

/**
 * Memória de RECORRÊNCIA de alertas da Maya.
 *
 * Os sinais de bem-estar (sono, humor, social/isolamento, hidratação…) são
 * calculados "do zero" a cada dia. Sem esta camada, o mesmo alerta é re-emitido
 * idêntico todo dia, sem memória, sem mudar o tom, sem parar.
 *
 * Aqui guardamos, POR sinal, há quantos dias consecutivos ele vem disparando e
 * em que ESTÁGIO está — para a Maya escalar o tom (dica → reflexão → conversa)
 * em vez de repetir a mesma cobrança por semanas.
 *
 * Estado em `user_preferences.context.maya_alert_memory` (mesmo padrão do
 * `maya_nudge`/`maya_persona`). 100% determinístico, sem LLM.
 */

export type AlertStage = "recente" | "recorrente" | "persistente" | "cronico";

/** O que as superfícies (CareList, home message, nudge) precisam saber. */
export interface AlertRecurrence {
  /** Dias consecutivos que o alerta vem disparando. */
  consecutiveDays: number;
  stage: AlertStage;
  firstSeen: string; // YYYY-MM-DD
  shownCount: number;
}

export interface AlertMemoryEntry extends AlertRecurrence {
  /** Último dia em que o alerta disparou (para calcular consecutividade). */
  lastActive: string; // YYYY-MM-DD
  /** Já gravamos o fato de longo prazo quando virou crônico? (evita duplicar). */
  memoryWritten?: boolean;
}

export type AlertMemory = Record<string, AlertMemoryEntry>;

/** Traduz dias consecutivos em estágio de escalada. */
export function stageFor(days: number): AlertStage {
  if (days >= 14) return "cronico";
  if (days >= 7) return "persistente";
  if (days >= 3) return "recorrente";
  return "recente";
}

/**
 * Avança a memória de recorrência (pura, sem I/O). Para cada sinal ATIVO hoje:
 * mantém a sequência se `lastActive === ontem`, senão recomeça. Sinais inativos
 * simplesmente caem fora (uma nova sequência recomeça do zero quando voltarem).
 */
export function nextAlertMemory(
  prev: AlertMemory,
  activeIds: string[],
  today: string,
  yesterday: string,
): AlertMemory {
  const next: AlertMemory = {};
  for (const id of activeIds) {
    const p = prev[id];
    const continuing = !!p && p.lastActive === yesterday;
    const consecutiveDays = continuing ? p.consecutiveDays + 1 : 1;
    next[id] = {
      firstSeen: continuing ? p.firstSeen : today,
      lastActive: today,
      consecutiveDays,
      shownCount: (continuing ? p.shownCount : 0) + 1,
      stage: stageFor(consecutiveDays),
      memoryWritten: continuing ? p.memoryWritten : false,
    };
  }
  return next;
}

/** Persiste a memória de recorrência (best-effort, não derruba o sinal). */
export async function saveAlertMemory(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  context: Record<string, unknown>,
  memory: AlertMemory,
): Promise<void> {
  try {
    await admin
      .from("user_preferences")
      .update({ context: { ...context, maya_alert_memory: memory } })
      .eq("user_id", userId);
  } catch {
    /* best-effort */
  }
}

// ── Fato de longo prazo (quando um sinal vira crônico) ────────────────────────
// Mapa sinal → chave i18n do fato. Extensível: basta adicionar uma chave aqui e
// no dict. Por ora cobre o caso mais importante (isolamento social).
const CHRONIC_FACT_KEYS: Record<string, string> = {
  social: "mem_signal_social",
};

/**
 * Grava UM fato na memória de longo prazo da Maya quando um padrão vira crônico,
 * para o chat/home carregarem o contexto mesmo depois que o alerta parar de
 * aparecer. Reusa o RPC `insert_memory_fact` (pgvector). Idempotente: pula se já
 * existir um fato quase idêntico (protege contra o disparo em paralelo de duas
 * superfícies — home-message e nudge rodam juntos na home).
 */
export async function writeChronicMemory(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  signalId: string,
  lang: Lang,
): Promise<void> {
  const key = CHRONIC_FACT_KEYS[signalId];
  if (!key) return;
  const fact = tt(lang, key);
  if (!fact) return;

  const [vec] = await embedDocuments([fact], { userId, feature: "maya_memory_embeddings" });
  if (!vec || vec.length === 0) return;
  const vectorStr = toPgVector(vec);

  const { data: similar } = await admin.rpc("match_memory_facts", {
    p_user_id: userId,
    query_embedding: vectorStr,
    match_count: 1,
  });
  const best = (similar ?? [])[0] as { similarity?: number | string } | undefined;
  if (best && Number(best.similarity) > 0.9) return; // já existe

  const { error } = await admin.rpc("insert_memory_fact", {
    p_user_id: userId,
    p_fact: fact,
    p_kind: "episode",
    p_event_date: null,
    p_temporal_hint: null,
    p_source: "sinal",
    p_importance: 2,
    p_confidence: 0.9,
    p_embedding: vectorStr,
  });
  if (error) {
    logError({ path: "alert-memory writeChronicMemory", message: String(error.message ?? error), userId });
  }
}
