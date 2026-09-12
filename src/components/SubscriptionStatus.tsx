"use client";
import { getLocale } from "@/lib/language";

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
        {left === 1 ? "Último dia de teste grátis" : `${left} dias de teste grátis restantes`}
      </span>
      <span style={{ fontSize: 11, color: "#9e96b5", whiteSpace: "nowrap" }}>
        até {formatDate(sub.trialEndsAt)}
      </span>
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

  if (loading || !sub) {
    return <p style={{ margin: 0, fontSize: 13, color: "#9e96b5" }}>Carregando plano…</p>;
  }

  const planLabel = sub.plan === "annual" ? "Anual" : sub.plan === "monthly" ? "Mensal" : null;

  const openPortal = async () => {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
    } catch { /* silent */ }
  };

  let emoji = "🌱";
  let title = "Sem plano ativo";
  let detail: string | null = null;
  let actionLabel: string | null = "Conhecer planos";
  let onAction = () => router.push("/assinar");

  if (sub.status === "trialing") {
    emoji = "⏳";
    title = "Teste grátis";
    detail = sub.trialEndsAt
      ? `${daysLeft(sub.trialEndsAt)} ${daysLeft(sub.trialEndsAt) === 1 ? "dia restante" : "dias restantes"} · sem cartão`
      : "Em andamento";
    actionLabel = "Assinar agora";
    onAction = () => router.push("/assinar");
  } else if (sub.status === "active") {
    emoji = "💜";
    title = planLabel ? `Plano ${planLabel} ativo` : "Assinatura ativa";
    const renew = formatDate(sub.currentPeriodEnd);
    detail = renew ? `Renova em ${renew}` : "Assinatura ativa";
    actionLabel = "Gerenciar assinatura";
    onAction = openPortal;
  } else if (sub.status === "past_due") {
    emoji = "⚠️";
    title = "Pagamento pendente";
    detail = "Atualize seu cartão para não perder o acesso.";
    actionLabel = "Atualizar pagamento";
    onAction = openPortal;
  } else if (sub.status === "canceled") {
    emoji = "🌱";
    title = "Plano cancelado";
    detail = "Reative para continuar sua jornada.";
    actionLabel = "Reativar plano";
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
