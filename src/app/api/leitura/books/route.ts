import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/leitura/books — listar livros do usuário
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const admin = getSupabaseAdmin();

    let query = admin
      .from("reading_books")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/leitura/books error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar livros", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/leitura/books — adicionar livro
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("reading_books")
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        author: body.author?.trim() || null,
        emoji: body.emoji || "📖",
        genre: body.genre?.trim() || null,
        total_pages: body.total_pages ? Number(body.total_pages) : null,
        current_page: body.current_page ? Number(body.current_page) : 0,
        status: body.status || "quero_ler",
        notes: body.notes?.trim() || null,
        started_at: body.status === "lendo" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/leitura/books error:", error);
    return NextResponse.json(
      { error: "Erro ao adicionar livro", detail: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/leitura/books — atualizar livro
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    if (!body.id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.author !== undefined) updates.author = body.author?.trim() || null;
    if (body.emoji !== undefined) updates.emoji = body.emoji || "📖";
    if (body.genre !== undefined) updates.genre = body.genre?.trim() || null;
    if (body.total_pages !== undefined) updates.total_pages = body.total_pages ? Number(body.total_pages) : null;
    if (body.current_page !== undefined) updates.current_page = Math.max(0, Number(body.current_page) || 0);
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "lendo" && !body.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (body.status === "concluido") {
        updates.completed_at = new Date().toISOString();
        // concluir livro => página atual = total (se informado)
        if (body.total_pages) updates.current_page = Number(body.total_pages);
      }
      if (body.status === "quero_ler") {
        updates.started_at = null;
        updates.completed_at = null;
      }
    }

    const { data, error } = await admin
      .from("reading_books")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/leitura/books error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar livro", detail: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/leitura/books?id=UUID
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("reading_books")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/leitura/books error:", error);
    return NextResponse.json(
      { error: "Erro ao remover livro", detail: String(error) },
      { status: 500 }
    );
  }
}
