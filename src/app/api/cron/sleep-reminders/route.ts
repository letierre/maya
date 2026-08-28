import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-send";
import { getLocalNow, getTimezoneOffset } from "@/lib/utils";
import { repeatMatches } from "@/lib/agenda-repeat";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();

  // All users with push subscriptions. `timezone` may be missing on legacy rows
  // or before the migration runs — fall back gracefully to user_id only.
  let subs: { user_id: string; timezone: string | null }[] = [];
  const { data: subsWithTz, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("user_id, timezone");
  if (subsErr) {
    const { data: fallback } = await admin.from("push_subscriptions").select("user_id");
    subs = (fallback ?? []).map((s) => ({ user_id: s.user_id, timezone: null }));
  } else {
    subs = (subsWithTz ?? []) as { user_id: string; timezone: string | null }[];
  }
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Per-user IANA timezone (default São Paulo)
  const tzByUser = new Map<string, string>();
  for (const s of subs) {
    if (!tzByUser.has(s.user_id)) tzByUser.set(s.user_id, s.timezone || "America/Sao_Paulo");
  }
  const userIds = [...tzByUser.keys()];

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("user_id, context")
    .in("user_id", userIds);
  const prefsByUser = new Map((prefs ?? []).map((p) => [p.user_id, p]));

  const log: Record<string, number> = {};
  let totalSent = 0;

  // Group users by timezone so each reminder fires at that zone's local time
  const usersByTz = new Map<string, string[]>();
  for (const [uid, tz] of tzByUser) {
    const arr = usersByTz.get(tz) ?? [];
    arr.push(uid);
    usersByTz.set(tz, arr);
  }

  for (const [tz, tzUserIds] of usersByTz) {
    const { time: currentTime, date: todaySP, dow: dayOfWeek } = getLocalNow(tz);

    // ── Sleep reminders (user-configured times) ─────────────────────────────
    for (const uid of tzUserIds) {
      const pref = prefsByUser.get(uid);
      if (!pref) continue;
      const cfg = ((pref.context ?? {}) as Record<string, unknown>).sleep_config as {
        reminder_time?: string;
        wake_time?: string;
        bedtime?: string;
        target_hours?: number;
      } | undefined;
      if (!cfg) continue;

      if (cfg.reminder_time === currentTime) {
        // Calcula meta de sono da janela bedtime→wake (fallback ao target_hours legado ou 8h)
        let h = cfg.target_hours ?? 8;
        if (!cfg.target_hours && cfg.bedtime && cfg.wake_time) {
          const [bh, bm] = cfg.bedtime.split(":").map(Number);
          const [wh, wm] = cfg.wake_time.split(":").map(Number);
          let bedMins = bh * 60 + bm;
          let wakeMins = wh * 60 + wm;
          if (wakeMins <= bedMins) wakeMins += 24 * 60;
          h = (wakeMins - bedMins) / 60;
        }
        totalSent += await sendPushToUser(uid, {
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
          totalSent += await sendPushToUser(uid, {
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

    // ── Daily check-in reminder (20:00 — only if not done today) ────────────
    if (currentTime === "20:00") {
      const { data: done } = await admin
        .from("check_ins")
        .select("user_id")
        .eq("date", todaySP)
        .in("user_id", tzUserIds);

      const doneSet = new Set((done ?? []).map((c) => c.user_id));
      const pending = tzUserIds.filter((uid) => !doneSet.has(uid));

      for (const userId of pending) {
        totalSent += await sendPushToUser(userId, {
          title: "📋 Check-in do dia",
          body: "Como foi hoje? Leva menos de 1 minuto.",
          tag: "daily-checkin",
          data: { url: "/check-in" },
        });
      }
      log.checkin = (log.checkin ?? 0) + pending.length;
    }

    // ── Meal reminders (only if meal not yet logged in each window) ──────────
    const offset = getTimezoneOffset(tz, todaySP);
    const mealSlots = [
      { time: "08:00", tipo: "cafe_da_manha", label: "café da manhã", emoji: "🌅", from: `${todaySP}T06:00:00${offset}`, to: `${todaySP}T11:00:00${offset}` },
      { time: "12:30", tipo: "almoco", label: "almoço", emoji: "☀️", from: `${todaySP}T11:00:00${offset}`, to: `${todaySP}T14:00:00${offset}` },
      { time: "19:30", tipo: "jantar", label: "jantar", emoji: "🌙", from: `${todaySP}T17:00:00${offset}`, to: `${todaySP}T21:00:00${offset}` },
    ];

    for (const slot of mealSlots) {
      if (currentTime !== slot.time) continue;

      const { data: logged } = await admin
        .from("meals")
        .select("user_id")
        .eq("tipo_refeicao", slot.tipo)
        .gte("data_hora", slot.from)
        .lt("data_hora", slot.to)
        .in("user_id", tzUserIds);

      const loggedSet = new Set((logged ?? []).map((m) => m.user_id));
      const pending = tzUserIds.filter((uid) => !loggedSet.has(uid));

      for (const userId of pending) {
        totalSent += await sendPushToUser(userId, {
          title: `${slot.emoji} Hora do ${slot.label}`,
          body: "Registre o que você comeu — foto ou descrição rápida.",
          tag: `meal-${slot.tipo}`,
          data: { url: "/nutricao/registrar" },
        });
      }
      log[slot.tipo] = (log[slot.tipo] ?? 0) + pending.length;
    }

    // ── Weekly summary (Sundays at 19:00) ────────────────────────────────────
    if (dayOfWeek === 0 && currentTime === "19:00") {
      for (const userId of tzUserIds) {
        totalSent += await sendPushToUser(userId, {
          title: "📊 Resumo da semana",
          body: "Veja como foi sua semana — sono, hábitos e nutrição.",
          tag: "weekly-summary",
          data: { url: "/historico" },
        });
      }
      log.weekly = (log.weekly ?? 0) + tzUserIds.length;
    }

    // ── Agenda appointment reminders ─────────────────────────────────────────
    const tomorrowSP = (() => {
      const d = new Date(todaySP + "T12:00:00");
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    const AGENDA_COLS =
      "id, user_id, title, date, start_time, notify_minutes, item_type, repeat_type, repeat_until, excluded, status";

    // Ocorrências exatas (não repetidas + data original de itens repetidos)
    const { data: exactItems } = await admin
      .from("agenda_items")
      .select(AGENDA_COLS)
      .in("date", [todaySP, tomorrowSP])
      .not("notify_minutes", "is", null)
      .not("start_time", "is", null)
      .in("user_id", tzUserIds);

    // Regras de repetição que podem gerar ocorrência hoje/amanhã
    const { data: repeatRules } = await admin
      .from("agenda_items")
      .select(AGENDA_COLS)
      .neq("repeat_type", "none")
      .lte("date", tomorrowSP)
      .not("notify_minutes", "is", null)
      .not("start_time", "is", null)
      .in("user_id", tzUserIds);

    // Ocorrências concluídas/excluídas ("apenas este") sombreiam a regra naquela data
    const { data: windowItems } = await admin
      .from("agenda_items")
      .select("title, date, status, excluded")
      .in("date", [todaySP, tomorrowSP])
      .in("user_id", tzUserIds);

    const blockedKeys = new Set(
      (windowItems ?? [])
        .filter((r) => r.excluded || r.status === "concluida")
        .map((r) => `${r.date}|${(r.title ?? "").toLowerCase().trim()}`),
    );

    // Lista de candidatos a notificar: cada ocorrência efetiva (item, data)
    const candidates: { id: string; user_id: string; title: string; date: string; start_time: string; notify_minutes: number; item_type: string }[] = [];
    const seen = new Set<string>();
    const pushCandidate = (it: any, date: string) => {
      if (it.excluded || it.status === "concluida") return;
      if (blockedKeys.has(`${date}|${(it.title ?? "").toLowerCase().trim()}`)) return;
      const key = `${it.id}|${date}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({
        id: it.id,
        user_id: it.user_id,
        title: it.title,
        date,
        start_time: it.start_time,
        notify_minutes: it.notify_minutes,
        item_type: it.item_type,
      });
    };

    for (const it of (exactItems ?? [])) {
      pushCandidate(it, it.date);
    }
    for (const rule of (repeatRules ?? [])) {
      for (const target of [todaySP, tomorrowSP]) {
        if (repeatMatches(rule, target)) pushCandidate(rule, target);
      }
    }

    for (const item of candidates) {
      if (!item.start_time || !item.notify_minutes) continue;

      // Calculate notification time: start_time minus notify_minutes
      const [sh, sm] = item.start_time.split(":").map(Number);
      const totalStartMins = sh * 60 + sm;
      const notifyMins = item.notify_minutes;
      let notifTotalMins = totalStartMins - notifyMins;

      // Determine which date the notification should fire on
      let notifDate: string;
      if (notifTotalMins < 0) {
        // Notification crosses midnight backwards (e.g., 00:30 - 60min = 23:30 prev day)
        notifTotalMins += 24 * 60;
        // The notification fires on the day BEFORE the appointment
        if (item.date === tomorrowSP) {
          notifDate = todaySP;
        } else {
          // Appointment is today, notification was yesterday — skip
          continue;
        }
      } else {
        // Notification is on the same day as the appointment
        notifDate = item.date;
      }

      // Only fire if notification date is today and time matches
      if (notifDate !== todaySP) continue;

      const notifH = Math.floor(notifTotalMins / 60);
      const notifM = notifTotalMins % 60;
      const notifTime = `${String(notifH).padStart(2, "0")}:${String(notifM).padStart(2, "0")}`;

      if (notifTime !== currentTime) continue;

      const emoji = item.item_type === "compromisso" ? "📅" : "☑️";
      totalSent += await sendPushToUser(item.user_id, {
        title: `${emoji} ${item.title}`,
        body: `Em ${notifyMins} min — ${item.start_time.slice(0, 5)}`,
        tag: `agenda-${item.id}-${item.date}`,
        data: { url: "/agenda" },
      });
      log.agenda = (log.agenda ?? 0) + 1;
    }
  }

  return NextResponse.json({ ok: true, sent: totalSent, ...log });
}
