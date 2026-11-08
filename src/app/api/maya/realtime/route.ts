import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { buildMayaSystemPrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput } from "@/lib/maya-context";
import { getMayaPersona } from "@/lib/maya-persona";
import { getCurrentHour, getLocalDate } from "@/lib/utils";
import { startRealtimeConversation } from "@/lib/realtime-voice";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
export const maxDuration = 60; // só montar o contexto da Maya + mintar a conversa

// Instrução de fala para o modo ligação (voz em tempo real). Mantém a persona
// acolhedora e evita estruturas que não soam naturais faladas em voz alta.
const VOICE_DELIVERY = `\n\n## COMO FALAR (modo ligação)\nEsta é uma conversa FALADA em tempo real, como uma ligação. Fale como quem conversa de verdade:\n- Frases curtas, uma ideia por vez.\n- Sem listas, markdown, emojis nem estruturas que não soem naturais em voz.\n- Tom acolhedor, doce e feminino — sem soar fria, seca nem robótica.\n- Reaja ao que a pessoa acabou de dizer; não repita sempre a mesma abertura.`;

/**
 * POST /api/maya/realtime — minta uma conversa em tempo real (ligação) da Maya.
 * Monta o MESMO contexto do chat (fetchMayaContext + toMayaInput + persona) e
 * injeta o prompt completo no agente da ElevenLabs. Devolve a signed_url para o
 * cliente abrir o canal de áudio full-duplex.
 *
 * Body (JSON): { timezone?, localHour?, localDate? }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

  const agentId = process.env.ELEVENLABS_AGENT_ID || "";
  if (!agentId) {
    return NextResponse.json({ error: "Agente de voz não configurado" }, { status: 503 });
  }

  const admin = getSupabaseAdmin();

  try {
    const body = await request.json();
    const clientTz = body.timezone || "America/Sao_Paulo";
    const clientHour = body.localHour;
    const clientDate = body.localDate;

    let currentHour: number;
    let currentDate: string;
    if (clientHour !== undefined && clientDate) {
      currentHour = clientHour;
      currentDate = clientDate;
    } else {
      currentHour = getCurrentHour(clientTz);
      currentDate = getLocalDate(clientTz);
    }

    // Contexto único (mesma fonte do chat). Sem recall por gatilho aqui: ainda não
    // há fala do usuário na mintagem — memória/agenda/persona já dão contexto rico.
    const ctx = await fetchMayaContext(user.id, {
      includeAreaVisions: true,
      includeAgenda: true,
      tz: clientTz,
    });
    const context = (ctx.prefs?.context ?? {}) as Record<string, unknown>;
    const language = (context.language as string) || "pt";
    const userGender = (context.gender as string) || "nao_dizer";

    const mayaInput = toMayaInput(ctx, {
      name: (user.user_metadata?.name as string) || "",
      gender: userGender,
      language,
      currentHour,
      currentDate,
      tz: clientTz,
    });
    mayaInput.persona = await getMayaPersona(admin, user.id, { tz: clientTz });
    mayaInput.isConversation = true;

    const systemPrompt = buildMayaSystemPrompt(mayaInput) + VOICE_DELIVERY;

    const { conversationId, signedUrl } = await startRealtimeConversation({
      agentId,
      systemPrompt,
      dynamicVariables: {
        name: (user.user_metadata?.name as string) || "",
        language,
        current_date: currentDate,
        // Fallback de atribuição no webhook caso data.user_id não volte.
        supabase_user_id: user.id,
      },
      userId: user.id,
    });

    return NextResponse.json({ conversationId, signedUrl, agentId });
  } catch (error) {
    console.error("POST /api/maya/realtime error:", error);
    logError({ path: "api/maya/realtime POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Não foi possível iniciar a chamada", detail: String(error) },
      { status: 500 }
    );
  }
}
