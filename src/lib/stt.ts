import { logError } from "@/lib/error-log";

/**
 * Transcrição de fala (STT) via Deepgram Nova-3.
 * Streaming nativo (~300ms), bom em pt-BR. Recebe o áudio cru (webm/mp4/wav)
 * e devolve o texto transcrito.
 */

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

function deepgramLanguage(lang?: string): string {
  if (lang === "es") return "es";
  if (lang === "en") return "en-US";
  return "pt-BR";
}

/** Transcreve um áudio. Retorna string vazia se nada reconhecido, e a duração
 *  em segundos (Deepgram metadata.duration) p/ guardar na nota de voz. */
export async function transcribeAudio(
  audio: Buffer,
  opts: { mimeType?: string; language?: string; userId?: string } = {},
): Promise<{ transcript: string; duration: number }> {
  const key = process.env.DEEPGRAM_API_KEY || "";
  const lang = deepgramLanguage(opts.language);
  const mime = opts.mimeType || "audio/webm";

  const url = `${DEEPGRAM_URL}?model=nova-3&language=${lang}&smart_format=true&punctuate=true`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": mime,
      },
      // Node runtime aceita Buffer como body; TS tipa como BodyInit.
      body: audio as unknown as BodyInit,
    });
  } catch (err) {
    logError({ path: "stt.transcribeAudio", message: String(err), userId: opts.userId });
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text();
    logError({
      path: "stt.transcribeAudio",
      message: `Deepgram ${response.status}: ${errText.slice(0, 200)}`,
      status: response.status,
      userId: opts.userId,
    });
    throw new Error(`Deepgram STT error (${response.status})`);
  }

  const data = await response.json();
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const duration = typeof data?.metadata?.duration === "number" ? data.metadata.duration : 0;
  return { transcript: String(transcript).trim(), duration };
}
