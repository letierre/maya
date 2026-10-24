import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { buildMayaSystemPrompt } from "@/lib/maya";
import { fetchMayaContext, toMayaInput, fetchTriggeredMemories } from "@/lib/maya-context";
import { getMayaPersona } from "@/lib/maya-persona";
import { relativeDayLabel } from "@/lib/utils";
import { chatLLM } from "@/lib/maya-chat";
import { logError } from "@/lib/error-log";
import { NextResponse, after } from "next/server";
import { extractAndStoreMemory } from "@/lib/memory-write";

// ── Helpers (chatLLM/fetchImageAsBase64 movidos para src/lib/maya-chat.ts) ──

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

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

    const lastUserMsgText = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // ── Contexto único + recall por gatilho (em paralelo) ──
    // O recall embute a última mensagem e busca as memórias mais relevantes de
    // QUALQUER época — é o que faz a Maya "lembrar como amiga".
    const [ctx, triggeredMemories] = await Promise.all([
      fetchMayaContext(user.id, { includeAreaVisions: true, includeAgenda: true, tz: clientTz }),
      lastUserMsgText
        ? fetchTriggeredMemories(user.id, lastUserMsgText, { todayStr: currentDate, tz: clientTz, limit: 6 }).catch(() => [] as string[])
        : Promise.resolve([] as string[]),
    ]);
    const context = (ctx.prefs?.context ?? {}) as Record<string, unknown>;

    // Send messages WITH image_urls for multimodal support.
    // Prefix each message with [dia HH:MM] so Maya understands WHEN each
    // message happened (hoje/ontem/há N dias) and the gaps between them —
    // crucial for reading intent and temporal context like a human would.
    const dayLabelFor = (dateStr: string): string => relativeDayLabel(dateStr, currentDate);

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

    const mayaInput = toMayaInput(ctx, {
      name: (user.user_metadata?.name as string) || "",
      gender: userGender,
      language: (context.language as string) || "pt",
      currentHour,
      currentDate,
      tz: clientTz,
    });
    mayaInput.triggeredMemories = triggeredMemories;
    mayaInput.persona = await getMayaPersona(admin, user.id, { tz: clientTz });

    const systemPrompt = buildMayaSystemPrompt(mayaInput);

    const rawReply = await chatLLM(systemPrompt, anthropicMessages, 1000, { userId: user.id, feature: "maya_chat" });
    // Belt-and-suspenders: strip any "[dia HH:MM]" timestamp tokens Maya may echo
    // (e.g. "[21:06]", "[hoje 23:07]", "[ontem 14:30]", "[há 3 dias 09:10]").
    // These are internal rhythm context only — never shown to the user.
    const reply = rawReply
      .replace(/\[\s*(?:hoje|ontem|anteontem|há\s*\d+\s*dias)?\s*\d{1,2}:\d{2}\s*\]\s*/gi, "")
      .trim();

    // ── Memória de longo prazo (após a resposta, não bloqueia o chat) ──
    // Extrai fatos estruturados, embeds e faz dedup/merge via vetor — em
    // background via `after()`, então a resposta ao usuário sai na hora.
    const recentForMemory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    after(() => {
      extractAndStoreMemory({
        userId: user.id,
        recentMessages: recentForMemory,
        reply,
        language: (context.language as string) || "pt",
      }).catch((err) => {
        logError({ path: "api/maya memory-write", message: String(err), userId: user.id, meta: { feature: "maya_memory_write" } });
      });
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/maya error:", error);
    logError({ path: "api/maya POST", message: String(error), userId: user?.id });
    return NextResponse.json(
      { error: "Erro ao conversar com Maya", detail: String(error) },
      { status: 500 }
    );
  }
}

