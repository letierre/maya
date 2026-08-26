import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_QUESTION_KEYS } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

// Expande as chaves legadas de check-in para as novas chaves granulares
// (meditação/oração/respiração e caminhada/corrida/musculação), de forma
// idempotente, para que usuários existentes não percam as perguntas.
function normalizeEnabledQuestions(
  keys: string[] | undefined | null,
  context: Record<string, unknown> | undefined | null
): string[] {
  if (!Array.isArray(keys)) return [...ALL_QUESTION_KEYS];
  const hasFaith = Boolean(context?.has_faith);
  const out = new Set<string>();
  for (const k of keys) {
    if (k === "meditation_prayer_breathing") {
      out.add("meditation");
      if (hasFaith) out.add("prayer");
      out.add("breathing");
    } else if (k === "exercise_walk") {
      out.add("walked");
      out.add("ran");
      out.add("strength_training");
    } else {
      out.add(k);
    }
  }
  // Novo hábito de leitura: habilitado por padrão para usuários existentes
  out.add("read");
  return [...out];
}

// Mapeia o payload de onboarding do cliente para as colunas da tabela
// onboarding_responses (análise de perfil de usuário / otimização de anúncios).
function mapOnboarding(o: Record<string, unknown> | undefined) {
  const s = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    goal: o?.goal ?? null,
    pain_points: s(o?.pain_points),
    tinder_agreed: s(o?.tinder_agreed),
    area_preferences: s(o?.area_preferences),
    gender: o?.gender ?? null,
    language: o?.language ?? null,
    has_medication: o?.has_medication ?? null,
    has_faith: o?.has_faith ?? null,
    has_creative_hobby: o?.has_creative_hobby ?? null,
    track_suicidal_thoughts: o?.track_suicidal_thoughts ?? null,
    utm_source: o?.utm_source ?? null,
    utm_campaign: o?.utm_campaign ?? null,
  };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: prefs, error } = await admin
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!prefs) {
      return NextResponse.json({
        enabled_questions: [...ALL_QUESTION_KEYS],
        context: {},
        onboarding_completed: false,
      });
    }

    return NextResponse.json({
      enabled_questions: normalizeEnabledQuestions(prefs.enabled_questions, prefs.context),
      context: prefs.context || {},
      onboarding_completed: prefs.onboarding_completed,
    });
  } catch (error) {
    console.error("GET /api/preferences error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar preferências", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { enabled_questions, context, onboarding_completed, onboarding } = body;

    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      const { data: updated, error } = await admin
        .from("user_preferences")
        .update({
          enabled_questions: enabled_questions ?? undefined,
          context: context ?? undefined,
          onboarding_completed: onboarding_completed ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      if (onboarding) {
        await admin
          .from("onboarding_responses")
          .upsert({ user_id: user.id, ...mapOnboarding(onboarding) }, { onConflict: "user_id" });
      }

      return NextResponse.json({
        enabled_questions: updated.enabled_questions,
        context: updated.context || {},
        onboarding_completed: updated.onboarding_completed,
      });
    }

    const { data: created, error } = await admin
      .from("user_preferences")
      .insert({
        user_id: user.id,
        enabled_questions: enabled_questions ?? [...ALL_QUESTION_KEYS],
        context: context ?? {},
        onboarding_completed: onboarding_completed ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    if (onboarding) {
      await admin
        .from("onboarding_responses")
        .upsert({ user_id: user.id, ...mapOnboarding(onboarding) }, { onConflict: "user_id" });
    }

    return NextResponse.json(
      {
        enabled_questions: created.enabled_questions,
        context: created.context || {},
        onboarding_completed: created.onboarding_completed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/preferences error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar preferências", detail: String(error) },
      { status: 500 }
    );
  }
}
