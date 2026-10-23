"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MayaAvatar } from "@/components/MayaAvatar";
import { useTranslation } from "@/lib/useTranslation";

const P = "#7C5CFF";
const PB = "1px solid oklch(0.5 0.12 270 / .15)";

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

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/nova-senha`,
      });
      if (err) {
        setError(t("fp_erro"));
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || t("fp_erro"));
      setLoading(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
          <MayaAvatar state="idle" size={56} />
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
          {t("fp_titulo")}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
          {t("fp_subtitulo")}
        </p>
      </div>

      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            {t("fp_sucesso")}
          </p>
          <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            {t("fp_voltar")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .15 15)", background: "oklch(.55 .1 15 / .1)", padding: "10px 14px", borderRadius: 10 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {t("fp_enviar")}
          </button>

          <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
            <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none" }}>
              {t("fp_voltar")}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      background: "oklch(0.12 0.012 270)",
      fontFamily: "var(--font-sans)",
    }}>
      <ForgotPasswordForm />
    </div>
  );
}
