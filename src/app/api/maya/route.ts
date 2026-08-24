import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildMayaSystemPrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput } from "@/lib/maya-context";
import { toImageBlock } from "@/lib/llm";
import { NextResponse } from "next/server";

// ── Helpers ──────────────────────────────────────────────────────────

/** Fetch an image from Supabase Storage and return as a base64 data URL */
async function fetchImageAsBase64(path: string): Promise<string> {
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
async function chatLLM(
  system: string,
  messages: { role: string; content: string; image_urls?: string[] }[],
  maxTokens = 400
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const messages: { role: string; content: string; image_urls?: string[]; date?: string; time?: string }[] = body.messages || [];
    const clientTz = body.timezone || "America/Sao_Paulo";
    const clientHour = body.localHour;
    const clientDate = body.localDate;

    if (!messages.length) {
      return NextResponse.json({ error: "Mensagens vazias" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // ── Contexto único (mesma fonte que home/planejamento/nudge) ──
    const ctx = await fetchMayaContext(user.id, { includeAreaVisions: true });
    const context = (ctx.prefs?.context ?? {}) as Record<string, unknown>;

    // Hora e data no fuso do usuario (do browser, fallback SP)
    let currentHour: number;
    let currentDate: string;
    if (clientHour !== undefined && clientDate) {
      currentHour = clientHour;
      currentDate = clientDate;
    } else {
      const now = new Date();
      const h = now.toLocaleString("en-US", { timeZone: clientTz, hour: "numeric", hour12: false });
      currentHour = parseInt(h, 10);
      currentDate = now.toLocaleDateString("en-CA", { timeZone: clientTz });
    }

    // Send messages WITH image_urls for multimodal support.
    // Prefix each message with [dia HH:MM] so Maya understands WHEN each
    // message happened (hoje/ontem/há N dias) and the gaps between them —
    // crucial for reading intent and temporal context like a human would.
    const dayLabelFor = (dateStr: string): string => {
      if (!dateStr) return "";
      const d = new Date(dateStr + "T00:00:00");
      const c = new Date(currentDate + "T00:00:00");
      const diff = Math.round((c.getTime() - d.getTime()) / 86400000);
      if (diff <= 0) return "hoje";
      if (diff === 1) return "ontem";
      if (diff === 2) return "anteontem";
      return `há ${diff} dias`;
    };

    const anthropicMessages = messages.map((m) => {
      const day = dayLabelFor(m.date || "");
      const timePrefix = m.time ? `[${day ? day + " " : ""}${m.time}] ` : "";
      return {
        role: m.role,
        content: timePrefix + m.content,
        image_urls: (m as { image_urls?: string[] }).image_urls,
      };
    });

    const userGender = (context.gender as string) || "nao_dizer";

    const systemPrompt = buildMayaSystemPrompt(toMayaInput(ctx, {
      name: (user.user_metadata?.name as string) || "",
      gender: userGender,
      language: (context.language as string) || "pt",
      currentHour,
      currentDate,
    }));

    const rawReply = await chatLLM(systemPrompt, anthropicMessages, 400);
    // Belt-and-suspenders: strip any "[dia HH:MM]" timestamp tokens Maya may echo
    // (e.g. "[21:06]", "[hoje 23:07]", "[ontem 14:30]", "[há 3 dias 09:10]").
    // These are internal rhythm context only — never shown to the user.
    const reply = rawReply
      .replace(/\[\s*(?:hoje|ontem|anteontem|há\s*\d+\s*dias)?\s*\d{1,2}:\d{2}\s*\]\s*/gi, "")
      .trim();

    // Extract new facts from the conversation (fire and forget)
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      const factPrompt = buildFactExtractionPrompt(reply, lastUserMsg.content, { name: (user.user_metadata?.name as string) || "" });

      chatLLM(
        "Extraia fatos pessoais como JSON array. Responda APENAS com o array JSON.",
        [{ role: "user", content: factPrompt }],
        150
      )
        .then((raw) => {
          try {
            const jsonStart = raw.indexOf("[");
            const jsonEnd = raw.lastIndexOf("]") + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const facts: string[] = JSON.parse(raw.slice(jsonStart, jsonEnd));
              for (const fact of facts) {
                if (fact && fact.trim().length >= 3) {
                  admin.from("user_memories").insert({
                    user_id: user.id,
                    fact: fact.trim(),
                  }).then(() => {}).catch(() => {});
                }
              }
            }
          } catch {
            // silent — fact extraction is best-effort
          }
        })
        .catch(() => {});
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/maya error:", error);
    return NextResponse.json(
      { error: "Erro ao conversar com Maya", detail: String(error) },
      { status: 500 }
    );
  }
}

function buildFactExtractionPrompt(mayaReply: string, userMessage: string, profile: { name: string }): string {
  return `Você é um assistente que extrai FATOS PESSOAIS sobre o usuário a partir de uma conversa.

Mensagem do usuário:
"${userMessage.slice(0, 300)}"

Resposta de Maya:
"${mayaReply.slice(0, 300)}"

## INSTRUÇÕES
1. Extraia apenas fatos NOVOS e RELEVANTES sobre a vida pessoal do usuário que Maya mencionou ou descobriu.
2. NÃO extraia dados óbvios de check-in (ex: "fez exercício 3x essa semana").
3. Extraia preferências, contexto de vida, rotinas específicas, relações, gostos pessoais.
4. Exemplos do que extrair:
   - "gosta de caminhar à noite"
   - "tem uma filha chamada Sofia"
   - "trabalha como designer"
   - "está estudando para concurso"
   - "adora cozinhar aos domingos"
   - "mora sozinho(a)"
5. Exemplos do que NÃO extrair:
   - "teve 3 dias bons essa semana"
   - "marcou exercício 5 vezes"
6. Retorne APENAS um array JSON com os fatos como strings. Se não houver fatos novos, retorne array vazio.
7. Máximo 3 fatos.

Formato: ["fato 1", "fato 2"]`;
}
