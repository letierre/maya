import { NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { buildMayaSystemPrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput, fetchTriggeredMemories } from "@/lib/maya-context";
import { getMayaPersona } from "@/lib/maya-persona";
import { chatLLM } from "@/lib/maya-chat";
import { extractAndStoreMemory } from "@/lib/memory-write";
import { relativeDayLabel, getLocalDateFromISO, getLocalTimeFromISO, getCurrentHour, getLocalDate } from "@/lib/utils";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
export const maxDuration = 60; // só o LLM (contexto + recall + resposta) — bem abaixo do teto

// Remove qualquer "[dia HH:MM]" que a Maya possa ecoar (metadado interno).
const STRIP_TIMESTAMP = /\[\s*(?:hoje|ontem|anteontem|há\s*\d+\s*dias)?\s*\d{1,2}:\d{2}\s*\]\s*/gi;

// Instrução de entrega ORAL (só no modo voz): a pontuação vira pausa/entonação
// na síntese de voz, e frases curtas soam mais naturais do que texto corrido.
const VOICE_DELIVERY = `\n\n## COMO FALAR (modo voz)\nEsta resposta será FALADA em voz alta. Escreva como quem fala de verdade, não como um texto:\n- Frases curtas, uma ideia por frase.\n- Use reticências ("...") para pausas de respiração e para "pensar" antes de responder.\n- Use vírgulas, ponto de interrogação e exclamação para dar entonação.\n- Varie o tom conforme o contexto: acolhimento = calmo e pausado; alegria = animado; preocupação = suave e próximo.\n- Fale com doçura e ternura, como uma mulher acolhedora — sem soar fria, seca nem robótica.\n- Não use listas, markdown, emojis nem estruturas que não façam sentido faladas em voz alta.`;

/**
 * POST /api/maya/voice/reply — etapa 2/3: gera a resposta da Maya (LLM) para a
 * transcrição recém-persistida. Usa o MESMO pipeline do chat (contexto + recall
 * + persona) e já persiste a mensagem da assistente como texto (audio_url null).
 * A voz (TTS) preenche o áudio numa rota separada (/tts).
 *
 * Body (JSON): { transcript, timezone?, localHour?, localDate? }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

  const admin = getSupabaseAdmin();

  try {
    const body = await request.json();
    const transcript = String(body.transcript || "").trim();
    const clientTz = body.timezone || "America/Sao_Paulo";
    const clientHour = body.localHour;
    const clientDate = body.localDate;

    if (!transcript) {
      return NextResponse.json({ error: "Transcrição ausente" }, { status: 400 });
    }

    // Hora/data no fuso do usuário (do browser, fallback SP)
    let currentHour: number;
    let currentDate: string;
    if (clientHour !== undefined && clientDate) {
      currentHour = clientHour;
      currentDate = clientDate;
    } else {
      currentHour = getCurrentHour(clientTz);
      currentDate = getLocalDate(clientTz);
    }

    // ── Histórico recente do chat, com prefixo [dia HH:MM] ──
    const { data: history } = await admin
      .from("chat_messages")
      .select("role, content, image_urls, created_at")
      .eq("user_id", user.id)
      .or("chat_type.is.null,chat_type.eq.maya")
      .order("created_at", { ascending: false })
      .limit(40);

    const rawHistory = (history ?? []).slice().reverse() as Array<{
      role: string;
      content: string;
      image_urls?: string[];
      created_at: string;
    }>;

    const messages = rawHistory.map((m) => {
      const day = relativeDayLabel(getLocalDateFromISO(m.created_at, clientTz), currentDate);
      const time = getLocalTimeFromISO(m.created_at, clientTz);
      const prefix = `[${day ? day + " " : ""}${time}] `;
      return { role: m.role, content: prefix + m.content, image_urls: m.image_urls || [] };
    });

    // ── Contexto único + recall por gatilho (mesma fonte do chat) ──
    const [ctx, triggeredMemories] = await Promise.all([
      fetchMayaContext(user.id, { includeAreaVisions: true, includeAgenda: true, tz: clientTz }),
      fetchTriggeredMemories(user.id, transcript, { todayStr: currentDate, tz: clientTz, limit: 6 }).catch(() => [] as string[]),
    ]);
    const context = (ctx.prefs?.context ?? {}) as Record<string, unknown>;
    const language = (context.language as string) || "pt";
    const userGender = (context.gender as string) || "nao_dizer";

    const mayaInput = toMayaInput(ctx, {
      name: (user.user_metadata?.name as string) || "",
      gender: userGender,
      language,
      currentHour,
      currentDate,
      tz: clientTz,
    });
    mayaInput.triggeredMemories = triggeredMemories;
    mayaInput.persona = await getMayaPersona(admin, user.id, { tz: clientTz });
    mayaInput.isConversation = true;

    const systemPrompt = buildMayaSystemPrompt(mayaInput) + VOICE_DELIVERY;

    // ── Resposta (mesmo LLM do chat) ──
    const rawReply = await chatLLM(systemPrompt, messages, 1000, { userId: user.id, feature: "maya_voice_chat" });
    const reply = rawReply.replace(STRIP_TIMESTAMP, "").trim();

    // ── Persiste a resposta como texto (o áudio é preenchido na etapa 3) ──
    const { data: inserted } = await admin
      .from("chat_messages")
      .insert({
        user_id: user.id,
        role: "assistant",
        content: reply,
        audio_url: null,
        chat_type: "maya",
      })
      .select("id")
      .single();

    const assistantMessageId = (inserted as { id?: string } | null)?.id ?? null;

    // ── Memória de longo prazo (background, não bloqueia) ──
    const recentForMemory = rawHistory.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    after(() => {
      extractAndStoreMemory({ userId: user.id, recentMessages: recentForMemory, reply, language }).catch((err) => {
        logError({ path: "api/maya/voice/reply memory-write", message: String(err), userId: user.id, meta: { feature: "maya_memory_write" } });
      });
    });

    return NextResponse.json({ reply, assistantMessageId });
  } catch (error) {
    console.error("POST /api/maya/voice/reply error:", error);
    logError({ path: "api/maya/voice/reply POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Erro ao responder por voz", detail: String(error) },
      { status: 500 }
    );
  }
}
