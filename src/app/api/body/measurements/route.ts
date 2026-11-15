import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDateFromISO, getTimezoneOffset } from "@/lib/utils";
import { MEASUREMENT_FIELDS } from "@/lib/body-metrics";
import { NextRequest, NextResponse } from "next/server";

const NUM_FIELDS = [
  "weight_kg", "height_cm", "body_fat_pct",
  "neck_cm", "chest_cm", "waist_cm", "hip_cm", "arm_cm", "thigh_cm", "calf_cm",
] as const;

// Aceita só números finitos e os campos textuais conhecidos; descarta o resto.
function sanitizeMeasurement(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of NUM_FIELDS) {
    const v = raw[f];
    if (typeof v === "number" && Number.isFinite(v)) out[f] = v;
  }
  if (typeof raw.activity_level === "string" && raw.activity_level) out.activity_level = raw.activity_level;
  if (typeof raw.goal === "string" && raw.goal) out.goal = raw.goal;
  return out;
}

// Espelha o último lançamento nos campos de medida do `context.body`, mantendo
// sexo/data de nascimento intactos. Assim Maya/nutrição/corrida continuam lendo
// o peso/altura atuais sem depender do histórico.
async function syncBodyCurrent(admin: any, userId: string) {
  const { data: latest } = await admin
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: prefs } = await admin
    .from("user_preferences")
    .select("context, enabled_questions, onboarding_completed")
    .eq("user_id", userId)
    .single();

  const ctx = { ...((prefs?.context as Record<string, unknown>) || {}) };
  const body = { ...((ctx.body as Record<string, unknown>) || {}) };

  for (const f of MEASUREMENT_FIELDS) delete body[f];
  if (latest) {
    for (const f of MEASUREMENT_FIELDS) {
      if (latest[f] != null) body[f] = latest[f];
    }
  }
  ctx.body = body;

  await admin.from("user_preferences").upsert({
    user_id: userId,
    enabled_questions: prefs?.enabled_questions || [],
    context: ctx,
    onboarding_completed: prefs?.onboarding_completed ?? true,
    updated_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const raw = await req.json();
  const clean = sanitizeMeasurement(raw);
  const admin = getSupabaseAdmin();
  const userId = user.id;

  const tz = typeof raw.tz === "string" ? raw.tz : "America/Sao_Paulo";
  const date = typeof raw.recorded_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.recorded_at)
    ? raw.recorded_at
    : getLocalDateFromISO(new Date().toISOString(), tz);
  const offset = getTimezoneOffset(tz, date);
  const start = `${date}T00:00:00${offset}`;
  const end = `${date}T23:59:59${offset}`;

  // Um lançamento por dia: se já existe para essa data, edita; senão, cria.
  const { data: existing } = await admin
    .from("body_measurements")
    .select("id")
    .eq("user_id", userId)
    .gte("recorded_at", start)
    .lte("recorded_at", end)
    .maybeSingle();

  let saved;
  if (existing) {
    const { data: updated, error } = await admin
      .from("body_measurements")
      .update(clean)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = updated;
  } else {
    const { data: inserted, error } = await admin
      .from("body_measurements")
      .insert({ user_id: userId, recorded_at: `${date}T12:00:00${offset}`, ...clean })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = inserted;
  }

  await syncBodyCurrent(admin, userId);
  return NextResponse.json(saved, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("body_measurements").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncBodyCurrent(admin, user.id);
  return NextResponse.json({ ok: true });
}
