"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MayaAvatar } from "@/components/MayaAvatar";

const P  = "#7C5CFF";
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

function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmationFailed = searchParams.get("error") === "confirmation_failed";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      console.log("[LOGIN] Resultado:", { hasData: !!data, hasError: !!loginError, errorMsg: loginError?.message });

      if (loginError) {
        setError(
          loginError.message === "Invalid login credentials"
            ? "Email ou senha incorretos. Verifique se confirmou seu email."
            : loginError.message
        );
        setLoading(false);
        return;
      }

      console.log("[LOGIN] Sucesso, redirecionando...");
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("[LOGIN] Erro capturado:", err);
      setError(err?.message || "Erro inesperado ao fazer login. Tente novamente.");
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
          Bem-vindo de volta
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
          Continue sua jornada de saúde
        </p>
      </div>

      {confirmationFailed && (
        <div style={{
          background: "oklch(.55 .1 15 / .1)",
          border: "1px solid oklch(.55 .1 15 / .2)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
          fontSize: 13,
          color: "oklch(.4 .1 15)",
          lineHeight: 1.5,
        }}>
          Não foi possível confirmar o email. Tente o link novamente ou entre em contato.
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted-foreground)" }}>
            Email
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
            Senha
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
          Não tem conta?{" "}
          <Link href="/cadastro" style={{ color: P, fontWeight: 700, textDecoration: "none" }}>
            Criar conta grátis
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
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
        <LoginForm />
      </Suspense>
    </div>
  );
}
