import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextResponse } from "next/server";

// ── Helpers de data (server-side, São Paulo UTC-3) ───────────────────
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function toYMD(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function shiftYMD(s: string, days: number): string {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

// Módulos para correlação (mesmo mapeamento da rota insights).
const MODULES: { key: string; label: string; table: string }[] = [
  { key: "checkin", label: "Check-in", table: "check_ins" },
  { key: "diario", label: "Diário", table: "diary_entries" },
  { key: "nutricao", label: "Nutrição", table: "meals" },
  { key: "sono", label: "Sono", table: "sleep_logs" },
  { key: "financas", label: "Finanças", table: "financial_transactions" },
  { key: "leitura", label: "Leitura", table: "reading_sessions" },
  { key: "corrida", label: "Corrida", table: "running_sessions" },
  { key: "metas", label: "Metas", table: "goals" },
  { key: "agenda", label: "Agenda/Plano", table: "agenda_items" },
  { key: "maya_chat", label: "Maya (chat)", table: "chat_messages" },
  { key: "comunidade", label: "Comunidade", table: "community_posts" },
];
const labelOf = (key: string) => MODULES.find(m => m.key === key)?.label ?? key;

// Sequência atual (dias consecutivos terminando hoje ou ontem).
function computeStreak(dates: Set<string>, today: string, yesterday: string): number {
  let anchor: string;
  if (dates.has(today)) anchor = today;
  else if (dates.has(yesterday)) anchor = yesterday;
  else return 0;
  let streak = 0;
  let d = anchor;
  while (dates.has(d)) { streak++; d = shiftYMD(d, -1); }
  return streak;
}

// GET /api/admin/patterns — padrões avançados de uso (admin only)
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const today = getLocalDate();
  const yesterday = shiftYMD(today, -1);

  // ── Check-ins (base para hora, streak, retenção) ───────────────────
  const { data: checkins } = await admin.from("check_ins").select("date, user_id, created_at");

  // 1. Horário de uso (hora local São Paulo, UTC-3 sem DST)
  const hours = new Array(24).fill(0);
  const byUser = new Map<string, Set<string>>();
  for (const c of checkins ?? []) {
    if (c.created_at) {
      const h = ((new Date(c.created_at).getUTCHours() - 3) + 24) % 24;
      hours[h]++;
    }
    if (c.user_id && c.date) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, new Set());
      byUser.get(c.user_id)!.add(c.date);
    }
  }

  // 2. Streaks (sequência atual, distribuída em faixas)
  const buckets = { "0": 0, "1": 0, "2-3": 0, "4-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
  for (const dates of byUser.values()) {
    const s = computeStreak(dates, today, yesterday);
    const b = s === 0 ? "0" : s === 1 ? "1" : s <= 3 ? "2-3" : s <= 7 ? "4-7" : s <= 14 ? "8-14" : s <= 30 ? "15-30" : "30+";
    buckets[b as keyof typeof buckets]++;
  }
  const streaks = Object.entries(buckets).map(([label, count]) => ({ label, count }));

  // 3. Retenção por idioma/gênero (D7/D30 a partir do 1º check-in)
  let langByUser = new Map<string, string>();
  let genderByUser = new Map<string, string>();
  try {
    const { data: prefs } = await admin.from("user_preferences").select("user_id, context");
    for (const p of prefs ?? []) {
      const ctx = (p.context || {}) as Record<string, string>;
      if (ctx.language) langByUser.set(p.user_id, ctx.language);
      if (ctx.gender) genderByUser.set(p.user_id, ctx.gender);
    }
  } catch { /* user_preferences pode não existir */ }

  interface Seg { users: number; d7Num: number; d7Den: number; d30Num: number; d30Den: number; }
  const seg = (): Seg => ({ users: 0, d7Num: 0, d7Den: 0, d30Num: 0, d30Den: 0 });
  const langAgg: Record<string, Seg> = {};
  const genderAgg: Record<string, Seg> = {};
  const d7Cut = shiftYMD(today, -7);
  const d30Cut = shiftYMD(today, -30);

  for (const [uid, dates] of byUser) {
    const sorted = [...dates].sort();
    const first = sorted[0];
    const d7Eligible = first <= d7Cut;
    const d30Eligible = first <= d30Cut;
    let d7Retained = false, d30Retained = false;
    for (const d of sorted) {
      if (d > first && d <= shiftYMD(first, 7)) d7Retained = true;
      if (d > first && d <= shiftYMD(first, 30)) d30Retained = true;
    }

    const lang = langByUser.get(uid) || "other";
    const ls = (langAgg[lang] ??= seg());
    ls.users++;
    if (d7Eligible) { ls.d7Den++; if (d7Retained) ls.d7Num++; }
    if (d30Eligible) { ls.d30Den++; if (d30Retained) ls.d30Num++; }

    const g = genderByUser.get(uid) || "other";
    const gs = (genderAgg[g] ??= seg());
    gs.users++;
    if (d7Eligible) { gs.d7Den++; if (d7Retained) gs.d7Num++; }
    if (d30Eligible) { gs.d30Den++; if (d30Retained) gs.d30Num++; }
  }

  const toRows = (agg: Record<string, Seg>) => Object.entries(agg)
    .map(([key, s]) => ({
      key,
      users: s.users,
      d7: s.d7Den ? +(s.d7Num / s.d7Den).toFixed(2) : null,
      d30: s.d30Den ? +(s.d30Num / s.d30Den).toFixed(2) : null,
    }))
    .sort((a, b) => b.users - a.users);
  const retentionByLang = toRows(langAgg);
  const retentionByGender = toRows(genderAgg);

  // 4. Conversão por origem UTM (trial → pago)
  let utmConversion: { source: string; trial: number; paid: number; rate: number | null }[] = [];
  try {
    const { data: subs } = await admin.from("subscriptions").select("user_id, status");
    const { data: ob } = await admin.from("onboarding_responses").select("user_id, utm_source");
    const srcByUser = new Map<string, string>();
    for (const o of ob ?? []) if (o?.utm_source) srcByUser.set(o.user_id, String(o.utm_source).trim());

    const bySrc: Record<string, { trial: number; paid: number }> = {};
    for (const s of subs ?? []) {
      const src = srcByUser.get(s.user_id) || "(direto)";
      const b = (bySrc[src] ??= { trial: 0, paid: 0 });
      if (s.status === "active" || s.status === "canceled" || s.status === "past_due") b.paid++;
      else if (s.status === "trialing") b.trial++;
    }
    utmConversion = Object.entries(bySrc)
      .map(([source, { trial, paid }]) => ({
        source,
        trial,
        paid,
        rate: paid + trial > 0 ? +(paid / (paid + trial)).toFixed(2) : null,
      }))
      .sort((a, b) => (b.paid + b.trial) - (a.paid + a.trial))
      .slice(0, 12);
  } catch { utmConversion = []; }

  // 5. Correlação entre módulos (co-ocorrência, Jaccard)
  const moduleUsers = new Map<string, Set<string>>();
  for (const m of MODULES) {
    const set = new Set<string>();
    try {
      const { data: rows } = await admin.from(m.table).select("user_id");
      for (const r of rows ?? []) if (r.user_id) set.add(r.user_id);
    } catch { /* tabela inexistente */ }
    moduleUsers.set(m.key, set);
  }
  const pairs: { a: string; b: string; labelA: string; labelB: string; shared: number; jaccard: number }[] = [];
  const keys = [...moduleUsers.keys()];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const A = moduleUsers.get(keys[i])!;
      const B = moduleUsers.get(keys[j])!;
      let shared = 0;
      for (const u of A) if (B.has(u)) shared++;
      if (shared === 0) continue;
      const union = A.size + B.size - shared;
      pairs.push({ a: keys[i], b: keys[j], labelA: labelOf(keys[i]), labelB: labelOf(keys[j]), shared, jaccard: union > 0 ? +(shared / union).toFixed(2) : 0 });
    }
  }
  const cooccurrence = pairs.sort((x, y) => y.shared - x.shared).slice(0, 12);

  return NextResponse.json({ hours, streaks, retentionByLang, retentionByGender, utmConversion, cooccurrence });
}
