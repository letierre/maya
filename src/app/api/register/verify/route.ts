import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";

const verifyLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const body = await req.json();
    const userId = body.userId;
    const code = body.code;

    if (!userId || !code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (!verifyLimiter(ip)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const admin = getSupabaseAdmin();
    const { data: row } = await admin
      .from("email_verification_codes")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if ((row.attempts ?? 0) >= 5) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }

    const computed = crypto.createHash("sha256").update(row.salt + code).digest("hex");
    const a = Buffer.from(row.code_hash);
    const b = Buffer.from(computed);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!match) {
      await admin
        .from("email_verification_codes")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("user_id", userId);
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    await admin.from("email_verification_codes").delete().eq("user_id", userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/register/verify error:", error);
    return NextResponse.json(
      { error: "Erro ao verificar código", detail: String(error) },
      { status: 500 }
    );
  }
}
