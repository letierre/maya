import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "30");
  const before = searchParams.get("before"); // cursor for pagination

  let query = admin.from("community_posts").select(`
    *,
    community_comments(count),
    community_likes(count)
  `).order("created_at", { ascending: false }).limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if current user liked each post
  const postIds = (data || []).map(p => p.id);
  let likedSet = new Set<string>();
  if (postIds.length > 0) {
    const { data: likes } = await admin.from("community_likes")
      .select("post_id").eq("user_id", user.id).in("post_id", postIds);
    likedSet = new Set((likes || []).map(l => l.post_id));
  }

  const result = (data || []).map(p => ({
    ...p,
    comment_count: p.community_comments?.[0]?.count ?? 0,
    like_count: p.community_likes?.[0]?.count ?? 0,
    liked_by_me: likedSet.has(p.id),
    community_comments: undefined,
    community_likes: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.content?.trim()) return NextResponse.json({ error: "Conteúdo obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Get or create community display name
  const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", user.id).maybeSingle();
  const ctx = (prefs?.context || {}) as Record<string, unknown>;
  let displayName = (ctx.community_name as string) || "";
  const displayEmoji = (ctx.community_emoji as string) || null;

  // Auto-generate unique anonymous name on first post
  if (!displayName || displayName === "Anônimo") {
    const rnd = Math.floor(1000 + Math.random() * 9000);
    displayName = `Anônimo${rnd}`;
    ctx.community_name = displayName;
    await admin.from("user_preferences").upsert({
      user_id: user.id,
      context: ctx,
      enabled_questions: (prefs?.enabled_questions as any) || [],
      onboarding_completed: (prefs as any)?.onboarding_completed ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  const { data, error } = await admin.from("community_posts").insert({
    user_id: user.id,
    display_name: displayName,
    display_emoji: displayEmoji,
    category: body.category || "reflexao",
    content: body.content.trim(),
    photo: body.photo || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, comment_count: 0, like_count: 0, liked_by_me: false }, { status: 201 });
}
