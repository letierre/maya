import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncCheckInField } from "@/lib/checkin-sync";
import { ateWellFromMeals } from "@/lib/meal-utils";
import { analyzeAllSpecialists } from "@/lib/specialists";
import { getLocalDate, getTimezoneOffset } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const id = searchParams.get("id");

    const admin = getSupabaseAdmin();

    if (id) {
      const { data, error } = await admin
        .from("meals")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    if (date) {
      // Refeições de uma data específica — respeita o fuso horário do usuário
      const tz = searchParams.get("tz") || "America/Sao_Paulo";
      const offset = getTimezoneOffset(tz, date);
      const startOfDay = `${date}T00:00:00${offset}`;
      const endOfDay = `${date}T23:59:59${offset}`;

      const { data, error } = await admin
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .gte("data_hora", startOfDay)
        .lte("data_hora", endOfDay)
        .order("data_hora", { ascending: false });

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      // Refeições de um período — respeita o fuso horário do usuário
      const tz = searchParams.get("tz") || "America/Sao_Paulo";
      let query = admin
        .from("meals")
        .select("*")
        .eq("user_id", user.id);
      if (from) query = query.gte("data_hora", `${from}T00:00:00${getTimezoneOffset(tz, from)}`);
      if (to) query = query.lte("data_hora", `${to}T23:59:59${getTimezoneOffset(tz, to)}`);
      query = query.order("data_hora", { ascending: false }).limit(500);

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Favorited meals
    const favorited = searchParams.get("favorited");
    if (favorited === "true") {
      const { data, error } = await admin
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("favorited", true)
        .order("data_hora", { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    const { data, error } = await admin
      .from("meals")
      .select("*")
      .eq("user_id", user.id)
      .order("data_hora", { ascending: false })
      .limit(30);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/meals error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar refeições", detail: String(error) },
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
    const admin = getSupabaseAdmin();

    const isUpdate = !!body.id;

    if (isUpdate) {
      // ── UPDATE: only update fields explicitly provided ──────
      const row: Record<string, unknown> = {};
      if (body.tipo_refeicao !== undefined) row.tipo_refeicao = body.tipo_refeicao;
      if (body.foto_path !== undefined) row.foto_path = body.foto_path;
      if (body.fotos !== undefined) row.fotos = body.fotos;
      if (body.itens !== undefined) row.itens = body.itens;
      if (body.macros !== undefined) row.macros = body.macros;
      if (body.classificacao !== undefined) row.classificacao = body.classificacao;
      if (body.observacao !== undefined) row.observacao = body.observacao;
      if (body.texto_livre !== undefined) row.texto_livre = body.texto_livre;
      if (body.status_analise !== undefined) row.status_analise = body.status_analise;
      if (body.favorited !== undefined) row.favorited = body.favorited;
      if (body.data_hora !== undefined) row.data_hora = body.data_hora;

      const { data: updated, error } = await admin
        .from("meals")
        .update(row)
        .eq("id", body.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      // Auto-sync ate_well + refresh specialists
      syncAteWell(admin, user.id).catch(() => {});
      analyzeAllSpecialists(user.id).catch(() => {});
      return NextResponse.json(updated);
    }

    // ── INSERT: full row with defaults ────────────────────────
    const row: Record<string, unknown> = {
      user_id: user.id,
      tipo_refeicao: body.tipo_refeicao || "almoco",
      foto_path: body.foto_path ?? null,
      fotos: body.fotos ?? [],
      itens: body.itens ?? [],
      macros: body.macros ?? null,
      classificacao: body.classificacao ?? null,
      observacao: body.observacao ?? "",
      texto_livre: body.texto_livre ?? "",
      status_analise: body.status_analise ?? "pendente",
      favorited: body.favorited ?? false,
      data_hora: body.data_hora || new Date().toISOString(),
    };

    const { data: created, error: insertError } = await admin
      .from("meals")
      .insert(row)
      .select()
      .single();

    if (insertError) throw insertError;
    // Auto-sync ate_well + refresh specialists
    syncAteWell(admin, user.id).catch(() => {});
    analyzeAllSpecialists(user.id).catch(() => {});
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/meals error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar refeição", detail: String(error) },
      { status: 500 }
    );
  }
}

/** Recalcula ate_well das refeições de hoje e sincroniza o check-in */
async function syncAteWell(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  tz?: string
) {
  const today = getLocalDate(tz);
  const offset = getTimezoneOffset(tz || "America/Sao_Paulo", today);
  const startOfDay = `${today}T00:00:00${offset}`;
  const endOfDay = `${today}T23:59:59${offset}`;

  const { data: meals } = await admin
    .from("meals")
    .select("macros, status_analise, classificacao")
    .eq("user_id", userId)
    .gte("data_hora", startOfDay)
    .lte("data_hora", endOfDay);

  const ateWell = ateWellFromMeals((meals ?? []) as any[]);
  await syncCheckInField(userId, today, "ate_well", ateWell);
}

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
    const { error } = await admin
      .from("meals")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/meals error:", error);
    return NextResponse.json(
      { error: "Erro ao deletar refeição", detail: String(error) },
      { status: 500 }
    );
  }
}
