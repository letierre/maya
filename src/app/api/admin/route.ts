import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate, getLocalDateFromISO } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

type Admin = ReturnType<typeof getSupabaseAdmin>;

// ── Helpers de data (server-side, fallback São Paulo UTC-3) ──────────
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function toYMD(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function shiftYMD(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

// ── Auth + verificação de admin (canônico: user_roles.is_admin) ──────
async function requireAdmin(): Promise<{ ok: boolean; status: number; admin: Admin | null }> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, status: 401, admin: null };

  const admin = getSupabaseAdmin();
  const { data: role } = await admin
    .from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return { ok: false, status: 403, admin: null };
  return { ok: true, status: 200, admin };
}

// Lista todos os usuários de auth (paginação do GoTrue, máx. 1000/página).
async function getAllUsers(admin: Admin): Promise<{ created_at: string }[]> {
  const out: { created_at: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) out.push({ created_at: u.created_at ?? "" });
    if (data.users.length < 1000) break;
  }
  return out;
}

// GET /api/admin — visão geral (KPIs) + denúncias (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso negado" }, { status: auth.status });
  const admin = auth.admin!;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "overview";

  if (type === "reports") {
    const { data: reports } = await admin.from("community_reports").select(`
      id, reason, created_at,
      post_id, reported_by,
      community_posts!inner(id, content, display_name, created_at)
    `).order("created_at", { ascending: false }).limit(50);
    return NextResponse.json(reports || []);
  }

  const today = getLocalDate();
  const start30 = shiftYMD(today, -29);

  // 1. Usuários (auth.users) → total + série de cadastros (últimos 30d)
  const users = await getAllUsers(admin);
  const totalUsers = users.length;
  const signupsByDay: { date: string; count: number }[] = [];
  const signupCounts: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = shiftYMD(today, -29 + i);
    signupCounts[d] = 0;
  }
  for (const u of users) {
    if (!u.created_at) continue;
    const d = getLocalDateFromISO(u.created_at);
    if (d in signupCounts) signupCounts[d]++;
  }
  for (let i = 0; i < 30; i++) {
    const d = shiftYMD(today, -29 + i);
    signupsByDay.push({ date: d, count: signupCounts[d] });
  }

  // 2. Check-ins (todos) → DAU/WAU/MAU + série + 1º check-in + retenção
  const { data: checkins } = await admin.from("check_ins").select("date, user_id");
  const dauSet = new Set<string>();
  const wauSet = new Set<string>();
  const mauSet = new Set<string>();
  const activeCounts: Record<string, Set<string>> = {};
  for (let i = 0; i < 30; i++) activeCounts[shiftYMD(today, -29 + i)] = new Set();

  const byUser = new Map<string, Set<string>>(); // user_id → datas (YYYY-MM-DD)
  for (const c of checkins ?? []) {
    if (!c.user_id || !c.date) continue;
    if (c.date === today) dauSet.add(c.user_id);
    if (c.date >= shiftYMD(today, -6)) wauSet.add(c.user_id);
    if (c.date >= start30) mauSet.add(c.user_id);
    if (activeCounts[c.date]) activeCounts[c.date].add(c.user_id);
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, new Set());
    byUser.get(c.user_id)!.add(c.date);
  }

  const activeByDay: { date: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = shiftYMD(today, -29 + i);
    activeByDay.push({ date: d, count: activeCounts[d]?.size ?? 0 });
  }

  const dau = dauSet.size;
  const wau = wauSet.size;
  const mau = mauSet.size;
  const stickiness = mau > 0 ? +(dau / mau).toFixed(3) : 0;

  // Retenção D1/D7/D30 a partir do 1º check-in de cada usuário
  let d1Num = 0, d1Den = 0, d7Num = 0, d7Den = 0, d30Num = 0, d30Den = 0;
  for (const dates of byUser.values()) {
    const sorted = [...dates].sort();
    const first = sorted[0];
    if (first <= shiftYMD(today, -1)) { d1Den++; if (dates.has(shiftYMD(first, 1))) d1Num++; }
    if (first <= shiftYMD(today, -7)) {
      d7Den++;
      for (const d of sorted) { if (d > first && d <= shiftYMD(first, 7)) { d7Num++; break; } }
    }
    if (first <= shiftYMD(today, -30)) {
      d30Den++;
      for (const d of sorted) { if (d > first && d <= shiftYMD(first, 30)) { d30Num++; break; } }
    }
  }
  const retention = {
    d1: d1Den ? +(d1Num / d1Den).toFixed(3) : 0,
    d7: d7Den ? +(d7Num / d7Den).toFixed(3) : 0,
    d30: d30Den ? +(d30Num / d30Den).toFixed(3) : 0,
  };

  // 3. Ativação (onboarding concluído)
  const { count: onboarded } = await admin
    .from("user_preferences").select("*", { count: "exact", head: true })
    .eq("onboarding_completed", true)
    .then(r => ({ count: r.count ?? 0 }));

  // 4. Assinaturas (mix de plano + contagens de status)
  const { data: subs } = await admin.from("subscriptions").select("plan, status");
  let monthly = 0, annual = 0, trialCount = 0, activeCount = 0, canceledCount = 0, pastDueCount = 0;
  for (const s of subs ?? []) {
    if (s.status === "active") { activeCount++; if (s.plan === "annual") annual++; else monthly++; }
    else if (s.status === "trialing") trialCount++;
    else if (s.status === "canceled") canceledCount++;
    else if (s.status === "past_due") pastDueCount++;
  }

  // 5. Atribuição (UTM) — agrupado por origem; defensivo (tabela pode não existir ainda)
  let utmSources: { source: string; count: number }[] = [];
  try {
    const { data: obRows } = await admin.from("onboarding_responses").select("utm_source");
    const utmCounts: Record<string, number> = {};
    for (const o of obRows ?? []) {
      const s = (o?.utm_source as string | null)?.trim();
      if (!s) continue;
      utmCounts[s] = (utmCounts[s] ?? 0) + 1;
    }
    utmSources = Object.entries(utmCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch {
    utmSources = [];
  }

  // 5.5 Custo de IA estimado (30d) — constantes aproximadas em USD, documentadas.
  const AI_COST_PER_CHECKIN = 0.04; // batch de 8 especialistas (Haiku) a cada check-in (~US$1,14/mês ÷ 30)
  const AI_COST_PER_CHAT = 0.01;    // mensagem no chat Maya
  const AI_COST_PER_PHOTO = 0.02;   // foto de refeição (Sonnet, visão)
  let aiCost = { usd: 0, checkins30d: 0, chat30d: 0, mealPhotos30d: 0 };
  try {
    const checkins30d = (checkins ?? []).filter(c => c.date >= start30).length;
    const iso30 = new Date(start30 + "T00:00:00.000Z").toISOString();
    const { count: chat30d } = await admin.from("chat_messages").select("*", { count: "exact", head: true }).gte("created_at", iso30).then(r => ({ count: r.count ?? 0 }));
    const { count: mealPhotos30d } = await admin.from("meals").select("*", { count: "exact", head: true }).gte("criado_em", iso30).not("foto_path", "is", null).then(r => ({ count: r.count ?? 0 }));
    aiCost = {
      usd: +(checkins30d * AI_COST_PER_CHECKIN + chat30d * AI_COST_PER_CHAT + mealPhotos30d * AI_COST_PER_PHOTO).toFixed(2),
      checkins30d,
      chat30d,
      mealPhotos30d,
    };
  } catch {
    /* tabelas chat_messages/meals podem não existir — mantém zeros */
  }

  // 6. Contagens legadas (mantidas para o antigo grid)
  const { count: totalPosts } = await admin.from("community_posts").select("*", { count: "exact", head: true }).then(r => ({ count: r.count ?? 0 }));
  const { count: totalComments } = await admin.from("community_comments").select("*", { count: "exact", head: true }).then(r => ({ count: r.count ?? 0 }));
  const { count: totalCheckins } = await admin.from("check_ins").select("*", { count: "exact", head: true }).then(r => ({ count: r.count ?? 0 }));
  const { count: totalDiary } = await admin.from("diary_entries").select("*", { count: "exact", head: true }).then(r => ({ count: r.count ?? 0 }));
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count: mapboxLoads } = await admin.from("mapbox_usage").select("*", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()).then(r => ({ count: r.count ?? 0 }));

  return NextResponse.json({
    users: totalUsers,
    signupsByDay,
    dau,
    wau,
    mau,
    stickiness,
    activeByDay,
    funnel: {
      signup: totalUsers,
      onboarding: onboarded,
      firstCheckin: byUser.size,
      trial: trialCount,
      paid: activeCount,
    },
    retention,
    planMix: { monthly, annual },
    trialCount,
    activeCount,
    canceledCount,
    pastDueCount,
    utmSources,
    aiCost,
    posts: totalPosts,
    comments: totalComments,
    checkins: totalCheckins,
    diary: totalDiary,
    mapboxLoads,
  });
}

// POST /api/admin — set admin/tester flag (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Acesso negado" }, { status: auth.status });
  const admin = auth.admin!;

  const { userId, flag, value } = await req.json();
  if (!userId || !flag) return NextResponse.json({ error: "userId e flag obrigatórios" }, { status: 400 });

  const { data: targetPrefs } = await admin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  const targetCtx = (targetPrefs?.context || {}) as Record<string, unknown>;
  targetCtx[flag] = value;

  await admin.from("user_preferences").upsert({
    user_id: userId,
    context: targetCtx,
    enabled_questions: targetPrefs?.enabled_questions || [],
    onboarding_completed: targetPrefs?.onboarding_completed ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  return NextResponse.json({ ok: true });
}
