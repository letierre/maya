import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

interface PassiveEvent {
  type: "battery_sleep" | "battery_wake" | "visibility_sleep" | "visibility_wake";
  timestamp: string;
  batteryLevel?: number;
  chargingState?: boolean;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body: { events: PassiveEvent[]; estimatedSleepStart?: string; estimatedWake?: string; durationMin?: number } = await req.json();

  if (!body.events?.length) return NextResponse.json({ ok: true });

  const admin = getSupabaseAdmin();

  // Derive date from wake event (or today)
  const wakeEvent = body.events.find((e) => e.type === "battery_wake" || e.type === "visibility_wake");
  const wakeTs = wakeEvent ? new Date(wakeEvent.timestamp) : new Date();
  const date = wakeTs.toISOString().slice(0, 10);

  const sleepStart = body.estimatedSleepStart ?? body.events.find((e) =>
    e.type === "battery_sleep" || e.type === "visibility_sleep"
  )?.timestamp ?? null;

  const sleepEnd = body.estimatedWake ?? wakeEvent?.timestamp ?? null;

  const durationMin = body.durationMin ?? (sleepStart && sleepEnd
    ? Math.round((new Date(sleepEnd).getTime() - new Date(sleepStart).getTime()) / 60000)
    : null);

  const source = body.events.some((e) => e.type.startsWith("battery")) ? "battery" : "visibility";

  // Only save if duration is plausible (2h–14h)
  if (durationMin !== null && (durationMin < 120 || durationMin > 840)) {
    return NextResponse.json({ ok: true, skipped: "implausible_duration" });
  }

  const row = {
    user_id: user.id,
    date,
    sleep_start: sleepStart,
    sleep_end: sleepEnd,
    duration_min: durationMin,
    quality: null,  // passive source: no quality data
    source,
    raw_data: { events: body.events },
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from("sleep_logs")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("source", source)
    .limit(1)
    .single();

  if (existing) {
    await admin.from("sleep_logs").update(row).eq("id", existing.id);
  } else {
    await admin.from("sleep_logs").insert(row);
  }

  return NextResponse.json({ ok: true });
}
