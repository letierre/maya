/**
 * Shared LLM call — Claude (Anthropic).
 * Supports text-only and multimodal (image) messages.
 */

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
  options?: { maxTokens?: number; temperature?: number; model?: string }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const maxTokens = options?.maxTokens ?? 500;
  const model = options?.model ?? "claude-haiku-4-5-20251001";

  const userContent = typeof userMessage === "string"
    ? [{ type: "text" as const, text: userMessage }]
    : userMessage;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  // Modelos com thinking (Sonnet/Opus 5) devolvem blocos de thinking antes do
  // texto; extrai o primeiro bloco de texto real, não `content[0]`.
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  return textBlock?.text || "";
}
