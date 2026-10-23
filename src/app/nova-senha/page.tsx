"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"verifying" | "ready" | "error" | "saving" | "done">("verifying");
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Já logado (ex.: recarregou depois de trocar a senha) → vai direto pro form.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("ready");
        return;
      }

      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      try {
        if (code) {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) throw err;
        } else if (tokenHash) {
          const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (err) throw err;
        } else {
          throw new Error("missing_token");
        }
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    })();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError(t("ns_senha_curta"));
      return;
    }
    if (password !== confirm) {
      setError(t("ns_nao_confere"));
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setStatus("done");
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch (err: any) {
      setError(err?.message || t("fp_erro"));
      setStatus("ready");
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
          <MayaAvatar state="idle" size={56} />
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
          {t("ns_titulo")}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
          {t("ns_subtitulo")}
        </p>
      </div>

      {status === "verifying" && (
        <p style={{ margin: 0, textAlign: "center", fontSize: 14, color: "var(--muted-foreground)" }}>
          …
        </p>
      )}

      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "oklch(.5 .15 15)", lineHeight: 1.6 }}>
            {t("ns_erro_token")}
          </p>
          <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>
            {t("fp_voltar")}
          </Link>
        </div>
      )}

      {status === "done" && (
        <p style={{ margin: 0, textAlign: "center", fontSize: 14, color: "var(--muted-foreground)" }}>
          {t("ns_sucesso")}
        </p>
      )}

      {(status === "ready" || status === "saving") && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>
              {t("lg_senha")}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>
              {t("ns_confirmar")}
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .15 15)", background: "oklch(.55 .1 15 / .1)", padding: "10px 14px", borderRadius: 10 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={status === "saving"} style={{ ...btnPrimary, opacity: status === "saving" ? 0.6 : 1, marginTop: 4 }}>
            {t("ns_salvar")}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
