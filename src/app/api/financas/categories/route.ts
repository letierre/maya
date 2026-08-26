import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: cats, error } = await admin
    .from("user_categories")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also return hidden IDs from preferences
  const { data: prefs, error: prefsErr } = await admin
    .from("user_preferences")
    .select("context")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const ctx = prefsErr ? {} : (prefs?.context ?? {});

  const hiddenFinCats: string[] = ctx.hidden_fin_cats ?? [];
  const hiddenFinSubcats: Record<string, string[]> = ctx.hidden_fin_subcats ?? {};
  const customFinSubcats: Record<string, string[]> = ctx.custom_fin_subcats ?? {};

  return NextResponse.json({ categories: cats ?? [], hiddenFinCats, hiddenFinSubcats, customFinSubcats });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { type, name, emoji, hue, subcats } = body;

  if (!type || !name) {
    return NextResponse.json({ error: "Tipo e nome são obrigatórios" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("user_categories")
    .insert({
      user_id: session.user.id,
      type,
      name,
      emoji: emoji || "⭐",
      hue: hue ?? 270,
      subcats: subcats ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
