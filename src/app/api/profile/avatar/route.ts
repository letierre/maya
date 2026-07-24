import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}_${Date.now()}.${ext}`;

    const admin = getSupabaseAdmin();

    // Upload to Supabase Storage
    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = admin.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Store avatar URL in user_preferences (DB) — NOT in JWT metadata
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("context, enabled_questions, onboarding_completed")
      .eq("user_id", user.id)
      .single();

    const context = { ...((prefs?.context as Record<string, unknown>) || {}), avatar_url: avatarUrl };

    await admin
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        enabled_questions: prefs?.enabled_questions || [],
        context,
        onboarding_completed: prefs?.onboarding_completed ?? true,
        updated_at: new Date().toISOString(),
      });

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error("POST /api/profile/avatar error:", error);
    return NextResponse.json(
      { error: "Erro ao enviar foto", detail: String(error) },
      { status: 500 }
    );
  }
}
