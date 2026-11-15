import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MEASUREMENT_FIELDS } from "@/lib/body-metrics";
import { NextRequest, NextResponse } from "next/server";

// GET — retorna os dados fixos (sexo, nascimento) + o histórico de lançamentos.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context")
    .eq("user_id", user.id)
    .single();

  const ctx = (prefs?.context as Record<string, unknown>) || {};
  const body = (ctx.body as Record<string, unknown>) || {};

  let { data: measurements, error } = await admin
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Backfill: usuários que já preenchiam o formulário antigo do perfil têm os
  // dados em context.body, mas nenhum lançamento no histórico. Migra uma vez
  // para não perder peso/altura/medidas já informados.
  if ((measurements || []).length === 0) {
    const legacy: Record<string, unknown> = {};
    for (const f of MEASUREMENT_FIELDS) {
      if (body[f] != null) legacy[f] = body[f];
    }
    if (Object.keys(legacy).length > 0) {
      const { data: inserted, error: insErr } = await admin
        .from("body_measurements")
        .insert({ user_id: user.id, recorded_at: new Date().toISOString(), ...legacy })
        .select("*");
      if (!insErr && inserted) measurements = inserted;
    }
  }

  return NextResponse.json({
    sex: (body.sex as string) || null,
    birth_date: (body.birth_date as string) || null,
    measurements: measurements || [],
  });
}

// PUT — atualiza apenas os dados fixos (sexo, nascimento), sem tocar nas medidas.
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const raw = await req.json();
  const admin = getSupabaseAdmin();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context, enabled_questions, onboarding_completed")
    .eq("user_id", user.id)
    .single();

  const ctx = { ...((prefs?.context as Record<string, unknown>) || {}) };
  const body = { ...((ctx.body as Record<string, unknown>) || {}) };

  if (raw.sex !== undefined) {
    if (raw.sex) body.sex = raw.sex;
    else delete body.sex;
  }
  if (raw.birth_date !== undefined) {
    if (raw.birth_date) body.birth_date = raw.birth_date;
    else delete body.birth_date;
  }
  ctx.body = body;

  await admin.from("user_preferences").upsert({
    user_id: user.id,
    enabled_questions: prefs?.enabled_questions || [],
    context: ctx,
    onboarding_completed: prefs?.onboarding_completed ?? true,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
