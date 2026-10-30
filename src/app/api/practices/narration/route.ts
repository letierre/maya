import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { synthesizeSpeech } from "@/lib/tts";
import { buildNarration, type NarrationKind } from "@/lib/practice-narration";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/practices/narration — monta a playlist de blocos da sessão (voz da
 * Maya distribuída pelo tempo escolhido) e garante cada bloco no cache.
 *
 * Blocos sensoriais são compartilhados (cache global); só os blocos de
 * visualização que citam a meta (título/porquê/recompensa) são personalizados e
 * chaveados por goalId + hash do conteúdo da meta.
 *
 * Body: {
 *   kind: "meditation"|"visualization",
 *   pattern?: string,        // meditação: chave da prática (breath/body/...)
 *   goal_id?: string,        // visualização: id da meta
 *   language: "pt"|"es"|"en",
 *   duration_seconds: number,
 * }
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
    const kind: NarrationKind = body.kind === "visualization" ? "visualization" : "meditation";
    const language: Lang = body.language === "es" ? "es" : body.language === "en" ? "en" : "pt";
    const durationSec = Math.min(3600, Math.max(60, Number(body.duration_seconds) || 300));

    const admin = getSupabaseAdmin();

    // Visualização: busca a meta (ownership) para personalizar os blocos.
    let goalId = "";
    let goalHash = "";
    let goal: { title: string; why_it_matters: string; reward: string | null } | null = null;
    if (kind === "visualization") {
      goalId = String(body.goal_id || "");
      if (!goalId) {
        return NextResponse.json({ error: "Meta não informada" }, { status: 400 });
      }
      const { data: g, error: goalErr } = await admin
        .from("goals")
        .select("title, why_it_matters, reward")
        .eq("id", goalId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (goalErr) throw goalErr;
      if (!g) {
        return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
      }
      goal = { title: g.title ?? "", why_it_matters: g.why_it_matters ?? "", reward: g.reward ?? null };
      goalHash = createHash("md5")
        .update(`${goal.title}|${goal.why_it_matters}|${goal.reward ?? ""}`)
        .digest("hex")
        .slice(0, 12);
    }

    const specs = buildNarration({
      kind,
      practiceKey: body.pattern ? String(body.pattern) : undefined,
      goal: goal ?? undefined,
      durationSec,
      lang: language,
    });

    // Gera (e cacheia) os blocos faltantes, em paralelo com concorrência limitada.
    const blocks = await mapLimit(specs, 4, async (spec) => {
      const path = spec.personalized
        ? `practices/v3/visualization/${language}/${goalId}/${goalHash}/${spec.key}.mp3`
        : `practices/v3/${kind}/${language}/${spec.key}.mp3`;

      const existing = await admin.storage.from("user-content").download(path);
      if (!existing.data) {
        const { audio } = await synthesizeSpeech(spec.text, { language, userId: user.id, speed: 0.8 });
        const { error } = await admin.storage
          .from("user-content")
          .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(`Upload de áudio falhou: ${error.message}`);
      }

      return { url: path, atSec: spec.atSec };
    });

    return NextResponse.json({ blocks, totalSeconds: durationSec });
  } catch (err) {
    console.error("POST /api/practices/narration error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar narração", detail: String(err) },
      { status: 500 }
    );
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
