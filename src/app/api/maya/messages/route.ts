import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET — load user's chat messages
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // cursor: load messages older than this

  const admin = getSupabaseAdmin();
  let query = admin
    .from("chat_messages")
    .select("id, role, content, image_urls, audio_url, audio_duration, created_at")
    .eq("user_id", user.id)
    .or("chat_type.is.null,chat_type.eq.maya")
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

// POST — save a batch of new messages
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const messages = body.messages as Array<{ role: string; content: string; image_urls?: string[]; client_id?: string }> | undefined;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array obrigatório" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // ── Só mensagens do usuário ──
  // As respostas da Maya são persistidas SERVER-SIDE (/api/maya, /api/maya/voice,
  // /api/maya/nudge). Ignorar "assistant" aqui protege contra clientes antigos
  // (PWA em cache) que ainda tentavam salvar a resposta em partes — a causa da
  // duplicação de mensagens. O cliente nunca deve gravar mensagens da Maya.
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    return NextResponse.json({ saved: 0 });
  }

  const rows = userMessages.map((m) => ({
    user_id: user.id,
    role: "user",
    content: m.content,
    image_urls: m.image_urls || [],
    chat_type: "maya",
    // client_id torna o envio idempotente: um retry de rede reenvia a MESMA
    // chave e o upsert abaixo ignora a linha repetida em vez de duplicar.
    ...(m.client_id ? { client_id: m.client_id } : {}),
  }));

  const { error } = await admin.from("chat_messages").upsert(rows, {
    onConflict: "user_id,client_id",
    ignoreDuplicates: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // NÃO invalida mais o cache da home aqui. A fala da home agora é estável: o
  // GET /api/maya/home-message compara a conversa recente com a fala atual e só
  // regenera quando há CONTRADIÇÃO real (a mesma Maya do chat é a da home).
  return NextResponse.json({ saved: rows.length });
}
