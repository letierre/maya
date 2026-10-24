import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalNow, getLocalDateFromISO, getLocalTimeFromISO } from "@/lib/utils";

/**
 * Perfil de comportamento (persona) da Maya — camada que responde "COMO a pessoa
 * é e funciona", diferente da memória (que responde "O QUE aconteceu").
 *
 * É 100% determinístico (SQL + agregação), SEM LLM. Alimenta a abertura do chat,
 * a home, o push proativo e o filtro de recordatórios — para a Maya soar como
 * uma amiga que conhece o ritmo e as afinidades da pessoa.
 *
 * Documento de desenho: docs/design-maya-adaptativa.md
 */

export interface MayaPersona {
  /** Intervalo mediano (em dias) entre dias distintos de conversa. Null se ainda não há padrão. */
  cadenceDays: number | null;
  /** Ausência: dias desde a última conversa ANTES de hoje (999 = nunca conversou antes). */
  lastActiveDays: number;
  /** Janela de horário mais comum de uso (de app_events). */
  usualWindow: "manhã" | "tarde" | "noite" | "madrugada" | null;
  /** O que a pessoa de fato usa (últimos 14 dias). */
  engagement: { checkIn: boolean; diary: boolean; meal: boolean; sleep: boolean };
  /** Há histórico suficiente (≥ 2 dias distintos de conversa) para calcular cadência. */
  hasCadence: boolean;
}

const WINDOW_DAYS = 14;
const STALE_MS = 24 * 60 * 60 * 1000;

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Data local (YYYY-MM-DD) de `days` dias atrás, no fuso do usuário. */
function localDaysAgo(tz: string, days: number): string {
  const { date: today } = getLocalNow(tz);
  const d = new Date(today + "T12:00:00");
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function hourToWindow(hour: number): MayaPersona["usualWindow"] {
  if (hour >= 0 && hour < 6) return "madrugada";
  if (hour >= 6 && hour < 12) return "manhã";
  if (hour >= 12 && hour < 18) return "tarde";
  return "noite";
}

/** Dias desde a última mensagem do usuário no chat (consulta barata, sempre fresca). */
export async function getLastActiveDays(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  tz: string,
  today: string,
): Promise<number> {
  const { data } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .or("chat_type.is.null,chat_type.eq.maya")
    .order("created_at", { ascending: false })
    .limit(100);
  // Pula a atividade de HOJE (o turno atual já está persistido) e acha o último
  // dia de conversa ANTERIOR — é essa a ausência que importa para a abertura.
  for (const m of data ?? []) {
    if (!m.created_at) continue;
    const d = getLocalDateFromISO(m.created_at, tz);
    if (d !== today) return diffDays(d, today);
  }
  return 999;
}

/** Computa o perfil de comportamento por inteiro (sem cache). */
export async function computeMayaPersona(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  opts: { tz?: string } = {},
): Promise<MayaPersona> {
  const tz = opts.tz || "America/Sao_Paulo";
  const { date: today } = getLocalNow(tz);

  // 1) Cadência + última atividade (mensagens do usuário)
  const { data: userChat } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .or("chat_type.is.null,chat_type.eq.maya")
    .order("created_at", { ascending: true });

  const distinctDays: string[] = [];
  for (const m of userChat ?? []) {
    if (!m.created_at) continue;
    const d = getLocalDateFromISO(m.created_at, tz);
    if (distinctDays[distinctDays.length - 1] !== d) distinctDays.push(d);
  }

  let cadenceDays: number | null = null;
  if (distinctDays.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < distinctDays.length; i++) gaps.push(diffDays(distinctDays[i - 1], distinctDays[i]));
    const med = median(gaps);
    cadenceDays = med != null && med >= 1 ? med : 1;
  }

  let lastActiveDays = 999;
  if (distinctDays.length) {
    const last = distinctDays[distinctDays.length - 1];
    if (last !== today) lastActiveDays = diffDays(last, today);
    else if (distinctDays.length >= 2) lastActiveDays = diffDays(distinctDays[distinctDays.length - 2], today);
  }

  // 2) Janela de horário habitual (app_events dos últimos 14 dias)
  const since14 = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  let usualWindow: MayaPersona["usualWindow"] = null;
  const { data: events } = await admin
    .from("app_events")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since14);
  if (events && events.length > 0) {
    const byHour = new Map<number, number>();
    for (const e of events) {
      const h = parseInt(getLocalTimeFromISO(e.created_at, tz).slice(0, 2), 10);
      if (Number.isNaN(h)) continue;
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    let bestHour = -1;
    let bestCount = 0;
    for (const [h, c] of byHour) if (c > bestCount) { bestCount = c; bestHour = h; }
    if (bestHour >= 0) usualWindow = hourToWindow(bestHour);
  }

  // 3) Engajamento por feature (últimos 14 dias)
  const sinceDate = localDaysAgo(tz, WINDOW_DAYS);
  const [checkInRes, diaryRes, mealRes, sleepRes] = await Promise.all([
    admin.from("check_ins").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("date", sinceDate),
    admin.from("diary_entries").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("date", sinceDate),
    admin.from("meals").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("data_hora", since14),
    admin.from("sleep_logs").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("date", sinceDate),
  ]);
  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;

  return {
    cadenceDays,
    lastActiveDays,
    usualWindow,
    engagement: {
      checkIn: has(checkInRes),
      diary: has(diaryRes),
      meal: has(mealRes),
      sleep: has(sleepRes),
    },
    hasCadence: distinctDays.length >= 2,
  };
}

/**
 * Lê o perfil de comportamento (cache de 24h para as partes "pesadas" — cadência,
 * janela, engajamento) e SEMPRE recalcula `lastActiveDays` fresca (1 consulta),
 * para a abertura do chat nunca errar a ausência por causa de cache velho.
 */
export async function getMayaPersona(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  opts: { tz?: string } = {},
): Promise<MayaPersona> {
  const tz = opts.tz || "America/Sao_Paulo";
  const { date: today } = getLocalNow(tz);

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context")
    .eq("user_id", userId)
    .single();
  const context = (prefs?.context ?? {}) as Record<string, unknown>;
  const cached = context.maya_persona as (Omit<MayaPersona, "lastActiveDays"> & { computedAt?: string }) | undefined;

  let base: Omit<MayaPersona, "lastActiveDays">;
  if (cached && cached.computedAt && Date.now() - new Date(cached.computedAt).getTime() < STALE_MS) {
    base = {
      cadenceDays: cached.cadenceDays,
      usualWindow: cached.usualWindow,
      engagement: cached.engagement,
      hasCadence: cached.hasCadence,
    };
  } else {
    const full = await computeMayaPersona(admin, userId, { tz });
    base = {
      cadenceDays: full.cadenceDays,
      usualWindow: full.usualWindow,
      engagement: full.engagement,
      hasCadence: full.hasCadence,
    };
    try {
      await admin
        .from("user_preferences")
        .update({ context: { ...context, maya_persona: { ...base, computedAt: new Date().toISOString() } } })
        .eq("user_id", userId);
    } catch {
      /* best-effort */
    }
  }

  const lastActiveDays = await getLastActiveDays(admin, userId, tz, today);
  return { ...base, lastActiveDays };
}

/** Bloco de prompt (curto e estruturado) para injetar o comportamento nas superfícies. */
export function formatPersonaBlock(p: MayaPersona, currentHour?: number): string {
  const hasSignal =
    p.hasCadence ||
    p.usualWindow !== null ||
    p.engagement.checkIn || p.engagement.diary || p.engagement.meal || p.engagement.sleep;
  if (!hasSignal) return "";

  const lines: string[] = [];

  if (p.hasCadence && p.cadenceDays != null) {
    const cadence =
      p.cadenceDays <= 1 ? "todos os dias" :
      p.cadenceDays === 2 ? "dia sim, dia não" :
      `a cada ~${p.cadenceDays} dias`;
    lines.push(`- Ritmo de conversa: a pessoa costuma vir ${cadence}.`);
  }

  if (p.usualWindow) {
    lines.push(`- Costuma aparecer mais de ${p.usualWindow}.`);
    if (currentHour !== undefined) {
      const nowWindow = hourToWindow(currentHour);
      if (nowWindow !== p.usualWindow) {
        lines.push(`- DESVIO: a pessoa costuma vir de ${p.usualWindow}, mas está falando agora de ${nowWindow}. Se fizer sentido, note com leveza e pergunte se aconteceu algo.`);
      }
    }
  }

  const used: string[] = [];
  if (p.engagement.checkIn) used.push("check-in");
  if (p.engagement.diary) used.push("diário");
  if (p.engagement.meal) used.push("refeições");
  if (p.engagement.sleep) used.push("sono");
  if (used.length) {
    lines.push(`- Usa de verdade no app: ${used.join(", ")}. Fale sobre o que a pessoa usa — não empurre o que ela nunca registra.`);
  }

  const threshold = p.hasCadence && p.cadenceDays != null ? Math.max(3, p.cadenceDays * 2) : null;
  if (threshold != null && p.lastActiveDays >= threshold) {
    lines.push(`- IMPORTANTE: faz ${p.lastActiveDays} dias que a pessoa não vem conversar — fora do ritmo dela. Ao retomar, note com carinho e curiosidade (pergunte como foi esse tempo, se aconteceu algo), SEM alarme, SEM culpa, e SEM dizer "você sumiu" nem "você voltou".`);
  }

  return `## COMO É A PESSOA (comportamento — o jeito dela, não fatos)
${lines.join("\n")}
Regras: comportamento é para você SENTIR a pessoa e calibrar o tom — nunca para rotular, cobrar ou usar contra ela.`;
}
