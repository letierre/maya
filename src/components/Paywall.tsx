"use client";

import { useState } from "react";
import { toast } from "sonner";

const ACCENT = "#7C5CFF";
const ACCENT_2 = "#A78BFA";
const CARD = "oklch(0.16 0.012 270)";
const BORDER = "oklch(0.28 0.02 270 / 0.5)";
const MUTED = "oklch(0.55 0.03 270)";
const TEXT = "#e0d6ff";

/**
 * Paywall reutilizável (onboarding e /assinar). `beforeCheckout` é opcional:
 * no onboarding, completa o cadastro antes de redirecionar pro Checkout.
 */
export function Paywall({ beforeCheckout }: { beforeCheckout?: () => Promise<void> }) {
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      if (beforeCheckout) await beforeCheckout();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "checkout");
      window.location.href = data.url;
    } catch {
      toast.error("Não foi possível iniciar o pagamento. Tente novamente.");
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else toast.info("Você ainda não tem uma assinatura para restaurar.");
    } catch {
      toast.info("Em breve: gerenciamento de assinatura.");
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>💜</div>
      <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", color: TEXT }}>
        Seu equilíbrio, com a Maya ao seu lado.
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        Continue sua jornada com uma companheira que entende você.
      </p>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", marginBottom: 20 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13.5, color: TEXT, fontStyle: "italic" }}>“É como ter alguém que presta atenção em mim.”</p>
        <p style={{ margin: 0, fontSize: 12, color: ACCENT_2, fontWeight: 700 }}>★★★★★</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 800, color: TEXT }}>7 dias grátis</p>

        {/* Plano anual (destaque) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPlan("annual")}
          style={{
            cursor: "pointer", textAlign: "left",
            background: plan === "annual" ? "oklch(0.5 0.12 270 / .16)" : CARD,
            border: plan === "annual" ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
            borderRadius: 16, padding: "14px 16px", marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Anual</span>
            <span style={{ background: ACCENT, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>economize 30%</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: TEXT }}>
            US$ 83,99<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>/ano</span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: MUTED }}>≈ US$ 7,00/mês · cancele quando quiser</p>
        </div>

        {/* Plano mensal */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPlan("monthly")}
          style={{
            cursor: "pointer", textAlign: "left",
            background: plan === "monthly" ? "oklch(0.5 0.12 270 / .16)" : CARD,
            border: plan === "monthly" ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
            borderRadius: 16, padding: "14px 16px",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Mensal</span>
          <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: TEXT }}>
            US$ 9,99<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>/mês</span>
          </p>
        </div>
      </div>

      <button type="button" onClick={handleCheckout} disabled={loading} style={{
        width: "100%", height: 54, borderRadius: 16, border: 0, cursor: "pointer",
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff",
        fontFamily: "inherit", fontSize: 15.5, fontWeight: 700,
        opacity: loading ? 0.7 : 1,
        boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
      }}>
        {loading ? "Preparando…" : "Começar meus 7 dias grátis"}
      </button>

      <button type="button" onClick={handleRestore} style={{
        marginTop: 14, background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: MUTED, textDecoration: "underline",
      }}>Restaurar compras</button>
    </div>
  );
}
