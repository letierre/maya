import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push-send";
import { getLocalNow, getTimezoneOffset, getCurrentHour, getLocalTimeFromISO } from "@/lib/utils";
import { callLLM } from "@/lib/llm";
import { fetchMayaContext, toMayaInput, buildRecentChatTopics } from "@/lib/maya-context";
import { buildProactivePrompt } from "@/lib/maya";

// GET /api/cron/maya-proactive — a Maya toma a iniciativa por push quando a pessoa
// ainda não conversou com ela hoje. Agendado via pg_cron (migration 062).
//
// Regras (decisões do fundador):
// - Horário: sorteado dentro da janela ativa do usuário (app_events dos últimos 14 dias);
//   fallback 9h–21h.
// - Cadência: no máximo 1x a cada 2–3 dias (3 se não respondeu a anterior).
// - Envio: saudação + pergunta curta quase juntas (2 pushes + 2 linhas no chat).

const DEFAULT_ACTIVE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

/** Sorteia um horário (HH:MM) de hoje dentro das horas ativas; se a janela já passou, dispara em breve. */
function pickActiveTime(hours: number[], now: string): string {
  const uniq = [...new Set(hours)].sort((a, b) => a - b);
  const candidates = uniq.length > 0 ? uniq : DEFAULT_ACTIVE_HOURS;
  const h = candidates[Math.floor(Math.random() * candidates.length)];
  const m = Math.floor(Math.random() * 60);
  const picked = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  if (picked <= now) {
    const [nh, nm] = now.split(":").map(Number);
    return `${String(nh).padStart(2, "0")}:${String(Math.min(nm + 5, 59)).padStart(2, "0")}`;
  }
  return picked;
}

function parseProactiveJson(raw: string): { greeting: string; topic: string } | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const greeting = typeof obj.greeting === "string" ? obj.greeting.trim() : "";
    const topic = typeof obj.topic === "string" ? obj.topic.trim() : "";
    if (!greeting || !topic) return null;
    return { greeting, topic };
  } catch {
    return null;
  }
}

/** Encurta no limite de caracteres quebrando na última palavra — evita cortar no meio. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}

async function sendProactive(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  opts: { tz: string; today: string; name: string; gender: string; language: string },
): Promise<number> {
  const { tz, today, name, gender, language } = opts;
  const currentHour = getCurrentHour(tz);

  const ctx = await fetchMayaContext(userId, { checkInLimit: 7, diaryLimit: 10, chatLimit: 20 });
  const firstName = (name || "").split(" ")[0];
  const mayaInput = {
    ...toMayaInput(ctx, { name: firstName, gender, language, currentHour, currentDate: today, tz }),
    recentChatTopics: buildRecentChatTopics(ctx.chatMessages, today, tz) || undefined,
  };
  const { system, user: userPrompt } = buildProactivePrompt(mayaInput);

  let greeting = "";
  let topic = "";
  try {
    const raw = await callLLM(system, userPrompt, { maxTokens: 120, temperature: 0.8, feature: "maya_proactive", userId });
    const parsed = parseProactiveJson(raw);
    if (parsed) {
      greeting = parsed.greeting;
      topic = parsed.topic;
    }
  } catch (err) {
    console.error("[maya-proactive] LLM failed:", String(err));
  }

  if (!greeting) {
    greeting = currentHour < 12 ? "Oi, bom dia!" : currentHour < 18 ? "Oi, boa tarde!" : "Oi, boa noite!";
  }
  if (!topic) topic = "Como está sendo o seu dia?";

  // Rede de segurança: garante que caiba numa notificação push sem ser cortada.
  greeting = clip(greeting, 40);
  topic = clip(topic, 60);

  const g1 = await sendPushToUser(userId, {
    title: "Maya",
    body: greeting,
    tag: `maya-proactive-greeting-${today}`,
    data: { url: "/insights" },
  });
  const g2 = await sendPushToUser(userId, {
    title: "Maya",
    body: topic,
    tag: `maya-proactive-topic-${today}`,
    data: { url: "/insights" },
  });

  // Persiste como mensagens da Maya no chat — para quando a pessoa abrir, "ela ter enviado" de verdade.
  await admin.from("chat_messages").insert([
    { user_id: userId, role: "assistant", content: greeting, chat_type: "maya" },
    { user_id: userId, role: "assistant", content: topic, chat_type: "maya" },
  ]);

  return g1 + g2;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();

  // ── 1) Usuários com push + assinatura ativa ───────────────────────────────
  const { data: subs } = await admin.from("push_subscriptions").select("user_id, timezone");
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const tzByUser = new Map<string, string>();
  for (const s of subs) {
    if (!tzByUser.has(s.user_id)) tzByUser.set(s.user_id, s.timezone || "America/Sao_Paulo");
  }
  const allIds = [...tzByUser.keys()];

  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("user_id")
    .in("user_id", allIds)
    .in("status", ["active", "trialing"]);
  const activeSet = new Set((activeSubs ?? []).map((s) => s.user_id));
  const eligibleIds = allIds.filter((id) => activeSet.has(id));
  if (eligibleIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // ── 2) Nomes (auth.users) ─────────────────────────────────────────────────
  const nameById = new Map<string, string>();
  try {
    for (let page = 1; page <= 50; page++) {
      const { data: usersPage, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !usersPage?.users?.length) break;
      for (const u of usersPage.users) {
        const nm = (u.user_metadata as Record<string, unknown> | undefined)?.name;
        if (nm) nameById.set(u.id, String(nm));
      }
      if (usersPage.users.length < 1000) break;
    }
  } catch {
    /* nomes são opcionais */
  }

  // ── 3) Agrupar por timezone ───────────────────────────────────────────────
  const usersByTz = new Map<string, string[]>();
  for (const id of eligibleIds) {
    const tz = tzByUser.get(id) ?? "America/Sao_Paulo";
    const arr = usersByTz.get(tz) ?? [];
    arr.push(id);
    usersByTz.set(tz, arr);
  }

  let sent = 0;
  let generated = 0;

  for (const [tz, tzUserIds] of usersByTz) {
    const { time: now, date: today } = getLocalNow(tz);
    const offset = getTimezoneOffset(tz, today);
    const todayStartUTC = `${today}T00:00:00${offset}`;

    // ── Lotes ──
    const { data: prefsRows } = await admin
      .from("user_preferences")
      .select("user_id, context")
      .in("user_id", tzUserIds);
    const prefsByUser = new Map((prefsRows ?? []).map((p) => [p.user_id, p]));

    const { data: todayChat } = await admin
      .from("chat_messages")
      .select("user_id")
      .eq("role", "user")
      .gte("created_at", todayStartUTC)
      .in("user_id", tzUserIds);
    const chattedToday = new Set((todayChat ?? []).map((c) => c.user_id));

    const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: events } = await admin
      .from("app_events")
      .select("user_id, created_at")
      .in("user_id", tzUserIds)
      .gte("created_at", since14);
    const hoursByUser = new Map<string, number[]>();
    for (const e of events ?? []) {
      const h = parseInt(getLocalTimeFromISO(e.created_at, tz).slice(0, 2), 10);
      if (Number.isNaN(h)) continue;
      const arr = hoursByUser.get(e.user_id) ?? [];
      arr.push(h);
      hoursByUser.set(e.user_id, arr);
    }

    // ── Máquina de estados por usuário ──
    for (const uid of tzUserIds) {
      const pref = prefsByUser.get(uid);
      const context = (pref?.context ?? {}) as Record<string, unknown>;
      const state = (context.maya_proactive ?? {}) as {
        lastSentDate?: string;
        lastNoReply?: boolean;
        pendingAt?: string | null;
        pendingDate?: string | null;
      };

      // (a) já falou com a Maya hoje → marca como respondido e limpa pendência
      if (chattedToday.has(uid)) {
        if (state.lastNoReply !== false || state.pendingAt) {
          await admin
            .from("user_preferences")
            .update({
              context: { ...context, maya_proactive: { ...state, lastNoReply: false, pendingAt: null, pendingDate: null } },
            })
            .eq("user_id", uid);
        }
        continue;
      }

      // (b) horário de hoje já sorteado?
      const pendingAt = state.pendingDate === today ? state.pendingAt : null;
      if (pendingAt) {
        if (now >= pendingAt) {
          const n = await sendProactive(admin, uid, {
            tz,
            today,
            name: nameById.get(uid) ?? "",
            gender: (context.gender as string) || "nao_dizer",
            language: (context.language as string) || "pt",
          });
          generated += 1;
          sent += n;
          await admin
            .from("user_preferences")
            .update({
              context: {
                ...context,
                maya_proactive: { lastSentDate: today, lastSentAt: new Date().toISOString(), lastNoReply: true, pendingAt: null, pendingDate: null },
              },
            })
            .eq("user_id", uid);
        }
        continue;
      }

      // (c) sem pendência — decide se está na hora de sortear um horário
      const cooldown = state.lastNoReply ? 3 : 2;
      if (state.lastSentDate && diffDays(state.lastSentDate, today) < cooldown) continue;

      const picked = pickActiveTime(hoursByUser.get(uid) ?? [], now);
      await admin
        .from("user_preferences")
        .update({ context: { ...context, maya_proactive: { ...state, pendingAt: picked, pendingDate: today } } })
        .eq("user_id", uid);
    }
  }

  return NextResponse.json({ ok: true, sent, generated });
}
