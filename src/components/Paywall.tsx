"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";

const ACCENT = "#7C5CFF";
const ACCENT_2 = "#A78BFA";
const CARD = "var(--surface)";
const BORDER = "var(--surface-border)";
const MUTED = "var(--text-muted)";
const TEXT = "#e0d6ff";

type Variant = "none" | "expired" | "past_due" | "canceled";

const COPY: Record<Variant, { headlineKey: string; subKey: string; ctaKey: string }> = {
  none: {
    headlineKey: "pw_none_headline",
    subKey: "pw_none_sub",
    ctaKey: "pw_cta_assinar",
  },
  expired: {
    headlineKey: "pw_expired_headline",
    subKey: "pw_expired_sub",
    ctaKey: "pw_cta_assinar",
  },
  past_due: {
    headlineKey: "pw_past_due_headline",
    subKey: "pw_past_due_sub",
    ctaKey: "pw_cta_atualizar",
  },
  canceled: {
    headlineKey: "pw_canceled_headline",
    subKey: "pw_canceled_sub",
    ctaKey: "pw_cta_reativar",
  },
};

/**
 * Paywall reutilizável (/assinar). Adapta a mensagem ao estado da assinatura:
 * novo (sem trial ainda), período grátis expirado, pagamento pendente ou cancelado.
 */
export function Paywall() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  // Brasil → R$; fora do Brasil → US$ (público LATAM já está acostumado a ver em dólar).
  const [isBrazil, setIsBrazil] = useState(true);

  useEffect(() => {
    // País preciso por IP (Vercel). Fallback: idioma do navegador (dev/local).
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { country?: string } | null) => {
        if (d?.country) {
          setIsBrazil(d.country === "BR");
        } else {
          const lang = (navigator.language || "").toLowerCase();
          setIsBrazil(lang.startsWith("pt-br"));
        }
      })
      .catch(() => {
        const lang = (navigator.language || "").toLowerCase();
        setIsBrazil(lang.startsWith("pt-br"));
      });
  }, []);

  const px = isBrazil
    ? { monthly: "R$ 49,90", annual: "R$ 399,90", note: "≈ R$ 33,33" }
    : { monthly: "$ 9,99", annual: "$ 79,99", note: "≈ $ 6,67" };

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status ?? null);
        setTrialEndsAt(d.trialEndsAt ?? null);
      })
      .catch(() => {});
  }, []);

  const variant: Variant = (() => {
    if (status === "past_due") return "past_due";
    if (status === "canceled") return "canceled";
    if (status === "trialing" && trialEndsAt && new Date(trialEndsAt).getTime() <= Date.now()) return "expired";
    return "none";
  })();

  const copy = COPY[variant];

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "checkout");
      window.location.href = data.url;
    } catch {
      toast.error(t("pw_erro_pagamento"));
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else toast.info(t("pw_sem_assinatura"));
    } catch {
      toast.info(t("pw_em_breve"));
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>💜</div>
      <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", color: TEXT }}>
        {t(copy.headlineKey)}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        {t(copy.subKey)}
      </p>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", marginBottom: 20 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13.5, color: TEXT, fontStyle: "italic" }}>“{t("pw_depoimento")}”</p>
        <p style={{ margin: 0, fontSize: 12, color: ACCENT_2, fontWeight: 700 }}>★★★★★</p>
      </div>

      <div style={{ marginBottom: 20 }}>
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
            <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>{t("pw_anual")}</span>
            <span style={{ background: ACCENT, color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{t("pw_economize")}</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: TEXT }}>
            {px.annual}<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{t("pw_ano")}</span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: MUTED }}>{px.note}{t("pw_mes")} · {t("pw_cancele")}</p>
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
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{t("pw_mensal")}</span>
          <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: TEXT }}>
            {px.monthly}<span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>{t("pw_mes")}</span>
          </p>
        </div>
      </div>

      <button type="button" onClick={variant === "past_due" ? handleRestore : handleCheckout} disabled={loading} style={{
        width: "100%", height: 54, borderRadius: 16, border: 0, cursor: "pointer",
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff",
        fontFamily: "inherit", fontSize: 15.5, fontWeight: 700,
        opacity: loading ? 0.7 : 1,
        boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
      }}>
        {loading ? t("pw_preparando") : t(copy.ctaKey)}
      </button>

      <button type="button" onClick={handleRestore} style={{
        marginTop: 14, background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: MUTED, textDecoration: "underline",
      }}>{t("pw_restaurar")}</button>
    </div>
  );
}
