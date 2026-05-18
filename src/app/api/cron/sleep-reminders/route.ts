import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-send";

// Vercel calls this with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  // Current time in SP (always UTC-3, Brazil abolished DST in 2019)
  const now = new Date();
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const hh = spNow.getUTCHours().toString().padStart(2, "0");
  const mm = spNow.getUTCMinutes().toString().padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  const admin = getSupabaseAdmin();

  // All users that have at least one push subscription
  const { data: subs } = await admin.from("push_subscriptions").select("user_id");
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, time: currentTime });
  }
  const userIds = [...new Set(subs.map((s) => s.user_id))];

  // Load their sleep_config from user_preferences
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("user_id, context")
    .in("user_id", userIds);

  const reminderUsers: { userId: string; targetHours: number }[] = [];
  const wakeUsers: string[] = [];

  for (const pref of prefs ?? []) {
    const cfg = (pref.context as Record<string, unknown>)?.sleep_config as {
      reminder_time?: string;
      wake_time?: string;
      target_hours?: number;
    } | undefined;
    if (!cfg) continue;

    // Evening bedtime reminder
    if (cfg.reminder_time === currentTime) {
      reminderUsers.push({ userId: pref.user_id, targetHours: cfg.target_hours ?? 8 });
    }

    // Morning wake check-in: 30 min after wake_time
    if (cfg.wake_time) {
      const [wh, wm] = cfg.wake_time.split(":").map(Number);
      const totalMin = wh * 60 + wm + 30;
      const wakeHH = Math.floor(totalMin / 60) % 24;
      const wakeMM = totalMin % 60;
      const wakeTime = `${wakeHH.toString().padStart(2, "0")}:${wakeMM.toString().padStart(2, "0")}`;
      if (wakeTime === currentTime) {
        wakeUsers.push(pref.user_id);
      }
    }
  }

  let sent = 0;

  for (const { userId, targetHours } of reminderUsers) {
    const h = Number.isInteger(targetHours) ? `${targetHours}h` : `${targetHours}h`;
    sent += await sendPushToUser(userId, {
      title: "🌙 Hora de dormir",
      body: `Sua meta é ${h} de sono esta noite. Descanse bem!`,
      tag: "bedtime-reminder",
      data: { url: "/sono" },
    });
  }

  const today = `${spNow.getUTCFullYear()}-${String(spNow.getUTCMonth() + 1).padStart(2, "0")}-${String(spNow.getUTCDate()).padStart(2, "0")}`;

  for (const userId of wakeUsers) {
    sent += await sendPushToUser(userId, {
      title: "☀️ Bom dia! Como foi o sono?",
      body: "Registre rapidamente antes de começar o dia.",
      tag: "wake-checkin",
      data: { url: "/sono", date: today },
      actions: [
        { action: "quality_good", title: "😊 Bem" },
        { action: "quality_ok", title: "😐 Ok" },
        { action: "quality_bad", title: "😕 Mal" },
      ],
    });
  }

  return NextResponse.json({
    ok: true,
    time: currentTime,
    sent,
    reminders: reminderUsers.length,
    wakes: wakeUsers.length,
  });
}
