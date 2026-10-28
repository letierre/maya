import { logError } from "@/lib/error-log";

/**
 * Síntese de voz (TTS) via ElevenLabs Turbo v2.5 (confiável p/ respostas
 * completas — o Flash v2.5 cortava o final em textos mais longos).
 * Voz configurável por idioma (pt/es/en) via env — a voz da Maya.
 * voice_settings: stability médio p/ expressão sem perder estabilidade no
 * início (0.4 ficava rouca/instável); speed levemente reduzida p/ pausas.
 */

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_turbo_v2_5";

// Voz da Maya por idioma. Sem fallback de outra voz: se não houver voz
// configurada, devolve vazio e a síntese responde em TEXTO (não com outra voz).
function voiceIdFor(language?: string): string {
  if (language === "es") {
    return process.env.ELEVENLABS_VOICE_ID_ES || process.env.ELEVENLABS_VOICE_ID || "";
  }
  if (language === "en") {
    return process.env.ELEVENLABS_VOICE_ID_EN || process.env.ELEVENLABS_VOICE_ID || "";
  }
  return process.env.ELEVENLABS_VOICE_ID_PT || process.env.ELEVENLABS_VOICE_ID || "";
}

/** Sintetiza a fala. Retorna o áudio mp3 + o mime type. */
export async function synthesizeSpeech(
  text: string,
  opts: { language?: string; userId?: string; speed?: number } = {},
): Promise<{ audio: Buffer; mimeType: string }> {
  const key = process.env.ELEVENLABS_API_KEY || "";
  const voiceId = voiceIdFor(opts.language);

  // Sem voz configurada p/ o idioma → responde em texto (a rota captura o erro).
  // Não usa fallback de outra voz: a identidade da Maya é a voz escolhida.
  if (!voiceId) {
    throw new Error("ElevenLabs: nenhuma voz configurada para o idioma");
  }

  // Turbo v2.5 às vezes corta a última sílaba se a frase não "fecha". Garante
  // pontuação final (fecha a entonação) antes de sintetizar.
  const clean = text.trim();
  const ttsText = /[.!?…»]\s*$/.test(clean) ? clean : `${clean}.`;

  const body = {
    text: ttsText,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.7,
      similarity_boost: 0.75,
      speed: opts.speed ?? 0.95,
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
    let detail = errText.slice(0, 200);
    try {
      const parsed = JSON.parse(errText);
      detail =
        parsed?.detail?.message ||
        parsed?.message ||
        parsed?.detail?.status ||
        detail;
    } catch {
      /* mantém o texto cru */
    }
    logError({
      path: "tts.synthesizeSpeech",
      message: `ElevenLabs ${response.status}: ${detail}`,
      status: response.status,
      userId: opts.userId,
    });
    throw new Error(`ElevenLabs TTS error (${response.status}): ${detail}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, mimeType: "audio/mpeg" };
}
