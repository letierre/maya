import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const today = getLocalDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().split("T")[0];

  const { data } = await admin
    .from("specialist_insights")
    .select("patterns,concerns,strengths,summary,date")
    .eq("user_id", user.id)
    .eq("specialist", "sleep")
    .in("date", [today, yd])
    .order("date", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    return NextResponse.json(null);
  }

  return NextResponse.json(data[0]);
}
