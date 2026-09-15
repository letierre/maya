/**
 * Shared LLM call — Claude (Anthropic).
 * Supports text-only and multimodal (image) messages.
 */

import { logAiUsage } from "@/lib/ai-usage";
import { logError } from "@/lib/error-log";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** Convert a data: URL (OpenAI format) to Anthropic image block */
export function toImageBlock(dataUrl: string): ContentBlock {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL");
  return {
    type: "image",
    source: { type: "base64", media_type: match[1], data: match[2] },
  };
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string | ContentBlock[],
  options?: { maxTokens?: number; temperature?: number; model?: string; feature?: string; userId?: string }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const maxTokens = options?.maxTokens ?? 500;
  const model = options?.model ?? "claude-haiku-4-5-20251001";

  const userContent = typeof userMessage === "string"
    ? [{ type: "text" as const, text: userMessage }]
    : userMessage;

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
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch (err) {
    logError({ path: "lib/llm.callLLM", message: String(err), userId: options?.userId, meta: { feature: options?.feature, model } });
    throw err;
  }

  if (!response.ok) {
    const err = await response.text();
    logError({ path: "lib/llm.callLLM", message: `Claude API error (${response.status}): ${err.slice(0, 200)}`, status: response.status, userId: options?.userId, meta: { feature: options?.feature, model } });
    throw new Error(`Claude API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();

  // Log do custo real (fire-and-forget) — tokens exatos da resposta.
  if (options?.userId) {
    logAiUsage({
      userId: options.userId,
      feature: options.feature ?? "general",
      model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    });
  }

  // Modelos com thinking (Sonnet/Opus 5) devolvem blocos de thinking antes do
  // texto; extrai o primeiro bloco de texto real, não `content[0]`.
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  return textBlock?.text || "";
}

/** Linha de prompt que define o idioma da resposta da IA (fallback pt). */
export function responseLanguageLine(lang?: string | null): string {
  if (lang === "es") return "Responda sempre em espanhol natural, com acentos e gramática corretos.";
  if (lang === "en") return "Always respond in natural English, with correct grammar and punctuation.";
  return "Responda sempre em português brasileiro natural, com acentos e gramática corretos.";
}
