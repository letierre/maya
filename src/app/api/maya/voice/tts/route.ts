import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { synthesizeSpeech } from "@/lib/tts";
import { uploadVoiceAudio } from "@/lib/voice-audio";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
export const maxDuration = 60; // só TTS + upload — bem abaixo do teto

/**
 * POST /api/maya/voice/tts — etapa 3/3: sintetiza a fala da Maya (TTS), salva o
 * áudio e preenche o audio_url da mensagem da assistente (persistida na etapa 2).
 * Se o TTS falhar, a resposta permanece como texto — degrada, não derruba.
 *
 * Body (JSON): { reply, assistantMessageId?, language? }
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
    const reply = String(body.reply || "").trim();
    const assistantMessageId = body.assistantMessageId as string | null | undefined;
    const language = body.language as string | undefined;

    if (!reply) {
      return NextResponse.json({ error: "Resposta ausente" }, { status: 400 });
    }

    let audioUrl: string | null = null;
    let ttsError: string | null = null;
    try {
      const { audio } = await synthesizeSpeech(reply, { language, userId: user.id });
      audioUrl = await uploadVoiceAudio(admin, user.id, audio, "mp3", "audio/mpeg");
    } catch (ttsErr) {
      ttsError = String(ttsErr);
      logError({ path: "api/maya/voice/tts", message: String(ttsErr), userId: user.id, meta: { feature: "maya_tts" } });
    }

    // Preenche o áudio na mensagem já persistida na etapa 2.
    if (audioUrl && assistantMessageId) {
      await admin
        .from("chat_messages")
        .update({ audio_url: audioUrl })
        .eq("id", assistantMessageId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ audioUrl, ttsError });
  } catch (error) {
    console.error("POST /api/maya/voice/tts error:", error);
    logError({ path: "api/maya/voice/tts POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Erro ao sintetizar a voz", detail: String(error) },
      { status: 500 }
    );
  }
}
