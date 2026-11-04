import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Helpers compartilhados do fluxo de voz da Maya (upload + mapeamento de mime),
 * usados pelas rotas de transcrição (nota de voz do usuário) e de TTS (voz da
 * Maya) — que agora são requests separados.
 */

/** Faz upload de um áudio (Buffer) para o bucket user-content e devolve o path. */
export async function uploadVoiceAudio(
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

/** Mapeia o mime type do áudio gravado → extensão + content-type p/ guardar. */
export function audioExtFromMime(mimeType: string): { ext: string; contentType: string } {
  const m = (mimeType || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return { ext: "m4a", contentType: "audio/mp4" };
  if (m.includes("ogg") || m.includes("opus")) return { ext: "ogg", contentType: "audio/ogg" };
  if (m.includes("mpeg") || m.includes("mp3")) return { ext: "mp3", contentType: "audio/mpeg" };
  if (m.includes("wav")) return { ext: "wav", contentType: "audio/wav" };
  return { ext: "webm", contentType: "audio/webm" };
}
