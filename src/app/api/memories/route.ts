import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("user_memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/memories error:", error);
    return NextResponse.json({ error: "Erro ao buscar memórias", detail: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fact } = body;

    if (!fact || fact.trim().length < 3) {
      return NextResponse.json({ error: "Fato muito curto" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Avoid exact duplicates
    const { data: existing } = await admin
      .from("user_memories")
      .select("id")
      .eq("user_id", user.id)
      .eq("fact", fact.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ skipped: true });
    }

    const { data, error } = await admin
      .from("user_memories")
      .insert({ user_id: user.id, fact: fact.trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/memories error:", error);
    return NextResponse.json({ error: "Erro ao salvar memória", detail: String(error) }, { status: 500 });
  }
}
