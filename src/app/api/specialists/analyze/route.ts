import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeAllSpecialists } from "@/lib/specialists";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const insights = await analyzeAllSpecialists(user.id);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error("POST /api/specialists/analyze error:", error);
    return NextResponse.json(
      { error: "Erro ao analisar", detail: String(error) },
      { status: 500 }
    );
  }
}
