import { NextRequest, NextResponse } from "next/server";
import { backfillEmbeddings, compileMemories } from "@/lib/memory-maintenance";
import { logError } from "@/lib/error-log";

// GET /api/cron/memory-maintenance — manutenção da memória de longo prazo da Maya.
// Agendado via pg_cron (migration 066), a cada hora. Dois trabalhos idempotentes:
//   1) backfill de embeddings (memórias pré-Fase 2 sem vetor);
//   2) compilação L3 (destila fatos acumulados em memory_summaries).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const out: Record<string, unknown> = {};

  try {
    out.backfill = await backfillEmbeddings();
  } catch (e) {
    logError({ path: "api/cron/memory-maintenance backfill", message: String(e) });
    out.backfill = { error: String(e) };
  }

  try {
    out.compile = await compileMemories();
  } catch (e) {
    logError({ path: "api/cron/memory-maintenance compile", message: String(e) });
    out.compile = { error: String(e) };
  }

  return NextResponse.json({ ok: true, ...out });
}
