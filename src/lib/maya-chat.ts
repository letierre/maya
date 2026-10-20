import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toImageBlock } from "@/lib/llm";
import { logAiUsage } from "@/lib/ai-usage";
import { logError } from "@/lib/error-log";

/**
 * LLM de conversa da Maya (multi-mensagem + multimodal).
 * Compartilhado entre o chat de texto (`/api/maya`) e o chat por voz
 * (`/api/maya/voice`) para que a Maya seja UMA SÓ — mesma persona, mesmo
 * histórico, mesma memória.
 */

/** Fetch an image from Supabase Storage and return as a base64 data URL */
export async function fetchImageAsBase64(path: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from("user-content").download(path);
  if (error || !data) throw new Error(`Failed to fetch image: ${path}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType = path.endsWith(".png")
    ? "image/png"
    : path.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// Chat-style call with message history — Claude (Anthropic) with multimodal support
export async function chatLLM(
  system: string,
  messages: { role: string; content: string; image_urls?: string[] }[],
  maxTokens = 400,
  meta?: { userId: string; feature: string }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";

  // Convert messages to Anthropic format.
  // User messages with image_urls get ContentBlock[] (text + images).
  const anthropicMessages = await Promise.all(
    messages.map(async (m) => {
      // Only user messages carry images; assistant messages are plain text
      if (m.role === "user" && m.image_urls?.length) {
        const blocks: Array<Record<string, unknown>> = [
          { type: "text", text: m.content },
        ];
        for (const path of m.image_urls) {
          const base64 = await fetchImageAsBase64(path);
          blocks.push(toImageBlock(base64));
        }
        return { role: "user", content: blocks };
      }
      return { role: m.role, content: m.content };
    })
  );

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        temperature: 0.7,
        system,
        messages: anthropicMessages,
      }),
    });
  } catch (err) {
    logError({ path: "maya-chat chatLLM", message: String(err), userId: meta?.userId, meta: { feature: meta?.feature } });
    throw err;
  }

  if (!response.ok) {
    const err = await response.text();
    logError({ path: "maya-chat chatLLM", message: `Claude API error (${response.status}): ${err.slice(0, 200)}`, status: response.status, userId: meta?.userId, meta: { feature: meta?.feature } });
    throw new Error(`Claude API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();

  // Log do custo real — tokens exatos da resposta.
  if (meta?.userId) {
    logAiUsage({
      userId: meta.userId,
      feature: meta.feature,
      model: "claude-haiku-4-5-20251001",
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    });
  }

  return data.content?.[0]?.text || "";
}
