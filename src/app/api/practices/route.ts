import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";

/**
 * POST /api/practices — registra uma sessão concluída e marca o hábito do dia
 * no check-in (meditation/breathing). A marcação é um update parcial (só se a
 * linha do dia já existir — igual a corrida/leitura); o check-in completo é a
 * fonte de verdade e re-deriva esses flags a partir de practice_sessions.
 *
 * Body: { kind: "meditation"|"breathing", pattern?: string, duration_seconds?: number, date?: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const kind = body.kind === "breathing" ? "breathing" : body.kind === "visualization" ? "visualization" : "meditation";
    const pattern = body.pattern ? String(body.pattern) : null;
    const duration = Number(body.duration_seconds) || 0;
    const date = String(body.date || getLocalDate());

    const admin = getSupabaseAdmin();

    // 1) Registra a sessão (fonte de verdade p/ o check-in auto-detectar).
    const { data: sessionRow, error: sessionErr } = await admin
      .from("practice_sessions")
      .insert({ user_id: user.id, kind, pattern, date, duration_seconds: duration })
      .select()
      .single();
    if (sessionErr) throw sessionErr;

    // 2) Marca o hábito no check-in do dia (update parcial — não cria linha,
    //    preservando os demais hábitos e o fluxo do ritual).
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (kind === "meditation") {
      patch.meditation = true;
      patch.meditation_prayer_breathing = true;
    } else if (kind === "breathing") {
      patch.breathing = true;
      patch.meditation_prayer_breathing = true;
    } else {
      // Visualização é hábito distinto — não mexe no agregado legado de pausa.
      patch.visualization = true;
    }

    const { data: existingCi } = await admin
      .from("check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();

    if (existingCi?.id) {
      const { error: ciErr } = await admin
        .from("check_ins")
        .update(patch)
        .eq("id", existingCi.id);
      if (ciErr) throw ciErr;
    }

    return NextResponse.json({ session: sessionRow, marked: !!existingCi?.id });
  } catch (err) {
    console.error("POST /api/practices error:", err);
    return NextResponse.json(
      { error: "Erro ao registrar prática", detail: String(err) },
      { status: 500 }
    );
  }
}
