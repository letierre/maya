import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendOryenEvent, type OryenUserData } from "@/lib/oryen";
import { NextRequest, NextResponse } from "next/server";

const BODY_FIELDS = [
  "sex", "birth_date", "weight_kg", "height_cm", "body_fat_pct",
  "neck_cm", "chest_cm", "waist_cm", "hip_cm", "arm_cm", "thigh_cm", "calf_cm",
  "activity_level", "goal",
] as const;

// Aceita só os campos conhecidos de BodyData (numéricos e strings), descarta o resto.
function sanitizeBody(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const f of BODY_FIELDS) {
    const v = src[f];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "number") { if (Number.isFinite(v)) out[f] = v; }
    else if (typeof v === "string") out[f] = v;
  }
  return out;
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    // Update auth metadata (name)
    if (body.name !== undefined) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { name: body.name },
      });
    }

    // Update preferences (gender, language, porques, context)
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context, enabled_questions, onboarding_completed")
      .eq("user_id", user.id)
      .single();

    const context = { ...((prefs?.context as Record<string, unknown>) || {}) };
    if (body.gender !== undefined) context.gender = body.gender;
    if (body.language !== undefined) context.language = body.language;
    if (body.porques !== undefined) context.porques = body.porques;
    if (body.body !== undefined) {
      const clean = sanitizeBody(body.body);
      if (Object.keys(clean).length === 0) delete context.body;
      else context.body = clean;
    }

    await admin
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        enabled_questions: prefs?.enabled_questions || [],
        context,
        onboarding_completed: prefs?.onboarding_completed ?? true,
        updated_at: new Date().toISOString(),
      });

    // Sincroniza com a Oryen SOMENTE os campos que de fato mudaram (evita
    // chamadas desnecessárias quando o save não altera nada).
    const oldName = (user.user_metadata?.name as string) || "";
    const oldCtx = (prefs?.context as Record<string, unknown>) || {};
    const changes: OryenUserData = { external_id: user.id };
    let hasChange = false;

    if (body.name !== undefined) {
      const newName = typeof body.name === "string" ? body.name.trim() : "";
      if (newName !== oldName) { changes.name = newName || null; hasChange = true; }
    }
    if (body.gender !== undefined && body.gender !== oldCtx.gender) {
      changes.gender = body.gender ?? null; hasChange = true;
    }
    if (body.language !== undefined && body.language !== oldCtx.language) {
      changes.language = body.language ?? null; hasChange = true;
    }

    if (hasChange) sendOryenEvent("user.updated", changes);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context")
      .eq("user_id", user.id)
      .single();

    const ctx = (prefs?.context as Record<string, unknown>) || {};

    const { data: role } = await admin
      .from("user_roles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    // Avatar: read from DB context — NOT from JWT user_metadata
    const avatarUrl = (ctx.avatar_url as string) || null;

    return NextResponse.json({
      email: user.email,
      name: user.user_metadata?.name || "",
      avatar_url: avatarUrl,
      created_at: user.created_at || null,
      gender: ctx.gender || "nao_dizer",
      language: ctx.language || "pt",
      porques: (ctx.porques as Array<{ id: string; text: string; photoPath: string | null }>) || [],
      body: (ctx.body as Record<string, unknown>) || null,
      is_admin: role?.is_admin ?? false,
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil", detail: String(error) },
      { status: 500 }
    );
  }
}
