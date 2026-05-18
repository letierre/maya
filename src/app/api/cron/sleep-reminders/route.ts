import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-send";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  // SP is always UTC-3 (Brazil abolished DST in 2019)
  const now = new Date();
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const hh = spNow.getUTCHours().toString().padStart(2, "0");
  const mm = spNow.getUTCMinutes().toString().padStart(2, "0");
  const currentTime = `${hh}:${mm}`;
  const dayOfWeek = spNow.getUTCDay(); // 0 = Sunday
  const todaySP = [
    spNow.getUTCFullYear(),
    String(spNow.getUTCMonth() + 1).padStart(2, "0"),
    String(spNow.getUTCDate()).padStart(2, "0"),
  ].join("-");

  const admin = getSupabaseAdmin();

  // All users with push subscriptions
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, time: currentTime });
  }
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("user_id, context")
    .in("user_id", userIds);

  const log: Record<string, number> = {};
  let totalSent = 0;

  // ── Sleep reminders (user-configured times) ─────────────────────────────────
  for (const pref of prefs ?? []) {
    const cfg = ((pref.context ?? {}) as Record<string, unknown>).sleep_config as {
      reminder_time?: string;
      wake_time?: string;
      target_hours?: number;
    } | undefined;
    if (!cfg) continue;

    if (cfg.reminder_time === currentTime) {
      const h = cfg.target_hours ?? 8;
      totalSent += await sendPushToUser(pref.user_id, {
        title: "🌙 Hora de dormir",
        body: `Sua meta é ${h}h de sono esta noite. Descanse bem!`,
        tag: "bedtime-reminder",
        data: { url: "/sono" },
      });
    }

    if (cfg.wake_time) {
      const [wh, wm] = cfg.wake_time.split(":").map(Number);
      const total = wh * 60 + wm + 30;
      const wakeTime = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      if (wakeTime === currentTime) {
        totalSent += await sendPushToUser(pref.user_id, {
          title: "☀️ Bom dia! Como foi o sono?",
          body: "Registre rapidamente antes de começar o dia.",
          tag: "wake-checkin",
          data: { url: "/sono", date: todaySP },
          actions: [
            { action: "quality_good", title: "😊 Bem" },
            { action: "quality_ok", title: "😐 Ok" },
            { action: "quality_bad", title: "😕 Mal" },
          ],
        });
      }
    }
  }

  // ── Daily check-in reminder (20:00 — only if not done today) ────────────────
  if (currentTime === "20:00") {
    const { data: done } = await admin
      .from("check_ins")
      .select("user_id")
      .eq("date", todaySP)
      .in("user_id", userIds);

    const doneSet = new Set((done ?? []).map((c) => c.user_id));
    const pending = userIds.filter((uid) => !doneSet.has(uid));

    for (const userId of pending) {
      totalSent += await sendPushToUser(userId, {
        title: "📋 Check-in do dia",
        body: "Como foi hoje? Leva menos de 1 minuto.",
        tag: "daily-checkin",
        data: { url: "/check-in" },
      });
    }
    log.checkin = pending.length;
  }

  // ── Meal reminders (only if meal not yet logged in each window) ──────────────
  const mealSlots = [
    {
      time: "08:00",
      tipo: "cafe_da_manha",
      label: "café da manhã",
      emoji: "🌅",
      from: `${todaySP}T06:00:00-03:00`,
      to:   `${todaySP}T11:00:00-03:00`,
    },
    {
      time: "12:30",
      tipo: "almoco",
      label: "almoço",
      emoji: "☀️",
      from: `${todaySP}T11:00:00-03:00`,
      to:   `${todaySP}T14:00:00-03:00`,
    },
    {
      time: "19:30",
      tipo: "jantar",
      label: "jantar",
      emoji: "🌙",
      from: `${todaySP}T17:00:00-03:00`,
      to:   `${todaySP}T21:00:00-03:00`,
    },
  ];

  for (const slot of mealSlots) {
    if (currentTime !== slot.time) continue;

    const { data: logged } = await admin
      .from("meals")
      .select("user_id")
      .eq("tipo_refeicao", slot.tipo)
      .gte("data_hora", slot.from)
      .lt("data_hora", slot.to)
      .in("user_id", userIds);

    const loggedSet = new Set((logged ?? []).map((m) => m.user_id));
    const pending = userIds.filter((uid) => !loggedSet.has(uid));

    for (const userId of pending) {
      totalSent += await sendPushToUser(userId, {
        title: `${slot.emoji} Hora do ${slot.label}`,
        body: "Registre o que você comeu — foto ou descrição rápida.",
        tag: `meal-${slot.tipo}`,
        data: { url: "/nutricao/registrar" },
      });
    }
    log[slot.tipo] = pending.length;
  }

  // ── Weekly summary (Sundays at 19:00) ────────────────────────────────────────
  if (dayOfWeek === 0 && currentTime === "19:00") {
    for (const userId of userIds) {
      totalSent += await sendPushToUser(userId, {
        title: "📊 Resumo da semana",
        body: "Veja como foi sua semana — sono, hábitos e nutrição.",
        tag: "weekly-summary",
        data: { url: "/historico" },
      });
    }
    log.weekly = userIds.length;
  }

  return NextResponse.json({ ok: true, time: currentTime, sent: totalSent, ...log });
}
