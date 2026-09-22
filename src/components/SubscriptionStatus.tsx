"use client";
import { getLocale } from "@/lib/language";
import { useTranslation } from "@/lib/useTranslation";
import { withinNextDay, getLocalDate } from "@/lib/utils";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "monthly" | "annual";
type SubStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

interface Sub {
  plan: Plan | null;
  status: SubStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
}

function useSubscription() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => setSub(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { sub, loading };
}

function daysLeft(trialEndsAt: string): number {
  return Math.max(1, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(getLocale(), { day: "numeric", month: "long", year: "numeric" });
}

const ACCENT = "#7C5CFF";
const ACCENT_2 = "#A78BFA";

/**
 * Banner discreto do dashboard: só aparece durante o trial (sem cartão),
 * mostrando quantos dias restam. Some quando vira assinante ativo.
 */
export function TrialBanner() {
  const { sub, loading } = useSubscription();
  const { t } = useTranslation();

  if (loading || !sub) return null;
  if (sub.status !== "trialing" || !sub.trialEndsAt) return null;

  const left = daysLeft(sub.trialEndsAt);
  if (left <= 0) return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        margin: "0 14px 10px", padding: "10px 14px",
        borderRadius: 14,
        background: "oklch(0.5 0.12 270 / .12)",
        border: "1px solid oklch(0.5 0.12 270 / .35)",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>⏳</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
        {left === 1 ? t("ss_ultimo_dia") : t("ss_dias_teste", { n: String(left) })}
      </span>
      <span style={{ fontSize: 11, color: "#9e96b5", whiteSpace: "nowrap" }}>
        {t("ss_ate", { date: formatDate(sub.trialEndsAt) ?? "" })}
      </span>
    </div>
  );
}

/**
 * Aviso de assinatura (dashboard + Perfil). Aparece quando o usuário precisa de
 * atenção: assinatura ativa prestes a renovar (≤ 24h) ou cobrança pendente
 * (past_due). Com `dismissable`, mostra um "x" que persiste por dia (localStorage).
 */
export function SubscriptionNotice({ dismissable = false }: { dismissable?: boolean }) {
  const { sub, loading } = useSubscription();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissable) return;
    try {
      if (localStorage.getItem(`sub_notice_dismissed_${getLocalDate()}`)) setDismissed(true);
    } catch { /* ignore */ }
  }, [dismissable]);

  if (loading || !sub || dismissed) return null;

  const renewSoon = sub.status === "active" && withinNextDay(sub.currentPeriodEnd);
  const pastDue = sub.status === "past_due";

  let emoji = "";
  let title = "";
  let body = "";
  let danger = false;

  if (pastDue) {
    emoji = "⚠️";
    title = t("ss_pagamento_pendente");
    body = t("ss_atualize_cartao");
    danger = true;
  } else if (renewSoon) {
    emoji = "🔄";
    title = t("ss_renewal_titulo");
    body = t("ss_renewal_corpo", { date: formatDate(sub.currentPeriodEnd) ?? "" });
  } else {
    return null;
  }

  const dismiss = () => {
    if (dismissable) {
      try { localStorage.setItem(`sub_notice_dismissed_${getLocalDate()}`, "1"); } catch { /* ignore */ }
    }
    setDismissed(true);
  };

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        background: danger ? "oklch(0.52 0.15 25 / .14)" : "oklch(0.5 0.12 270 / .12)",
        border: danger ? "1px solid oklch(0.52 0.15 25 / .4)" : "1px solid oklch(0.5 0.12 270 / .35)",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1.3 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#9e96b5" }}>{body}</p>
      </div>
      {dismissable && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("fechar")}
          style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer", padding: 2, lineHeight: 1 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Card "Meu plano" (Perfil). Mostra o estado da assinatura com a ação certa:
 * assinar (trial/cancelado/none), gerenciar (ativo) ou atualizar pagamento (past_due).
 */
export function PlanCard() {
  const { sub, loading } = useSubscription();
  const router = useRouter();
  const { t } = useTranslation();

  if (loading || !sub) {
    return <p style={{ margin: 0, fontSize: 13, color: "#9e96b5" }}>{t("ss_carregando")}</p>;
  }

  const planLabel = sub.plan === "annual" ? t("ss_anual") : sub.plan === "monthly" ? t("ss_mensal") : null;

  const openPortal = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
    } catch { /* silent */ }
  };

  let emoji = "🌱";
  let title = t("ss_sem_plano");
  let detail: string | null = null;
  let actionLabel: string | null = t("ss_conhecer_planos");
  let onAction = () => router.push("/assinar");

  if (sub.status === "trialing") {
    emoji = "⏳";
    title = t("ss_teste_gratis");
    const left = daysLeft(sub.trialEndsAt ?? "");
    detail = sub.trialEndsAt
      ? `${left} ${t(left === 1 ? "ss_dia_restante" : "ss_dias_restantes")} · ${t("ss_sem_cartao")}`
      : t("ss_em_andamento");
    actionLabel = t("ss_assinar_agora");
    onAction = () => router.push("/assinar");
  } else if (sub.status === "active") {
    emoji = "💜";
    title = planLabel ? t("ss_plano_ativo", { label: planLabel }) : t("ss_assinatura_ativa");
    const renew = formatDate(sub.currentPeriodEnd);
    detail = renew ? t("ss_renova_em", { date: renew }) : t("ss_assinatura_ativa");
    actionLabel = t("ss_gerenciar");
    onAction = openPortal;
  } else if (sub.status === "past_due") {
    emoji = "⚠️";
    title = t("ss_pagamento_pendente");
    detail = t("ss_atualize_cartao");
    actionLabel = t("ss_atualizar_pagamento");
    onAction = openPortal;
  } else if (sub.status === "canceled") {
    emoji = "🌱";
    title = t("ss_plano_cancelado");
    detail = t("ss_reative");
    actionLabel = t("ss_reativar_plano");
    onAction = () => router.push("/assinar");
  }

  return (
    <div
      style={{
        background: "oklch(0.16 0.012 270 / 0.7)",
        borderRadius: 20,
        border: "1px solid rgba(167,139,250,0.25)",
        padding: "20px 18px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>{title}</p>
          {detail && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#9e96b5" }}>{detail}</p>}
        </div>
      </div>

      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          style={{
            width: "100%", height: 44, borderRadius: 12, border: 0, cursor: "pointer",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`,
            color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
