import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { synthesizeSpeech } from "@/lib/tts";
import { buildVisualizationScript } from "@/lib/practice-scripts";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/practices/visualization/voice — gera (e cacheia por meta) o áudio
 * personalizado de visualização. O roteiro cita o título e o porquê da meta do
 * usuário → cache chaveado por idioma/meta/hash-do-roteiro (editar a meta muda
 * o hash e regenera; repetir a mesma meta reusa o arquivo).
 *
 * Body: { goal_id: string, language: "pt"|"es"|"en" }
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
    const goalId = String(body.goal_id || "");
    const language: Lang = body.language === "es" ? "es" : body.language === "en" ? "en" : "pt";

    if (!goalId) {
      return NextResponse.json({ error: "Meta não informada" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Meta do usuário (ownership) — só title/why/reward alimentam o roteiro.
    const { data: goal, error: goalErr } = await admin
      .from("goals")
      .select("title, why_it_matters, reward")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (goalErr) throw goalErr;
    if (!goal) {
      return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    }

    const script = buildVisualizationScript(
      { title: goal.title ?? "", why_it_matters: goal.why_it_matters ?? "", reward: goal.reward },
      language
    );
    if (!script) {
      return NextResponse.json({ error: "Roteiro vazio" }, { status: 400 });
    }

    const hash = createHash("md5").update(script).digest("hex").slice(0, 12);
    const path = `practices/v2/visualization/${language}/${goalId}/${hash}.mp3`;

    // Cache por meta + conteúdo: reusa se já existir no bucket.
    const existing = await admin.storage.from("user-content").download(path);
    if (existing.data) {
      return NextResponse.json({ audioUrl: path });
    }

    // Voz mais lenta e pausada para práticas guiadas.
    const { audio } = await synthesizeSpeech(script, { language, userId: user.id, speed: 0.8 });

    const { error: uploadErr } = await admin.storage
      .from("user-content")
      .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (uploadErr) throw new Error(`Upload de áudio falhou: ${uploadErr.message}`);

    return NextResponse.json({ audioUrl: path });
  } catch (err) {
    console.error("POST /api/practices/visualization/voice error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar voz", detail: String(err) },
      { status: 500 }
    );
  }
}
