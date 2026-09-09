import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-send";

// GET /api/cron/trial-reminders — avisa (push) quem está nas últimas 24h do trial sem cartão.
// Agendado via pg_cron (Supabase) — ver migration 046_trial_reminder.sql.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  // Usuários em trial, ainda não lembrados, com expiração dentro de 24h.
  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("user_id, trial_ends_at")
    .eq("status", "trialing")
    .is("trial_reminded_at", null)
    .gt("trial_ends_at", new Date(now).toISOString())
    .lte("trial_ends_at", new Date(in24h).toISOString());

  if (error) {
    console.error("trial-reminders query error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const s of subs ?? []) {
    const n = await sendPushToUser(s.user_id, {
      title: "⏳ Seu teste grátis está acabando",
      body: "Faltam menos de 24h. Assine para continuar sua jornada com a Maya.",
      tag: "trial-ending",
      data: { url: "/assinar" },
    });

    // Marca como lembrado mesmo se o envio falhar, para não repetir a cada rodada.
    await admin
      .from("subscriptions")
      .update({ trial_reminded_at: new Date().toISOString() })
      .eq("user_id", s.user_id);

    if (n > 0) sent++;
  }

  return NextResponse.json({ ok: true, sent, checked: subs?.length ?? 0 });
}
