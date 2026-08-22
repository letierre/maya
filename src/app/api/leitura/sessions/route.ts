import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Marca "leu" no check-in do dia (só se a linha já existir — igual à corrida)
async function markReadCheckIn(admin: any, userId: string, date: string) {
  const { data: existingCi } = await admin
    .from("check_ins")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (existingCi) {
    await admin
      .from("check_ins")
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq("id", existingCi.id);
  }
}

// GET /api/leitura/sessions — listar sessões (opcional ?from=YYYY-MM-DD&to=YYYY-MM-DD)
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const admin = getSupabaseAdmin();

    let query = admin
      .from("reading_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/leitura/sessions error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar sessões", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/leitura/sessions — registrar sessão de leitura
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    const pagesRead = Math.max(0, Number(body.pages_read) || 0);
    const minutesRead = Math.max(0, Number(body.minutes_read) || 0);

    if (pagesRead === 0 && minutesRead === 0) {
      return NextResponse.json(
        { error: "Informe páginas ou minutos lidos" },
        { status: 400 }
      );
    }
    if (!body.date) {
      return NextResponse.json({ error: "Data obrigatória" }, { status: 400 });
    }

    // Resolve o título do livro (snapshot) a partir do book_id, se fornecido
    let bookTitle = body.book_title?.trim() || null;
    if (!bookTitle && body.book_id) {
      const { data: book } = await admin
        .from("reading_books")
        .select("title")
        .eq("id", body.book_id)
        .eq("user_id", user.id)
        .single();
      bookTitle = book?.title || "Livro";
    }
    if (!bookTitle) bookTitle = "Leitura";

    const { data, error } = await admin
      .from("reading_sessions")
      .insert({
        user_id: user.id,
        book_id: body.book_id || null,
        book_title: bookTitle,
        date: body.date,
        pages_read: pagesRead,
        minutes_read: minutesRead,
      })
      .select()
      .single();

    if (error) throw error;

    // Atualiza o progresso do livro (página atual) e inicia leitura se necessário
    if (body.book_id && pagesRead > 0) {
      const { data: book } = await admin
        .from("reading_books")
        .select("current_page, total_pages, status, started_at")
        .eq("id", body.book_id)
        .eq("user_id", user.id)
        .single();

      if (book) {
        let nextPage = book.current_page + pagesRead;
        if (book.total_pages && nextPage > book.total_pages) {
          nextPage = book.total_pages;
        }
        const bookUpdates: Record<string, unknown> = {
          current_page: nextPage,
          updated_at: new Date().toISOString(),
        };
        if (book.status === "quero_ler") {
          bookUpdates.status = "lendo";
          bookUpdates.started_at = new Date().toISOString();
        }
        await admin.from("reading_books").update(bookUpdates).eq("id", body.book_id);
      }
    }

    // Marca "leu" no check-in do dia (só se a linha já existir)
    await markReadCheckIn(admin, user.id, body.date);

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/leitura/sessions error:", error);
    return NextResponse.json(
      { error: "Erro ao registrar sessão", detail: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/leitura/sessions?id=UUID
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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

    // Busca a data antes de excluir, para desmarcar o check-in do dia
    const { data: existing } = await admin
      .from("reading_sessions")
      .select("date")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const { error } = await admin
      .from("reading_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    // Se era a última leitura do dia, desmarca "leu" do check-in
    if (existing?.date) {
      const { data: remaining } = await admin
        .from("reading_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", existing.date);

      if (remaining && remaining.length === 0) {
        const { data: ci } = await admin
          .from("check_ins")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", existing.date)
          .maybeSingle();

        if (ci) {
          await admin
            .from("check_ins")
            .update({ read: false, updated_at: new Date().toISOString() })
            .eq("id", ci.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/leitura/sessions error:", error);
    return NextResponse.json(
      { error: "Erro ao remover sessão", detail: String(error) },
      { status: 500 }
    );
  }
}
