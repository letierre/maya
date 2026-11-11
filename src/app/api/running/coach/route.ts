import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { synthesizeSpeech } from "@/lib/tts";
import { t, type Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pool de frases de incentivo a cada km (curtas, no tom da Maya). O cliente
// cicla por elas conforme o usuário cruza cada quilômetro.
const KM_KEYS = ["coach_km_1", "coach_km_2", "coach_km_3", "coach_km_4", "coach_km_5", "coach_km_6"];

/**
 * POST /api/running/coach — garante no cache as falas da Maya do módulo de
 * corrida (intro + incentivos por km) e devolve os paths dos áudios.
 * Body: { language: "pt"|"es"|"en" }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const language: Lang = body.language === "es" ? "es" : body.language === "en" ? "en" : "pt";

    const admin = getSupabaseAdmin();
    const specs: { key: string; text: string }[] = [
      { key: "intro", text: t(language, "coach_intro") },
      ...KM_KEYS.map((k, i) => ({ key: `km_${i}`, text: t(language, k) })),
    ];

    const urls = await mapLimit(specs, 4, async (spec) => {
      const path = `running/coach/v1/${language}/${spec.key}.mp3`;
      const existing = await admin.storage.from("user-content").download(path);
      if (!existing.data) {
        const { audio } = await synthesizeSpeech(spec.text, { language, userId: user.id, speed: 0.9 });
        const { error } = await admin.storage
          .from("user-content")
          .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(`Upload de áudio falhou: ${error.message}`);
      }
      return path;
    });

    return NextResponse.json({ intro: urls[0], km: urls.slice(1) });
  } catch (err) {
    console.error("POST /api/running/coach error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar coaching", detail: String(err) },
      { status: 500 }
    );
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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
