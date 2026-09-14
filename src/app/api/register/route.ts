import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendVerificationCodeEmail } from "@/lib/email";
import { createRateLimiter } from "@/lib/rate-limit";

const registerLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 5 });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  try {
    const body = await req.json();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const lang = body.lang;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }
    if (!registerLimiter(ip) || !registerLimiter(`email:${email}`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const admin = getSupabaseAdmin();

    // Cria o usuário NÃO-confirmado sem disparar o email do Supabase
    // (só o signUp/invite enviam email; o createUser do Admin API não envia).
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json({ error: "already_exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
    }
    const userId = data.user.id;

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = crypto.randomBytes(16).toString("hex");
    const codeHash = crypto.createHash("sha256").update(salt + code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    await admin.from("email_verification_codes").upsert({
      user_id: userId,
      email,
      code_hash: codeHash,
      salt,
      expires_at: expiresAt,
      attempts: 0,
      resend_count: 0,
      last_sent_at: new Date().toISOString(),
    });

    await sendVerificationCodeEmail({ to: email, code, lang });

    return NextResponse.json({ userId });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta", detail: String(error) },
      { status: 500 }
    );
  }
}
