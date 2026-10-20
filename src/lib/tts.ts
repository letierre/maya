import { logError } from "@/lib/error-log";

/**
 * Síntese de voz (TTS) via ElevenLabs Flash v2.5.
 * Voz configurável por idioma (pt/es/en) via env — a voz da Maya.
 * voice_settings: stability médio-baixo p/ prosódia viva, mas estável.
 */

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_flash_v2_5";

// Fallback enquanto a voz definitiva não é escolhida (trocar via env).
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function voiceIdFor(language?: string): string {
  if (language === "es") {
    return process.env.ELEVENLABS_VOICE_ID_ES || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  }
  if (language === "en") {
    return process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  }
  return process.env.ELEVENLABS_VOICE_ID_PT || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

/** Sintetiza a fala. Retorna o áudio mp3 + o mime type. */
export async function synthesizeSpeech(
  text: string,
  opts: { language?: string; userId?: string } = {},
): Promise<{ audio: Buffer; mimeType: string }> {
  const key = process.env.ELEVENLABS_API_KEY || "";
  const voiceId = voiceIdFor(opts.language);

  const body = {
    text,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  const url = `${ELEVENLABS_TTS_URL}/${voiceId}?output_format=mp3_44100_128`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logError({ path: "tts.synthesizeSpeech", message: String(err), userId: opts.userId });
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text();
    logError({
      path: "tts.synthesizeSpeech",
      message: `ElevenLabs ${response.status}: ${errText.slice(0, 200)}`,
      status: response.status,
      userId: opts.userId,
    });
    throw new Error(`ElevenLabs TTS error (${response.status})`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, mimeType: "audio/mpeg" };
}
