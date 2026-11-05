import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { userId } = await params;
  const admin = getSupabaseAdmin();

  // Get user display preferences
  const { data: prefs } = await admin.from("user_preferences").select("context").eq("user_id", userId).maybeSingle();
  const ctx = (prefs?.context || {}) as Record<string, unknown>;

  // Get user posts
  const { data: posts } = await admin.from("community_posts").select(`
    *,
    community_comments(count),
    community_likes(count)
  `).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);

  const result = (posts || []).map(p => ({
    ...p,
    comment_count: p.community_comments?.[0]?.count ?? 0,
    like_count: p.community_likes?.[0]?.count ?? 0,
    community_comments: undefined,
    community_likes: undefined,
  }));

  return NextResponse.json({
    display_name: (ctx.community_name as string) || "Anônimo",
    display_emoji: (ctx.community_emoji as string) || null,
    posts: result,
  });
}
