import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/community/posts/[id] — who liked
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("community_likes").select("user_id").eq("post_id", id);

  // Get display names
  const userIds = (data || []).map(l => l.user_id);
  let names: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: prefs } = await admin.from("user_preferences").select("user_id, context").in("user_id", userIds);
    for (const p of prefs || []) {
      names[p.user_id] = (p.context as any)?.community_name || "Anônimo";
    }
  }

  return NextResponse.json({ likes: (data || []).map(l => ({ user_id: l.user_id, display_name: names[l.user_id] || "Anônimo" })) });
}

// DELETE /api/community/posts/[id] — delete own post
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("community_posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/community/posts/[id] — toggle like OR edit content
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Edit content
  if (body.content !== undefined) {
    const { error } = await admin.from("community_posts").update({ content: body.content, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Toggle like
  const { data: existing } = await admin.from("community_likes").select("id").eq("post_id", id).eq("user_id", user.id).maybeSingle();
  if (existing) {
    await admin.from("community_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  } else {
    await admin.from("community_likes").insert({ post_id: id, user_id: user.id });
    return NextResponse.json({ liked: true });
  }
}
