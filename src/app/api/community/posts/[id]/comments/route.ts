import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/community/posts/[id]/comments
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("community_comments").select("*").eq("post_id", id).order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/community/posts/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (!body.content?.trim()) return NextResponse.json({ error: "Conteúdo obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", user.id).maybeSingle();
  const ctx = (prefs?.context || {}) as Record<string, unknown>;
  let displayName = (ctx.community_name as string) || "";
  if (!displayName || displayName === "Anônimo") {
    const rnd = Math.floor(1000 + Math.random() * 9000);
    displayName = `Anônimo${rnd}`;
    ctx.community_name = displayName;
    await admin.from("user_preferences").upsert({
      user_id: user.id,
      context: ctx,
      enabled_questions: (prefs as any)?.enabled_questions || [],
      onboarding_completed: (prefs as any)?.onboarding_completed ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  const { data, error } = await admin.from("community_comments").insert({
    post_id: id,
    user_id: user.id,
    display_name: displayName,
    display_emoji: (ctx.community_emoji as string) || null,
    content: body.content.trim(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
