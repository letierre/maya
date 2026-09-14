import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendVerificationCodeEmail } from "@/lib/email";
import { createRateLimiter } from "@/lib/rate-limit";

const resendLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 3 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const body = await req.json();
    const userId = body.userId;
    const lang = body.lang;

    if (!userId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (!resendLimiter(ip)) {
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

    if (Date.now() - new Date(row.last_sent_at).getTime() < 60_000) {
      return NextResponse.json({ error: "wait" }, { status: 429 });
    }
    if ((row.resend_count ?? 0) >= 3) {
      return NextResponse.json({ error: "too_many_resends" }, { status: 429 });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = crypto.randomBytes(16).toString("hex");
    const codeHash = crypto.createHash("sha256").update(salt + code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    await admin
      .from("email_verification_codes")
      .update({
        code_hash: codeHash,
        salt,
        expires_at: expiresAt,
        attempts: 0,
        resend_count: (row.resend_count ?? 0) + 1,
        last_sent_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await sendVerificationCodeEmail({ to: row.email, code, lang });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/register/resend error:", error);
    return NextResponse.json(
      { error: "Erro ao reenviar código", detail: String(error) },
      { status: 500 }
    );
  }
}
