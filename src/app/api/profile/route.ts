import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    // Update auth metadata (name, avatar)
    if (body.name !== undefined || body.avatar_url !== undefined) {
      const metadata: Record<string, string> = {};
      if (body.name !== undefined) metadata.name = body.name;
      if (body.avatar_url !== undefined) metadata.avatar_url = body.avatar_url;

      const { error: updateError } = await admin.auth.admin.updateUserById(
        user.id,
        { user_metadata: metadata }
      );

      if (updateError) throw updateError;
    }

    // Update preferences (gender, language, porques, context)
    if (body.gender !== undefined || body.language !== undefined || body.porques !== undefined) {
      const { data: prefs } = await admin
        .from("user_preferences")
        .select("context, enabled_questions, onboarding_completed")
        .eq("user_id", user.id)
        .single();

      const context = { ...((prefs?.context as Record<string, unknown>) || {}) };
      if (body.gender !== undefined) context.gender = body.gender;
      if (body.language !== undefined) context.language = body.language;
      if (body.porques !== undefined) context.porques = body.porques;

      await admin
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          enabled_questions: prefs?.enabled_questions || [],
          context,
          onboarding_completed: prefs?.onboarding_completed ?? true,
          updated_at: new Date().toISOString(),
        });
    }

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
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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

    // Generate signed URL for avatar if exists
    let avatarUrl: string | null = null;
    const rawAvatar = user.user_metadata?.avatar_url;
    if (rawAvatar && typeof rawAvatar === "string") {
      try {
        // Extract bucket and path from full Supabase URL or relative path
        const urlMatch = rawAvatar.match(/\/storage\/v1\/object\/public\/(.+)/);
        const storagePath = urlMatch ? urlMatch[1] : (rawAvatar.includes("/") ? rawAvatar : null);
        if (storagePath) {
          // Try bucket based on path prefix, fallback to user-content
          const bucket = storagePath.startsWith("avatars/") ? "avatars" : "user-content";
          const { data } = await admin.storage.from(bucket).createSignedUrl(storagePath, 86400);
          if (data?.signedUrl) {
            avatarUrl = data.signedUrl;
          } else {
            // Fallback: try user-content bucket
            const { data: data2 } = await admin.storage.from("user-content").createSignedUrl(storagePath, 86400);
            if (data2?.signedUrl) avatarUrl = data2.signedUrl;
          }
        }
      } catch {
        // Fallback: return raw URL as-is
        avatarUrl = rawAvatar;
      }
    }

    return NextResponse.json({
      email: user.email,
      name: user.user_metadata?.name || "",
      avatar_url: avatarUrl,
      created_at: user.created_at || null,
      gender: ctx.gender || "nao_dizer",
      language: ctx.language || "pt",
      porques: (ctx.porques as Array<{ id: string; text: string; photoPath: string | null }>) || [],
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil", detail: String(error) },
      { status: 500 }
    );
  }
}
