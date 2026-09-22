import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToAdmins } from "@/lib/push-send";
import { getLocalDate, getLocalDateFromISO } from "@/lib/utils";
import { costUsd } from "@/lib/ai-usage";
import { logError } from "@/lib/error-log";

// ── Helpers de data (server-side, fallback São Paulo UTC-3) ──────────
function pad2(n: number): string { return String(n).padStart(2, "0"); }
function toYMD(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function shiftYMD(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

// GET /api/cron/admin-digest — resumo diário por push aos admins.
// Agendado via pg_cron (migration 061) às 21:00 (São Paulo) = 00:00 UTC.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const today = getLocalDate();
    const d7 = shiftYMD(today, -6);
    const iso24 = new Date(Date.now() - 86400000).toISOString();
    const iso7 = new Date(Date.now() - 7 * 86400000).toISOString();

    // Cadastros (auth.users) — hoje e últimos 7 dias
    let signupsToday = 0, signups7d = 0;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (!u.created_at) continue;
        const d = getLocalDateFromISO(u.created_at);
        if (d === today) signupsToday++;
        if (d >= d7) signups7d++;
      }
      if (data.users.length < 1000) break;
    }

    // Ativos hoje (DAU) e 7d (WAU)
    const { data: checkins } = await admin.from("check_ins").select("date, user_id");
    const dauSet = new Set<string>();
    const wauSet = new Set<string>();
    for (const c of checkins ?? []) {
      if (!c.user_id || !c.date) continue;
      if (c.date === today) dauSet.add(c.user_id);
      if (c.date >= d7) wauSet.add(c.user_id);
    }

    // Assinaturas (contagem local — o valor exato fica na aba Receita)
    const { data: subs } = await admin.from("subscriptions").select("status");
    let active = 0, trial = 0;
    for (const s of subs ?? []) {
      if (s.status === "active") active++;
      else if (s.status === "trialing") trial++;
    }

    // Custo de IA (7d, real via tokens)
    let ai7d = 0;
    try {
      const { data: usage } = await admin.from("ai_usage").select("model, input_tokens, output_tokens").gte("created_at", iso7);
      for (const u of usage ?? []) ai7d += costUsd(u.model, u.input_tokens ?? 0, u.output_tokens ?? 0);
    } catch { /* tabela ai_usage pode não existir ainda */ }

    // Erros (24h) e sinais de risco (hoje)
    let errors24h = 0;
    try {
      const { count } = await admin.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", iso24);
      errors24h = count ?? 0;
    } catch { /* error_logs pode não existir ainda */ }
    let safetyToday = 0;
    try {
      const { count } = await admin.from("safety_flags").select("*", { count: "exact", head: true }).eq("date", today);
      safetyToday = count ?? 0;
    } catch { /* safety_flags pode não existir ainda */ }

    const lines = [
      `Ativos hoje: ${dauSet.size} · Novos: ${signupsToday} (7d: ${signups7d})`,
      `Assinantes: ${active} · Trial: ${trial} · IA 7d: US$ ${ai7d.toFixed(2)}`,
    ];
    const alerts: string[] = [];
    if (signupsToday === 0) alerts.push("nenhum cadastro hoje");
    if (errors24h > 0) alerts.push(`${errors24h} erro(s) em 24h`);
    if (safetyToday > 0) alerts.push(`${safetyToday} sinal(is) de risco hoje`);
    if (alerts.length > 0) lines.push(`⚠️ ${alerts.join(" · ")}`);

    const sent = await sendPushToAdmins({
      title: "📊 Resumo diário — Maya",
      body: lines.join("\n"),
      tag: "admin-digest",
      data: { url: "/admin" },
    });

    return NextResponse.json({
      ok: true,
      sent,
      dau: dauSet.size,
      wau: wauSet.size,
      signupsToday,
      signups7d,
      active,
      trial,
      ai7d: +ai7d.toFixed(2),
      errors24h,
      safetyToday,
    });
  } catch (error) {
    console.error("GET /api/cron/admin-digest error:", error);
    logError({ path: "api/cron/admin-digest", message: String(error) });
    return NextResponse.json({ error: "Erro no resumo diário" }, { status: 500 });
  }
}
