import { NextResponse, after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyElevenLabsWebhookSignature } from "@/lib/realtime-voice";
import { extractAndStoreMemory } from "@/lib/memory-write";
import { logError } from "@/lib/error-log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/maya/realtime/webhook — pós-chamada da ElevenLabs (post_call_transcription).
 * Verifica o HMAC, persiste os turnos (usuária + assistente) no chat_messages com
 * idempotência por conversation_id, e roda a extração de memória em background.
 * Precisa responder 200 rápido para a ElevenLabs não desabilitar o webhook.
 */
export async function POST(request: Request) {
  // Corpo CRU antes de qualquer parse — o HMAC valida a string original.
  const rawBody = await request.text();
  const signature = request.headers.get("elevenlabs-signature");

  if (!verifyElevenLabsWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  // Só trata o evento de transcrição; ignora os demais (audio, falha de início, …).
  if (event.type !== "post_call_transcription") {
    return NextResponse.json({ received: true });
  }

  const data = (event.data ?? {}) as Record<string, any>;
  const userId =
    (data.user_id as string | undefined) ||
    (data.conversation_initiation_client_data?.dynamic_variables?.supabase_user_id as
      | string
      | undefined);
  const conversationId = data.conversation_id as string | undefined;
  const transcript = (data.transcript ?? []) as Array<{
    role: string;
    message: string;
  }>;

  if (!conversationId || !Array.isArray(transcript) || transcript.length === 0) {
    return NextResponse.json({ received: true });
  }

  // Falha de atribuição: não conseguiu mapear a conversa para um usuário. Loga
  // para detectar em produção (senão a conversa seria perdida silenciosamente).
  if (!userId) {
    console.warn(
      `[realtime webhook] user_id ausente para conversation ${conversationId} — ` +
        `não foi possível atribuir a conversa a um usuário.`,
    );
    return NextResponse.json({ received: true });
  }

  const admin = getSupabaseAdmin();

  // Idempotência: se o 1º turno desta conversa já existe, é retry do webhook.
  const { data: existing } = await admin
    .from("chat_messages")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", `rt-${conversationId}-0`)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ received: true });

  const turns = transcript
    .map((t, i) => ({
      role: t.role === "agent" ? "assistant" : t.role === "user" ? "user" : null,
      content: (t.message || "").trim(),
      client_id: `rt-${conversationId}-${i}`,
    }))
    .filter((t): t is { role: string; content: string; client_id: string } =>
      Boolean(t.role && t.content)
    );

  if (turns.length === 0) return NextResponse.json({ received: true });

  const rows = turns.map((t) => ({
    user_id: userId,
    role: t.role,
    content: t.content,
    client_id: t.client_id,
    chat_type: "maya",
  }));

  const { error: insertError } = await admin.from("chat_messages").upsert(rows, {
    onConflict: "user_id,client_id",
    ignoreDuplicates: true,
  });
  if (insertError) {
    logError({ path: "api/maya/realtime/webhook persist", message: insertError.message, userId });
    return NextResponse.json({ error: "Falha ao salvar conversa" }, { status: 500 });
  }

  // Memória de longo prazo em background (não bloqueia o ack do webhook).
  const recentMessages = turns.map((t) => ({ role: t.role, content: t.content }));
  const reply = [...turns].reverse().find((t) => t.role === "assistant")?.content || "";
  after(() => {
    (async () => {
      const { data: prefs } = await admin
        .from("user_preferences")
        .select("context")
        .eq("user_id", userId)
        .single();
      const context = (prefs?.context ?? {}) as Record<string, unknown>;
      const language = (context.language as string) || "pt";
      const tz = (context.timezone as string) || "America/Sao_Paulo";
      await extractAndStoreMemory({ userId, recentMessages, reply, language, tz });
    })().catch((err) => {
      logError({ path: "api/maya/realtime/webhook memory", message: String(err), userId });
    });
  });

  return NextResponse.json({ received: true });
}
