import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: "post_id obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  await admin.from("community_reports").insert({ post_id, reported_by: user.id });
  return NextResponse.json({ ok: true });
}
