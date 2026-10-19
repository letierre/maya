import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { embedQuery, toPgVector } from "@/lib/embeddings";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/memory — inspeção da memória de um usuário (admin only).
// Params:
//   ?userId=<uuid>  OU  ?email=<email>  → identifica o usuário
//   ?query=<texto>  (opcional)          → testa o recall por gatilho na hora
// Retorna fatos (com status de vetor), resumos compilados, log de ops e (se
// pedido) as memórias que o recall traria para uma mensagem.

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

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

  // ── Fatos + status de vetor ─────────────────────────────────────────
  // `count: "exact"` devolve o TOTAL real (ignora o limit), para o contador
  // não mentir quando o usuário tem mais do que o teto de exibição.
  const [{ data: facts, count: totalFacts }, { count: activeFacts }, { data: vectors }] = await Promise.all([
    admin.from("user_memories")
      .select("id, fact, kind, event_date, temporal_hint, importance, confidence, archived, superseded_by, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("user_memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("archived", false),
    admin.from("memory_vectors")
      .select("ref_id")
      .eq("user_id", userId)
      .eq("ref_type", "fact"),
  ]);
  const vectorSet = new Set((vectors ?? []).map((v) => v.ref_id));
  const memories = (facts ?? []).map((f) => ({
    ...f,
    has_vector: vectorSet.has(f.id),
  }));

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
  return NextResponse.json({
    userId,
    email: userEmail,
    counts: {
      total,
      active,
      archived: total - active,
      vectorCount: vectors?.length ?? 0,
      withoutVector: memories.filter((m) => !m.has_vector).length,
      summaries: summaries?.length ?? 0,
    },
    memories,
    summaries: summaries ?? [],
    ops: ops ?? [],
    errors: memErrs,
    recall,
  });
}
