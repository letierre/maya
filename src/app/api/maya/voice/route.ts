import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { transcribeAudio } from "@/lib/stt";
import { uploadVoiceAudio, audioExtFromMime } from "@/lib/voice-audio";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
// Só STT + persistência da nota de voz. O STT escala com a duração do áudio,
// então damos folga (Pro permite até 300s). Resposta (LLM) e fala (TTS) saíram
// para rotas próprias (/reply e /tts) p/ nenhum request estourar o teto.
export const maxDuration = 120;

/**
 * POST /api/maya/voice — etapa 1/3 da conversa por voz: transcreve o áudio (STT)
 * e persiste a fala do usuário como mensagem (nota de voz), devolvendo a
 * transcrição + o áudio salvo. A resposta e a voz da Maya são geradas em rotas
 * separadas, então um áudio de qualquer duração não estoura o limite de 60s.
 *
 * Idempotência: o cliente envia um `clientId` estável; se ele já foi persistido
 * (reenvio da mesma nota de voz), a rota devolve a mensagem existente sem
 * transcrever/gravar de novo — evitando duplicação.
 *
 * Body: multipart/form-data com "audio", ou JSON { audio: base64, mimeType }.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

  const admin = getSupabaseAdmin();

  try {
    // ── 1) Lê o áudio + clientId (multipart ou JSON base64) ──
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType: string;
    let clientId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio") as File | null;
      if (!file) return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
      audioBuffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "audio/webm";
      clientId = form.get("clientId") ? String(form.get("clientId")) : null;
    } else {
      const body = await request.json();
      const audioB64 = body.audio as string | undefined;
      if (!audioB64) return NextResponse.json({ error: "Áudio ausente" }, { status: 400 });
      audioBuffer = Buffer.from(audioB64, "base64");
      mimeType = body.mimeType || "audio/webm";
      clientId = body.clientId ? String(body.clientId) : null;
    }

    // ── 2) Idempotência: se a mesma chave já foi persistida, reusa (reenvio) ──
    if (clientId) {
      const { data: existing } = await admin
        .from("chat_messages")
        .select("content, audio_url, audio_duration")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          transcript: existing.content,
          userAudioUrl: existing.audio_url ?? null,
          audioDuration: existing.audio_duration ?? null,
        });
      }
    }

    // ── 3) Idioma p/ STT ──
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();
    const context = (prefs?.context ?? {}) as Record<string, unknown>;
    const language = (context.language as string) || "pt";

    // ── 4) STT ──
    const { transcript, duration } = await transcribeAudio(audioBuffer, { mimeType, language, userId: user.id });
    if (!transcript) {
      return NextResponse.json({ error: "Não consegui entender o áudio" }, { status: 422 });
    }

    // ── 5) Persiste a fala do usuário como mensagem (nota de voz). Se o upload
    // falhar, degrada p/ texto puro (transcrição colapsável sem áudio). ──
    let userAudioUrl: string | null = null;
    try {
      const { ext, contentType: userAudioContentType } = audioExtFromMime(mimeType);
      userAudioUrl = await uploadVoiceAudio(admin, user.id, audioBuffer, ext, userAudioContentType);
    } catch (uploadErr) {
      logError({ path: "api/maya/voice user-audio", message: String(uploadErr), userId: user.id, meta: { feature: "maya_user_voice_upload" } });
    }

    const { error: insertError } = await admin.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: transcript,
      audio_url: userAudioUrl,
      audio_duration: userAudioUrl && duration > 0 ? duration : null,
      chat_type: "maya",
      client_id: clientId,
    });

    if (insertError) {
      // Corrida rara: outra requisição inseriu a MESMA chave primeiro. Reusa.
      if (clientId && insertError.code === "23505") {
        const { data: existing } = await admin
          .from("chat_messages")
          .select("content, audio_url, audio_duration")
          .eq("user_id", user.id)
          .eq("client_id", clientId)
          .limit(1)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({
            transcript: existing.content,
            userAudioUrl: existing.audio_url ?? null,
            audioDuration: existing.audio_duration ?? null,
          });
        }
      }
      throw new Error(`Falha ao salvar mensagem: ${insertError.message}`);
    }

    return NextResponse.json({
      transcript,
      userAudioUrl,
      audioDuration: duration > 0 ? duration : null,
    });
  } catch (error) {
    console.error("POST /api/maya/voice error:", error);
    logError({ path: "api/maya/voice POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Erro ao transcrever o áudio", detail: String(error) },
      { status: 500 }
    );
  }
}
