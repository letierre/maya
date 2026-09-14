"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MayaAvatar } from "@/components/MayaAvatar";
import { useTranslation } from "@/lib/useTranslation";
import { captureAttribution } from "@/lib/attribution";

const P  = "#7C5CFF";
const PL = "oklch(0.5 0.12 270 / .12)";
const PB = "1px solid oklch(0.5 0.12 270 / .15)";

const pageWrap: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 20px",
  background: "oklch(0.12 0.012 270)",
  fontFamily: "var(--font-sans)",
};

const cardStyle: React.CSSProperties = {
  background: "oklch(0.16 0.012 270 / .85)",
  backdropFilter: "blur(12px)",
  borderRadius: 24,
  border: PB,
  padding: "32px 28px",
  width: "100%",
  maxWidth: 420,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 11,
  border: PB,
  background: "oklch(0.14 0.012 270)",
  padding: "0 14px",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  color: "var(--foreground)",
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 13,
  border: 0,
  background: P,
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  transition: "opacity .15s",
};

function CadastroInner() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [stage, setStage]         = useState<"form" | "otp">("form");
  const [userId, setUserId]       = useState("");
  const [otp, setOtp]             = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]   = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const router   = useRouter();
  const params   = useSearchParams();
  const erroParam = params.get("erro");
  const { t, lang } = useTranslation();

  // Captura UTM/click caso o usuário chegue direto no /cadastro (sem passar na landing).
  useEffect(() => {
    captureAttribution();
  }, []);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, lang }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(
        json.error === "already_exists"
          ? t("otp_email_existe")
          : json.error === "rate_limited"
          ? t("otp_reenviar_aguarde")
          : json.error ?? t("lg_erro_generico")
      );
      setLoading(false);
      return;
    }

    setUserId(json.userId);
    setStage("otp");
    setLoading(false);
  };

  const doVerify = async (code: string) => {
    if (otpLoading || code.length !== 6) return;
    setOtpLoading(true);
    setOtpError("");

    const res = await fetch("/api/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });
    const json = await res.json();

    if (!res.ok) {
      setOtpError(
        json.error === "invalid_code"
          ? t("otp_invalido")
          : json.error === "expired" || json.error === "not_found"
          ? t("otp_expirado")
          : json.error === "too_many_attempts"
          ? t("otp_tentativas")
          : json.error ?? t("lg_erro_generico")
      );
      setOtp("");
      setOtpLoading(false);
      return;
    }

    // Email confirmado — auto-login e segue pro onboarding
    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setOtpError(loginError.message);
      setOtpLoading(false);
      return;
    }
    router.push("/onboarding");
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    doVerify(otp);
  };

  const handleResend = async () => {
    setResendMsg("");
    const res = await fetch("/api/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, lang }),
    });
    const json = await res.json();

    if (res.ok) {
      setResendMsg(t("otp_reenviado"));
    } else {
      setResendMsg(
        json.error === "wait" || json.error === "too_many_resends" || json.error === "rate_limited"
          ? t("otp_reenviar_aguarde")
          : json.error === "not_found"
          ? t("otp_expirado")
          : json.error ?? t("lg_erro_generico")
      );
    }
  };

  /* ── Tela de código OTP ───────────────────────────────────────── */
  if (stage === "otp") {
    return (
      <div style={pageWrap}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 18 }}>🔐</div>
          <h1 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>
            {t("otp_titulo")}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            {t("otp_subtitulo", { email })}
          </p>

          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("otp_placeholder")}
              value={otp}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(v);
                if (v.length === 6) doVerify(v);
              }}
              autoFocus
              style={{
                width: "100%",
                height: 60,
                borderRadius: 12,
                border: PB,
                background: "oklch(0.14 0.012 270)",
                color: "var(--foreground)",
                fontSize: 26,
                fontWeight: 700,
                textAlign: "center",
                letterSpacing: 12,
                fontFamily: "var(--font-sans)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {otpError && (
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .15 15)", background: "oklch(.55 .1 15 / .1)", padding: "10px 14px", borderRadius: 10 }}>
                {otpError}
              </p>
            )}

            <button type="submit" disabled={otpLoading || otp.length !== 6} style={{ ...btnPrimary, opacity: otpLoading || otp.length !== 6 ? 0.6 : 1 }}>
              {otpLoading ? t("otp_verificando") : t("otp_verificar")}
            </button>
          </form>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={handleResend}
              style={{
                background: "none", border: "none", borderRadius: 10,
                padding: "8px 14px", fontSize: 13.5, cursor: "pointer",
                color: P, fontWeight: 700, fontFamily: "var(--font-sans)",
              }}
            >
              {t("otp_reenviar")}
            </button>
            {resendMsg && (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted-foreground)" }}>{resendMsg}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setStage("form"); setOtp(""); setUserId(""); setOtpError(""); setResendMsg(""); }}
            style={{
              background: "none", border: PB, borderRadius: 10,
              padding: "9px 16px", fontSize: 13, cursor: "pointer",
              color: "var(--muted-foreground)", fontFamily: "var(--font-sans)",
              marginTop: 12,
            }}
          >
            {t("otp_errei_email")}
          </button>
        </div>
      </div>
    );
  }

  /* ── Formulário ───────────────────────────────────────────────── */
  return (
    <div style={pageWrap}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
            <MayaAvatar state="idle" size={56} />
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
            {t("cd_criar_conta_titulo")}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
            {t("cd_subtitulo")}
          </p>
        </div>

        {erroParam === "confirmacao" && (
          <div style={{
            background: "oklch(.55 .1 15 / .1)", border: "1px solid oklch(.55 .1 15 / .2)",
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            fontSize: 13, color: "oklch(.4 .1 15)", lineHeight: 1.5,
          }}>
            {t("cd_link_expirado")}
          </div>
        )}

        <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>
              {t("lg_email")}
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>
              {t("lg_senha")}
            </label>
            <input
              type="password"
              placeholder={t("cd_min_6")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .15 15)", background: "oklch(.55 .1 15 / .1)", padding: "10px 14px", borderRadius: 10 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? t("cd_criando") : t("cd_criar_conta_gratis")}
          </button>

          <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
            {t("cd_ja_tem_conta")}{" "}
            <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none" }}>
              {t("lg_entrar")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroInner />
    </Suspense>
  );
}
