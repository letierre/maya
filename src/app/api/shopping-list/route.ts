import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

type Admin = ReturnType<typeof getSupabaseAdmin>;

// Resolve a lista de destino: usa o id explícito; senão a primeira lista do usuário;
// se não houver nenhuma, cria a lista padrão "Mercado".
async function resolveListId(admin: Admin, userId: string, explicit?: string): Promise<string | null> {
  if (explicit) return explicit;

  const { data: first } = await admin
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (first?.id) return first.id;

  const { data: created, error } = await admin
    .from("shopping_lists")
    .insert({ user_id: userId, name: "Mercado", emoji: "🛒", position: 0 })
    .select()
    .single();

  if (error || !created) return null;
  return created.id;
}

function parsePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/shopping-list?listId=UUID  (sem listId = todos os itens do usuário)
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get("listId") || "";

    const admin = getSupabaseAdmin();
    let query = admin
      .from("shopping_items")
      .select("*")
      .eq("user_id", user.id);

    if (listId) query = query.eq("list_id", listId);

    query = query
      .order("priority", { ascending: false })
      .order("checked", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/shopping-list error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar lista", detail: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/shopping-list — single item ou bulk array
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

    const listId = await resolveListId(admin, user.id, body.list_id);
    if (!listId) {
      return NextResponse.json({ error: "Não foi possível resolver a lista" }, { status: 500 });
    }

    // Posição do próximo item (max + 1) dentro da lista
    const { data: maxRow } = await admin
      .from("shopping_items")
      .select("position")
      .eq("user_id", user.id)
      .eq("list_id", listId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;

    // Bulk insert: { list_id?, items: [{ item_name, category?, quantity?, note?, estimated_price?, priority? }] }
    if (body.items && Array.isArray(body.items)) {
      const rows = body.items.map((it: Record<string, unknown>, i: number) => ({
        user_id: user.id,
        list_id: listId,
        item_name: (it.item_name as string) || "",
        category: (it.category as string) || "geral",
        quantity: (it.quantity as string) || null,
        note: (it.note as string) || null,
        estimated_price: parsePrice(it.estimated_price),
        priority: Boolean(it.priority),
        position: nextPosition + i,
      })).filter((r: { item_name: string }) => r.item_name.trim().length > 0);

      if (rows.length === 0) {
        return NextResponse.json({ error: "Nenhum item válido" }, { status: 400 });
      }

      const { data, error } = await admin
        .from("shopping_items")
        .insert(rows)
        .select();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    // Single insert: { list_id?, item_name, category?, quantity?, note?, estimated_price?, priority? }
    if (!body.item_name || !String(body.item_name).trim()) {
      return NextResponse.json({ error: "Nome do item obrigatório" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("shopping_items")
      .insert({
        user_id: user.id,
        list_id: listId,
        item_name: String(body.item_name).trim(),
        category: body.category || "geral",
        quantity: body.quantity || null,
        note: body.note || null,
        estimated_price: parsePrice(body.estimated_price),
        priority: Boolean(body.priority),
        position: nextPosition,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/shopping-list error:", error);
    return NextResponse.json(
      { error: "Erro ao adicionar item", detail: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/shopping-list — partial update OU batch reorder
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();

    // Batch reorder: { reorder: [{ id, position }] }
    if (body.reorder && Array.isArray(body.reorder)) {
      let count = 0;
      for (const item of body.reorder) {
        if (!item.id) continue;
        const { error } = await admin
          .from("shopping_items")
          .update({ position: item.position, updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("user_id", user.id);
        if (!error) count++;
      }
      return NextResponse.json({ success: true, count });
    }

    // Single item update
    if (!body.id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.item_name !== undefined) updates.item_name = body.item_name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.quantity !== undefined) updates.quantity = body.quantity || null;
    if (body.note !== undefined) updates.note = body.note || null;
    if (body.estimated_price !== undefined) updates.estimated_price = parsePrice(body.estimated_price);
    if (body.priority !== undefined) updates.priority = Boolean(body.priority);
    if (body.checked !== undefined) updates.checked = body.checked;
    if (body.position !== undefined) updates.position = body.position;
    if (body.list_id !== undefined) updates.list_id = body.list_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from("shopping_items")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/shopping-list error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar item", detail: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/shopping-list?id=UUID  OU  ?clearChecked=true&listId=UUID
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const admin = getSupabaseAdmin();

    // Clear all checked items (opcionalmente dentro de uma lista)
    if (searchParams.get("clearChecked") === "true") {
      let query = admin.from("shopping_items").delete().eq("user_id", user.id).eq("checked", true);
      const listId = searchParams.get("listId");
      if (listId) query = query.eq("list_id", listId);
      const { error } = await query;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Delete single item
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    const { error } = await admin
      .from("shopping_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shopping-list error:", error);
    return NextResponse.json(
      { error: "Erro ao remover item", detail: String(error) },
      { status: 500 }
    );
  }
}
