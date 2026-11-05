import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const CHAT_TYPE = "nutrition";

// GET — load nutrition chat messages
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");

  const admin = getSupabaseAdmin();
  let query = admin
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .eq("chat_type", CHAT_TYPE)
    .order("created_at", { ascending: false })
    .limit(200);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json(data || []);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

// POST — save a batch of new nutrition messages
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    chat_type: CHAT_TYPE,
  }));

  const { error } = await admin.from("chat_messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: rows.length });
}
