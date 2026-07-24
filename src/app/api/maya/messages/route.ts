import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET — load user's chat messages
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}

// POST — save a batch of new messages
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const messages = body.messages as Array<{ role: string; content: string }> | undefined;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array obrigatório" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const rows = messages.map((m) => ({
    user_id: user.id,
    role: m.role,
    content: m.content,
  }));

  const { error } = await admin.from("chat_messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: rows.length });
}
