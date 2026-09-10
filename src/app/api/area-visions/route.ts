import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const VALID_AREAS = [
  "saude", "carreira", "financas", "relacionamentos",
  "desenvolvimento", "familia", "lazer", "espiritualidade",
];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("area_visions")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}

// POST — cria uma nova visão (múltiplas visões por área são permitidas).
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { area, statement } = body;

  if (!area || typeof area !== "string" || !VALID_AREAS.includes(area)) {
    return NextResponse.json(
      { error: `Área inválida. Use uma das 8 áreas: ${VALID_AREAS.join(", ")}` },
      { status: 400 },
    );
  }

  if (typeof statement !== "string" || statement.trim().length === 0) {
    return NextResponse.json({ error: "statement é obrigatório (string não vazia)" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("area_visions")
    .insert({ user_id: session.user.id, area, statement: statement.trim() })
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/area-visions?id=... — remove uma visão específica.
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("area_visions")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
