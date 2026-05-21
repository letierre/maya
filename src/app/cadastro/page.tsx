"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const P  = "oklch(.5 .12 160)";
const PL = "oklch(.5 .12 160 / .12)";
const PB = "1px solid oklch(.5 .12 160 / .15)";

const cardStyle: React.CSSProperties = {
  background: "oklch(1 0 0 / .55)",
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
  background: "oklch(1 0 0 / .6)",
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

export default function CadastroPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .4) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.985 .004 160) 0%, oklch(.94 .022 160) 100%)`,
      fontFamily: "var(--font-sans)",
    }}>
      <div style={cardStyle}>
        {done ? (
          /* ── Estado: confirme seu email ──────────────────────────── */
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>
              Confirme seu email
            </h1>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              Enviamos um link para{" "}
              <strong style={{ color: "var(--foreground)" }}>{email}</strong>.
              <br />
              Abra o email e clique no link para ativar sua conta.
            </p>
            <div style={{
              background: PL,
              borderRadius: 14,
              border: PB,
              padding: "14px 16px",
              textAlign: "left",
              marginBottom: 20,
            }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700 }}>Não encontrou o email?</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.8 }}>
                <li>Verifique a pasta de <strong>Spam</strong> ou <strong>Promoções</strong></li>
                <li>O assunto é: <strong>Confirme seu cadastro</strong></li>
                <li>Pode levar até 2 minutos para chegar</li>
              </ul>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
              Já confirmou?{" "}
              <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none" }}>
                Entrar
              </Link>
            </p>
          </div>
        ) : (
          /* ── Formulário de cadastro ───────────────────────────────── */
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🌱</div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
                Criar conta
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
                Seu companheiro de saúde e evolução
              </p>
            </div>

            <form onSubmit={handleCadastro} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  placeholder="Mínimo 6 caracteres"
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
                {loading ? "Criando conta…" : "Criar conta grátis"}
              </button>

              <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
                Já tem conta?{" "}
                <Link href="/login" style={{ color: P, fontWeight: 700, textDecoration: "none" }}>
                  Entrar
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
