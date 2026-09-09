import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const TRIAL_DAYS = 7;

// POST /api/subscription/trial — inicia o trial local (sem cartão).
// Só cria a linha se o usuário ainda não tiver assinatura (não reativa quem cancelou/expirou).
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id, status, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Já existe qualquer linha → não sobrescreve (não dá trial novo pra quem já teve).
  if (existing) {
    return NextResponse.json({ started: false, alreadyExists: true });
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan: "monthly",
      status: "trialing",
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/subscription/trial error:", error);
    return NextResponse.json({ error: "Erro ao iniciar trial" }, { status: 500 });
  }

  return NextResponse.json({ started: true, trialEndsAt: data.trial_ends_at });
}
