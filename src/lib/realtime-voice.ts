import crypto from "crypto";

/**
 * Conversa em tempo real da Maya via ElevenLabs Conversational AI.
 *
 * O agente (criado no painel da ElevenLabs, modelo Claude, voz = ELEVENLABS_VOICE_ID_*)
 * cuida do áudio full-duplex (STT + TTS streaming + VAD + interrupção). Nosso papel:
 *   1. MINTAR a conversa injetando o prompt de sistema COMPLETO da Maya (a persona e o
 *      contexto dela) via `conversation_config_override.agent.prompt.prompt` — assim a
 *      mesma Maya do chat é a da ligação.
 *   2. RECEBER o webhook pós-chamada e verificar a assinatura (HMAC).
 *
 * A chave da API fica sempre no servidor; o cliente só recebe a signed_url.
 */

const CONVAI_BASE = "https://api.elevenlabs.io/v1/convai";

/**
 * Inicia uma conversa em tempo real e devolve a signed_url para o cliente conectar.
 */
export async function startRealtimeConversation(opts: {
  agentId: string;
  systemPrompt: string;
  dynamicVariables: Record<string, string | number | boolean>;
  userId: string;
}): Promise<{ conversationId: string; signedUrl: string }> {
  const key = process.env.ELEVENLABS_API_KEY || "";

  // 1) Cria a conversa com o override do prompt + variáveis dinâmicas.
  //    `user_id` volta no webhook (data.user_id) para atribuir a conversa ao usuário.
  const createRes = await fetch(`${CONVAI_BASE}/conversation`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: opts.agentId,
      conversation_initiation_client_data: {
        conversation_config_override: {
          agent: { prompt: { prompt: opts.systemPrompt } },
        },
        dynamic_variables: opts.dynamicVariables,
        user_id: opts.userId,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`ElevenLabs start conversation (${createRes.status}): ${err.slice(0, 300)}`);
  }

  const created = (await createRes.json()) as Record<string, unknown>;
  const conversationId = created.conversation_id as string | undefined;
  if (!conversationId) throw new Error("ElevenLabs: conversation_id ausente na resposta");

  // 2) signed_url pode vir na resposta de criação ou exigir um GET na conversa.
  const signedUrl =
    (created.signed_url as string | undefined) || (await fetchSignedUrl(conversationId, key));
  if (!signedUrl) throw new Error("ElevenLabs: signed_url ausente");

  return { conversationId, signedUrl };
}

async function fetchSignedUrl(conversationId: string, key: string): Promise<string> {
  const res = await fetch(`${CONVAI_BASE}/conversation/${conversationId}`, {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) throw new Error(`ElevenLabs get signed_url (${res.status})`);
  const data = (await res.json()) as Record<string, unknown>;
  return (data.signed_url as string) || "";
}

/**
 * Verifica a assinatura do webhook da ElevenLabs.
 * Header: "t=<timestamp>,v0=<hex>" (ou v1). HMAC-SHA256 hex sobre "<timestamp>.<rawBody>".
 * Janela de replay: 30 min (padrão da ElevenLabs).
 */
export function verifyElevenLabsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || "";
  if (!signatureHeader || !secret) return false;

  const parts = new Map(
    signatureHeader.split(",").map((p) => {
      const eq = p.indexOf("=");
      if (eq === -1) return [p.trim(), ""];
      return [p.slice(0, eq).trim(), p.slice(eq + 1).trim()];
    }),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1") || parts.get("v0");
  if (!timestamp || !signature) return false;

  const ts = parseInt(timestamp, 10);
  const ageSec = Math.floor(Date.now() / 1000) - ts;
  if (!Number.isFinite(ageSec) || ageSec < -60 || ageSec > 1800) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
