import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { synthesizeSpeech } from "@/lib/tts";
import { buildScript, type PracticeKind } from "@/lib/practice-scripts";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/practices/voice — gera (e cacheia globalmente) o áudio guiado da
 * prática. O roteiro não é personalizado → cache determinístico por
 * kind/idioma/padrão. Primeira chamada sintetiza via ElevenLabs; as demais
 * reutilizam o mesmo arquivo (custo de voz ~zero recorrente).
 *
 * Body: { kind: "meditation"|"breathing", pattern: string, language: "pt"|"es"|"en" }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const kind: PracticeKind = body.kind === "breathing" ? "breathing" : "meditation";
    const key = String(body.pattern || "breath");
    const language: Lang = body.language === "es" ? "es" : body.language === "en" ? "en" : "pt";

    const script = buildScript(kind, key, language);
    if (!script) {
      return NextResponse.json({ error: "Prática desconhecida" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const path = `practices/v2/${kind}/${language}/${key}.mp3`;

    // Cache global: reusa o áudio se já existir no bucket.
    const existing = await admin.storage.from("user-content").download(path);
    if (existing.data) {
      return NextResponse.json({ audioUrl: path });
    }

    // Voz mais lenta e pausada para práticas (meditação/relaxamento).
    const { audio } = await synthesizeSpeech(script, { language, userId: user.id, speed: 0.8 });

    const { error: uploadErr } = await admin.storage
      .from("user-content")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (uploadErr) throw new Error(`Upload de áudio falhou: ${uploadErr.message}`);

    return NextResponse.json({ audioUrl: path });
  } catch (err) {
    console.error("POST /api/practices/voice error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar voz", detail: String(err) },
      { status: 500 }
    );
  }
}
