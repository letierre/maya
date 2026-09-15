import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// POST /api/track — registra um pageview do usuário logado (fire-and-forget).
// Nunca falha a navegação: qualquer erro (tabela ainda não migrada, etc.) é engolido.
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return new NextResponse(null, { status: 204 });

    const body = await req.json().catch(() => ({}));
    const module = typeof body?.module === "string" ? body.module.slice(0, 64) : "";
    if (!module) return new NextResponse(null, { status: 204 });

    const admin = getSupabaseAdmin();
    await admin.from("app_events").insert({
      user_id: session.user.id,
      event_name: "pageview",
      module,
      path: typeof body?.path === "string" ? body.path.slice(0, 256) : null,
    });
  } catch {
    /* silencioso por design — telemetria não deve derrubar o app */
  }
  return new NextResponse(null, { status: 204 });
}
