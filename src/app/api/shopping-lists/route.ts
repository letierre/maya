import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/shopping-lists — listas do usuário, ordenadas por posição
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("shopping_lists")
      .select("*")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/shopping-lists error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar listas", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/shopping-lists — cria lista
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nome da lista obrigatório" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: maxRow } = await admin
      .from("shopping_lists")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;

    const { data, error } = await admin
      .from("shopping_lists")
      .insert({
        user_id: user.id,
        name,
        emoji: body.emoji || "🛒",
        position: nextPosition,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/shopping-lists error:", error);
    return NextResponse.json(
      { error: "Erro ao criar lista", detail: String(error) },
      { status: 500 }
    );
  }
}
