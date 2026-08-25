import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getLocalDate } from "@/lib/utils";
import { callLLM } from "@/lib/llm";
import { buildMayaSystemPrompt, type MayaInput } from "@/lib/maya";
import { fetchMayaContext, toMayaInput, buildRecentChatTopics } from "@/lib/maya-context";
import { computeSignals } from "@/lib/signals";

// ── LLM nudge message generation ────────────────────────────────────────────

async function generateNudgeViaLLM(
  mayaInput: MayaInput,
  triggerDescription: string,
  templateMessage: string,
  recentChatTopics: string,
): Promise<string> {
  // Persona única — a MESMA Maya do chat/home/planejamento (buildMayaSystemPrompt),
  // com memórias, metas, check-ins e especialistas já embutidos no prompt.
  const system = buildMayaSystemPrompt(mayaInput);

  const chatBlock = recentChatTopics
    ? `\n\n## CONVERSA RECENTE NO CHAT (fonte da verdade)\nVocê conversou com a pessoa recentemente. Esta é a MESMA conversa — você é a mesma Maya.\n${recentChatTopics}\n\nREGRAS DE CONTINUIDADE (críticas):\n- Tudo o que foi decidido, adiado ou corrigido nessa conversa vale também aqui: se a pessoa disse que algo NÃO vai acontecer hoje, mudou de dia ou cancelou, NÃO fale como se fosse acontecer.\n- NUNCA contradiga o que a pessoa acabou de te dizer. Honre a mudança.\n- NÃO repita perguntas já respondidas.`
    : "";

  const userPrompt = `## SUA TAREFA AGORA
Você detectou algo e quer enviar um toque rápido (nudge) para a pessoa.

Contexto do que você detectou: ${triggerDescription}

Gere UMA mensagem curta (1-2 frases) que:
- Seja calorosa mas direta — a pessoa está na home do app
- Mencione o que você notou de forma natural, não como um diagnóstico
- Se houver memórias sobre esse tema, faça referência: "Sei que me contou sobre..."
- NUNCA repita uma pergunta que já foi respondida
- Termine com uma pergunta ou convite aberto
- Máximo 2 frases, 1 emoji no máximo
- Retorne APENAS a mensagem, sem aspas, sem markdown
${chatBlock}

Mensagem template (use como inspiração, melhore-a): "${templateMessage}"`;

  try {
    const result = await callLLM(system, userPrompt, { maxTokens: 120, temperature: 0.75 });
    const cleaned = result.replace(/^["']|["']$/g, "").trim();
    if (cleaned && cleaned.length >= 10) return cleaned;
  } catch (err) {
    console.error("LLM nudge failed, using template:", String(err).slice(0, 80));
  }
  return templateMessage; // fallback
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = getLocalDate();

  try {
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const userName = (user.user_metadata?.name as string) || "";
    const firstName = userName.split(" ")[0];
    const gender = (context.gender as string) || "nao_dizer";

    // ── Continuidade: não faz nudge se a pessoa já conversou hoje ──
    // (evita que um nudge cacheado contradiga uma conversa recente no chat)
    const { count: todayMsgCount } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today + "T00:00:00Z")
      .lte("created_at", today + "T23:59:59Z");
    if (todayMsgCount && todayMsgCount > 0) {
      return NextResponse.json({ nudges: [] });
    }

    // ── Cache check ──
    const cachedNudge = context.maya_nudge as { id: string; message: string; date: string; saved: boolean; releaseHour: number } | undefined;
    if (cachedNudge?.date === today && cachedNudge.message) {
      if (cachedNudge.saved) return NextResponse.json({ nudges: [] });
      // Respect timed release
      const now = new Date();
      const brH = now.getHours();
      if (brH < cachedNudge.releaseHour) return NextResponse.json({ nudges: [] });
      return NextResponse.json({ nudges: [{ id: cachedNudge.id, message: cachedNudge.message, action: (cachedNudge as any).action }] });
    }

    // Get or create check-in count
    const { count } = await admin
      .from("check_ins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count || count === 0) {
      const welcomeMsg = `Oi ${firstName || "você"}! 💜 Eu sou a Maya. Registre seu primeiro check-in e vamos começar essa jornada juntos.`;
      await cacheNudge(admin, user.id, context, "welcome", welcomeMsg, today);
      return NextResponse.json({ nudges: [{ id: "welcome", message: welcomeMsg }] });
    }

    // ── Motor único de sinais: escolhe o nudge mais prioritário ──
    const { signals } = await computeSignals(user.id, { firstName, gender });
    const bestNudge = signals
      .filter((s) => s.feed.includes("nudge"))
      .sort((a, b) => a.priority - b.priority)[0];

    if (bestNudge) {
      const triggerDescriptions: Record<string, string> = {
        streak_risk: "a pessoa tem uma corrente de check-ins em risco de quebrar hoje",
        sleep: "a pessoa dormiu mal nos últimos dias seguidos",
        mood: "o humor da pessoa caiu nos últimos dias (moods negativos consecutivos)",
        diary_abandoned: "a pessoa não escreve no diário há vários dias",
        goal_stale: "uma meta ativa está parada há mais de 7 dias sem atividade",
        spending: "os gastos do mês estão elevados",
        plan_overdue: "há tarefas da semana pendentes de dias anteriores",
        burnout_risk: "a pessoa dormiu mal mas tem tarefas de crescimento",
        plan_empty_weekend: "não há plano semanal criado, e é fim de semana",
        plan_procrastination: "menos de 30% das tarefas da semana concluídas, já é meio da semana",
        plan_week_wasted: "fim de semana e 0% de conclusão das tarefas",
        checkin_miss: "a pessoa ainda não fez check-in hoje",
      };

      const triggerDesc = triggerDescriptions[bestNudge.id] || bestNudge.description;

      // Persona única — mesma fonte do chat/home/planejamento, com o chat
      // recente para o nudge não contradizer a conversa.
      const ctx = await fetchMayaContext(user.id, { chatLimit: 6 });
      const mayaInput = toMayaInput(ctx, {
        name: firstName,
        gender,
        currentHour: new Date().getHours(),
        currentDate: today,
      });
      const chatSummary = buildRecentChatTopics(ctx.chatMessages);

      const enhancedMessage = await generateNudgeViaLLM(
        mayaInput,
        triggerDesc,
        bestNudge.message || bestNudge.description,
        chatSummary || "",
      );

      // Cache for today with enhanced message
      const releaseHour = await cacheNudge(admin, user.id, context, bestNudge.id, enhancedMessage, today, bestNudge.action);

      // Respect random release hour — don't show if too early
      const brH = new Date().getHours();
      if (brH < releaseHour) {
        return NextResponse.json({ nudges: [] });
      }

      return NextResponse.json({ nudges: [{ id: bestNudge.id, message: enhancedMessage, action: bestNudge.action }] });
    }

    return NextResponse.json({ nudges: [] });
  } catch (error) {
    console.error("GET /api/maya/nudge error:", error);
    return NextResponse.json({ nudges: [] });
  }
}

async function cacheNudge(admin: any, userId: string, context: Record<string, unknown>, id: string, message: string, date: string, action?: { label: string; href: string }): Promise<number> {
  const releaseHour = 9 + Math.floor(Math.random() * 9);
  try {
    await admin
      .from("user_preferences")
      .update({ context: { ...context, maya_nudge: { id, message, date, saved: false, releaseHour, action } } })
      .eq("user_id", userId);
  } catch {
    /* best-effort */
  }
  return releaseHour;
}

// ── POST — Mark nudge as saved to chat ─────────────────────────────────────────

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context")
    .eq("user_id", user.id)
    .single();

  const context = (prefs?.context ?? {}) as Record<string, unknown>;
  const today = getLocalDate();
  const cachedNudge = context.maya_nudge as { id: string; message: string; date: string } | undefined;

  if (cachedNudge?.date === today && cachedNudge.message) {
    // Save to chat_messages
    await admin.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: cachedNudge.message,
    });

    // Mark as saved so it doesn't repeat
    await admin
      .from("user_preferences")
      .update({ context: { ...context, maya_nudge: { ...cachedNudge, saved: true } } })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
