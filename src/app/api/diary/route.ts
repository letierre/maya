import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const id = searchParams.get("id");
  const limit = searchParams.get("limit");

  try {
    const admin = getSupabaseAdmin();

    if (id) {
      const { data, error } = await admin
        .from("diary_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return NextResponse.json(data || null);
    }

    if (date) {
      const { data, error } = await admin
        .from("diary_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    let query = admin
      .from("diary_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    // Suporta ?limit=N (ex.: preview da home busca só o último registro).
    const limitNum = limit ? parseInt(limit, 10) : NaN;
    if (Number.isFinite(limitNum) && limitNum > 0) {
      query = query.limit(limitNum);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/diary error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar entradas do diário", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const today = getLocalDate();

    const row = {
      user_id: user.id,
      date: body.date || today,
      title: body.title ?? "",
      content: body.content ?? "",
      mood: body.mood ?? null,
      photos: body.photos ?? [],
    };

    const admin = getSupabaseAdmin();

    if (body.id) {
      const { data: updated, error } = await admin
        .from("diary_entries")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(updated);
    }

    const { data: created, error } = await admin
      .from("diary_entries")
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/diary error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar entrada do diário", detail: String(error) },
      { status: 500 }
    );
  }
}
