import { NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { buildMayaSystemPrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput, fetchTriggeredMemories } from "@/lib/maya-context";
import { chatLLM } from "@/lib/maya-chat";
import { extractAndStoreMemory } from "@/lib/memory-write";
import { transcribeAudio } from "@/lib/stt";
import { synthesizeSpeech } from "@/lib/tts";
import { relativeDayLabel, getLocalDateFromISO, getLocalTimeFromISO, getLocalDate, getCurrentHour } from "@/lib/utils";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
export const maxDuration = 60; // STT + LLM + TTS num único request

// Remove qualquer "[dia HH:MM]" que a Maya possa ecoar (metadado interno).
const STRIP_TIMESTAMP = /\[\s*(?:hoje|ontem|anteontem|há\s*\d+\s*dias)?\s*\d{1,2}:\d{2}\s*\]\s*/gi;

// Instrução de entrega ORAL (só no modo voz): a pontuação vira pausa/entonação
// na síntese de voz, e frases curtas soam mais naturais do que texto corrido.
// É AQUI (junto com voice_settings no tts.ts) que se ajusta a "entonação" da Maya.
const VOICE_DELIVERY = `\n\n## COMO FALAR (modo voz)\nEsta resposta será FALADA em voz alta. Escreva como quem fala de verdade, não como um texto:\n- Frases curtas, uma ideia por frase.
- Seja CONCISA: responda em 2-4 frases curtas (máximo ~60 palavras). Vá direto ao ponto.\n- Use reticências ("...") para pausas de respiração e para "pensar" antes de responder.\n- Use vírgulas, ponto de interrogação e exclamação para dar entonação.\n- Varie o tom conforme o contexto: acolhimento = calmo e pausado; alegria = animado; preocupação = suave e próximo.\n- Não use listas, markdown, emojis nem estruturas que não façam sentido faladas em voz alta.`;

// Voz é conversa, não palestra. Corta respostas longas num limite de frase,
// garantindo áudio de no máximo ~50-55s (e a transcrição salva condiz com o áudio).
function truncateForVoice(text: string, maxChars = 700): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  let last = -1;
  for (const ch of [".", "!", "?", "…", ";"]) last = Math.max(last, cut.lastIndexOf(ch));
  if (last > maxChars * 0.6) return cut.slice(0, last + 1);
  return cut + "…";
}

/** Faz upload de um áudio (Buffer) para o bucket user-content e devolve o path. */
async function uploadVoiceAudio(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  buffer: Buffer,
  ext: string,
  contentType: string,
): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `voice/${userId}/${fileName}`;
  const { error } = await admin.storage
    .from("user-content")
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Upload de áudio falhou: ${error.message}`);
  return path;
}

/**
 * POST /api/maya/voice — conversa por voz (turno-a-turno).
 * Fluxo: STT (Deepgram) → MESMO pipeline do chat (contexto + memória + LLM)
 * → TTS (ElevenLabs). A fala vira mensagem no chat (transcrição + resposta),
 * então memória, recall e continuidade funcionam — é a MESMA Maya do texto.
 *
 * Body (JSON): { audio: base64, mimeType, timezone?, localHour?, localDate? }
 * Ou multipart/form-data com campo "audio".
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
    // ── 1) Lê o áudio (multipart ou JSON base64) ──
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType: string;
    let clientTz = "America/Sao_Paulo";
    let clientDate: string | undefined;
    let clientHour: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio") as File | null;
      if (!file) return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
      audioBuffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "audio/webm";
      clientTz = String(form.get("timezone") || clientTz);
      clientDate = form.get("localDate") ? String(form.get("localDate")) : undefined;
      const hourRaw = form.get("localHour");
      clientHour = hourRaw != null ? Number(hourRaw) : undefined;
    } else {
      const body = await request.json();
      const audioB64 = body.audio as string | undefined;
      if (!audioB64) return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
      audioBuffer = Buffer.from(audioB64, "base64");
      mimeType = body.mimeType || "audio/webm";
      clientTz = body.timezone || clientTz;
      clientDate = body.localDate;
      clientHour = body.localHour;
    }

    // ── 2) Hora/data no fuso do usuário (do browser, fallback SP) ──
    let currentHour: number;
    let currentDate: string;
    if (clientHour !== undefined && clientDate) {
      currentHour = clientHour;
      currentDate = clientDate;
    } else {
      currentHour = getCurrentHour(clientTz);
      currentDate = getLocalDate(clientTz);
    }

    // ── 3) Contexto do usuário (língua p/ STT/TTS) ──
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();
    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const language = (context.language as string) || "pt";

    // ── 4) STT ──
    const transcript = await transcribeAudio(audioBuffer, { mimeType, language, userId: user.id });
    if (!transcript) {
      return NextResponse.json({ error: "Não consegui entender o áudio" }, { status: 422 });
    }

    // ── 5) Persiste a fala do usuário como mensagem (mesma Maya do texto) ──
    await admin.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: transcript,
      chat_type: "maya",
    });

    // ── 6) Histórico recente do chat, com prefixo [dia HH:MM] ──
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

    // ── 7) Contexto único + recall por gatilho (mesma fonte do chat) ──
    const [ctx, triggeredMemories] = await Promise.all([
      fetchMayaContext(user.id, { includeAreaVisions: true, includeAgenda: true, tz: clientTz }),
      fetchTriggeredMemories(user.id, transcript, { todayStr: currentDate, tz: clientTz, limit: 6 }).catch(() => [] as string[]),
    ]);

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

    const systemPrompt = buildMayaSystemPrompt(mayaInput) + VOICE_DELIVERY;

    // ── 8) Resposta (mesmo LLM do chat) ──
    const rawReply = await chatLLM(systemPrompt, messages, 250, { userId: user.id, feature: "maya_voice_chat" });
    const reply = truncateForVoice(rawReply.replace(STRIP_TIMESTAMP, "").trim());

    // ── 9) TTS + persistência da resposta da Maya (com áudio) ──
    // Gera e guarda o áudio primeiro pra salvar o caminho junto da mensagem.
    // Se o TTS falhar, a resposta vira texto puro (degrada, não derruba).
    let assistantAudioUrl: string | null = null;
    let ttsError: string | null = null;
    try {
      const { audio } = await synthesizeSpeech(reply, { language, userId: user.id });
      assistantAudioUrl = await uploadVoiceAudio(admin, user.id, audio, "mp3", "audio/mpeg");
    } catch (ttsErr) {
      ttsError = String(ttsErr);
      logError({ path: "api/maya/voice tts", message: String(ttsErr), userId: user.id, meta: { feature: "maya_tts" } });
    }

    await admin.from("chat_messages").insert({
      user_id: user.id,
      role: "assistant",
      content: reply,
      audio_url: assistantAudioUrl,
      chat_type: "maya",
    });

    // ── 10) Memória de longo prazo (background, não bloqueia) ──
    const recentForMemory = rawHistory.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    after(() => {
      extractAndStoreMemory({ userId: user.id, recentMessages: recentForMemory, reply, language }).catch((err) => {
        logError({ path: "api/maya/voice memory-write", message: String(err), userId: user.id, meta: { feature: "maya_memory_write" } });
      });
    });

    return NextResponse.json({ transcript, reply, audioUrl: assistantAudioUrl, ttsError });
  } catch (error) {
    console.error("POST /api/maya/voice error:", error);
    logError({ path: "api/maya/voice POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Erro na conversa por voz", detail: String(error) },
      { status: 500 }
    );
  }
}
