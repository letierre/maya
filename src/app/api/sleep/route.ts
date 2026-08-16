import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLocalDate } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import type { SleepSource } from "@/types";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const admin = getSupabaseAdmin();
  let query = admin
    .from("sleep_logs")
    .select("*")
    .eq("user_id", session.user.id)
    .order("date", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  const date: string = body.date ?? getLocalDate();
  const source: SleepSource = body.source ?? "checkin";

  const row = {
    user_id: session.user.id,
    date,
    sleep_start: body.sleep_start ?? null,
    sleep_end: body.sleep_end ?? null,
    duration_min: body.duration_min ?? null,
    quality: body.quality ?? null,
    interruptions: body.interruptions ?? 0,
    had_dreams: body.had_dreams ?? null,
    notes: body.notes ?? null,
    source,
    raw_data: body.raw_data ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from("sleep_logs")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("date", date)
    .eq("source", source)
    .limit(1)
    .single();

	  let result;
	  if (existing) {
	    const { data, error } = await admin
	      .from("sleep_logs")
	      .update(row)
	      .eq("id", existing.id)
	      .select()
	      .single();
	    if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
	    result = data;
	  } else {
	    const { data, error } = await admin
	      .from("sleep_logs")
	      .insert(row)
	      .select()
	      .single();
	    if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
	    result = data;
	  }

	  // Sync check-in slept_well from sleep quality
	  if (body.quality != null) {
	    const sleptWell = body.quality >= 3;
	    const { data: existingCi } = await admin
	      .from("check_ins")
	      .select("id")
	      .eq("user_id", session.user.id)
	      .eq("date", date)
	      .maybeSingle();
	    if (existingCi) {
	      await admin.from("check_ins").update({ slept_well: sleptWell, updated_at: new Date().toISOString() }).eq("id", existingCi.id);
	    }
	  }

	  return NextResponse.json(result, { status: existing ? 200 : 201 });
	}
