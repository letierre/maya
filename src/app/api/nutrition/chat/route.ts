import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasActiveSubscription, subscriptionRequired } from "@/lib/subscription-guard";
import { NextResponse } from "next/server";
import { buildNutritionContext, buildNutritionSystemPrompt } from "@/lib/nutrition-assistant";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  if (!(await hasActiveSubscription(user.id))) return subscriptionRequired();

  try {
    const body = await request.json();
    const messages = body.messages as { role: string; content: string }[];

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages obrigatorio" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Buscar refeições (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: meals } = await admin
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .gte("data_hora", thirtyDaysAgo.toISOString())
      .order("data_hora", { ascending: false });

    // Buscar check-ins recentes
    const { data: checkIns } = await admin
      .from("check_ins")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(14);

    // Buscar preferências
    const { data: prefs } = await admin
      .from("preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const ctx = buildNutritionContext(
      meals || [],
      checkIns || [],
      (prefs?.context as Record<string, unknown>) || {}
    );

    const systemPrompt = buildNutritionSystemPrompt(ctx);

    // Concatena o historico no userMessage
    const userMessage = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const reply = await callLLM(systemPrompt, userMessage, { maxTokens: 500, temperature: 0.5 });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("POST /api/nutrition/chat error:", error);
    return NextResponse.json(
      { error: "Erro ao processar chat de nutricao", detail: String(error) },
      { status: 500 }
    );
  }
}
