"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MayaAvatar } from "@/components/MayaAvatar";
import { Suspense } from "react";

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
  const [waitEmail, setWaitEmail] = useState("");
  const [error, setError]         = useState("");
  const router   = useRouter();
  const params   = useSearchParams();
  const erroParam = params.get("erro");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
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

    // Supabase auto-confirmed — session available immediately
    if (data.session) {
      router.push("/onboarding");
      return;
    }

    // Email confirmation required
    setWaitEmail(email);
    setLoading(false);
  };

  /* ── Tela de aguardo ──────────────────────────────────────────── */
  if (waitEmail) {
    return (
      <div style={pageWrap}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 18 }}>📬</div>
          <h1 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>
            Verifique seu email
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            Enviamos um link de confirmação para
          </p>
          <div style={{
            background: PL, borderRadius: 12, border: PB,
            padding: "10px 16px", marginBottom: 24,
            fontSize: 15, fontWeight: 700,
          }}>
            {waitEmail}
          </div>

          <div style={{
            background: "oklch(0.16 0.012 270)",
            borderRadius: 16, border: PB,
            padding: "18px 16px", textAlign: "left", marginBottom: 22,
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 700 }}>Próximos passos:</p>
            {[
              ["1", "Abra o Gmail agora"],
              ["2", "Clique em \"Confirmar cadastro\""],
              ["3", "Você entra no app automaticamente — sem precisar digitar a senha de novo"],
            ].map(([n, txt]) => (
              <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: P, color: "#fff",
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>{n}</div>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{txt}</span>
              </div>
            ))}
          </div>

          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted-foreground)" }}>
            Não achou? Verifique a pasta <strong>Spam</strong> ou <strong>Promoções</strong>.
          </p>

          <button
            type="button"
            onClick={() => setWaitEmail("")}
            style={{
              background: "none", border: PB, borderRadius: 10,
              padding: "9px 16px", fontSize: 13, cursor: "pointer",
              color: "var(--muted-foreground)", fontFamily: "var(--font-sans)",
            }}
          >
            ← Errei o email? Voltar
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
            Criar conta
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
            Seu companheiro de saúde e evolução
          </p>
        </div>

        {erroParam === "confirmacao" && (
          <div style={{
            background: "oklch(.55 .1 15 / .1)", border: "1px solid oklch(.55 .1 15 / .2)",
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
            fontSize: 13, color: "oklch(.4 .1 15)", lineHeight: 1.5,
          }}>
            O link de confirmação expirou ou é inválido. Tente criar a conta novamente.
          </div>
        )}

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
