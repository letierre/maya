import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/admin/posts/[id] — apaga qualquer post (admin only).
// Diferente da rota pública /api/community/posts/[id] (que só apaga o próprio
// post), aqui o admin apaga o post denunciado de qualquer usuário. As tabelas
// de comentários/likes/denúncias têm ON DELETE CASCADE (migrations 019/020/022),
// então a limpeza é automática.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: role } = await admin.from("user_roles").select("is_admin").eq("user_id", session.user.id).maybeSingle();
  if (!role?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const { error } = await admin.from("community_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
