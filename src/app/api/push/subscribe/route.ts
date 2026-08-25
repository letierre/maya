import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const sub = await req.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const row = {
    user_id: session.user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  };
  const timezone = typeof sub.timezone === "string" && sub.timezone ? sub.timezone : null;
  // Persist timezone when the column exists; fall back gracefully before migration 041.
  const { error } = await admin.from("push_subscriptions").upsert(
    { ...row, timezone },
    { onConflict: "user_id,endpoint" },
  );
  if (error) {
    await admin.from("push_subscriptions").upsert(row, { onConflict: "user_id,endpoint" });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 });

  const admin = getSupabaseAdmin();
  await admin.from("push_subscriptions")
    .delete()
    .eq("user_id", session.user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
