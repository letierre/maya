import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { embedQuery, toPgVector } from "@/lib/embeddings";
import { backfillEmbeddings, compileMemories } from "@/lib/memory-maintenance";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false as const, status: 401 };
  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200, admin };
}

// GET /api/admin/memory — inspeção da memória de um usuário (admin only).
// Params:
//   ?userId=<uuid>  OU  ?email=<email>  → identifica o usuário
//   ?query=<texto>  (opcional)          → testa o recall por gatilho na hora
// Retorna fatos (com status de vetor), resumos compilados, log de ops e (se
// pedido) as memórias que o recall traria para uma mensagem.

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso negado" }, { status: auth.status });
  const admin = auth.admin!;

  const { searchParams } = new URL(req.url);
  let userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const query = searchParams.get("query")?.trim();

  // Resolve email → id se preciso.
  let userEmail = email ?? null;
  if (!userId && email) {
    for (let page = 1; page <= 50; page++) {
      const { data: usersPage, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !usersPage?.users?.length) break;
      const hit = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (hit) { userId = hit.id; userEmail = hit.email ?? email; break; }
      if (usersPage.users.length < 1000) break;
    }
  }
  if (!userId) return NextResponse.json({ error: "userId ou email não encontrado" }, { status: 404 });

  // ── Fatos (página, com flag de vetor via join SQL) + contagens exatas ──
  // O PostgREST devolve no máx. 1000 linhas por query; usamos funções SQL que
  // fazem o join direto (paginação + contagem) para não cegar além de 1000.
  const PAGE = 500;
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  const [{ data: facts }, { count: totalFacts }, { count: activeFacts }, { data: unembedded }] = await Promise.all([
    admin.rpc("get_user_memories", { p_user_id: userId, p_offset: offset, p_limit: PAGE }),
    admin.from("user_memories").select("*", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("user_memories").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("archived", false),
    admin.rpc("count_unembedded_facts", { p_user_id: userId }),
  ]);
  const memories = (facts ?? []) as Array<Record<string, unknown> & { has_vector: boolean }>;

  // ── Erros recentes de memória/embeddings (diagnóstico) ──────────────
  let memErrs: { path: string; message: string; created_at: string }[] = [];
  try {
    const { data: errs } = await admin.from("error_logs")
      .select("path, message, created_at")
      .or("path.ilike.%memory%,path.ilike.%voyage%,path.ilike.%embed%")
      .order("created_at", { ascending: false })
      .limit(50);
    memErrs = (errs ?? []) as typeof memErrs;
  } catch {
    /* error_logs pode não existir */
  }

  // ── Resumos compilados ──────────────────────────────────────────────
  const { data: summaries } = await admin.from("memory_summaries")
    .select("id, summary, period_start, period_end, granularity, source_memory_ids, created_at")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .limit(30);

  // ── Log de operações ────────────────────────────────────────────────
  const { data: ops } = await admin.from("memory_ops")
    .select("op, ref_type, ref_id, detail, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  // ── Recall por gatilho (teste) ──────────────────────────────────────
  let recall: { query: string; matches: { memory_id: string; fact: string; similarity: number }[]; error?: string } | null = null;
  if (query) {
    try {
      const vec = await embedQuery(query);
      const { data, error } = await admin.rpc("match_memory_facts", {
        p_user_id: userId,
        query_embedding: toPgVector(vec),
        match_count: 8,
      });
      if (error) throw error;
      recall = {
        query,
        matches: ((data ?? []) as Array<{ memory_id: string; fact: string; similarity: number }>).map((r) => ({
          memory_id: r.memory_id,
          fact: r.fact,
          similarity: Number(r.similarity) || 0,
        })),
      };
    } catch (e) {
      recall = { query, matches: [], error: String(e) };
    }
  }

  const total = totalFacts ?? 0;
  const active = activeFacts ?? 0;
  const unembeddedCount = Number(unembedded ?? 0);
  return NextResponse.json({
    userId,
    email: userEmail,
    counts: {
      total,
      active,
      archived: total - active,
      vectorCount: active - unembeddedCount,
      withoutVector: unembeddedCount,
      summaries: summaries?.length ?? 0,
    },
    memories,
    offset,
    pageSize: PAGE,
    hasMore: offset + memories.length < total,
    summaries: summaries ?? [],
    ops: ops ?? [],
    errors: memErrs,
    recall,
  });
}

// POST /api/admin/memory?action=backfill|compile — força a manutenção de memória
// manualmente (admin only). Útil para diagnosticar sem depender do cron.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso negado" }, { status: auth.status });

  const action = new URL(req.url).searchParams.get("action") || "backfill";
  try {
    if (action === "compile") {
      return NextResponse.json({ ok: true, ...(await compileMemories()) });
    }
    return NextResponse.json({ ok: true, ...(await backfillEmbeddings()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
