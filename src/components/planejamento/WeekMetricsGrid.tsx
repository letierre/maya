"use client";

import { useTranslation } from "@/lib/useTranslation";

interface WeekMetricsGridProps {
  metrics: { strongest: string; weakest: string; balance: number; variation: number };
}

export function WeekMetricsGrid({ metrics }: WeekMetricsGridProps) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20,
    }}>
      <MetricCard
        label={t("wm_mais_forte")}
        value={metrics.strongest}
        accent="#22D18B"
        icon="💪"
      />
      <MetricCard
        label={t("wm_precisa_atencao")}
        value={metrics.weakest}
        accent="#FF9F43"
        icon="🎯"
      />
      <MetricCard
        label={t("wm_equilibrio")}
        value={`${metrics.balance}%`}
        accent="#5EEAD4"
        icon="⚖️"
        sub={metrics.balance >= 70 ? t("wm_bom") : metrics.balance >= 40 ? t("wm_razoavel") : t("wm_concentrado")}
      />
      <MetricCard
        label={t("wm_variacao")}
        value={metrics.variation > 0 ? `+${metrics.variation}%` : `${metrics.variation}%`}
        accent={metrics.variation > 0 ? "#22D18B" : "#FF5C5C"}
        icon="📊"
        sub={t("wm_vs_semana")}
      />
    </div>
  );
}

function MetricCard({ label, value, accent, icon, sub }: {
  label: string; value: string; accent: string; icon: string; sub?: string;
}) {
  return (
    <div style={{
      background: "#151520", borderRadius: 16,
      border: "1px solid rgba(167,139,250,0.08)", padding: "12px 14px",
    }}>
      <p style={{ margin: "0 0 6px", fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9e96b5" }}>
        {label}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: accent, letterSpacing: "-0.02em" }}>{value}</span>
      </div>
      {sub && (
        <p style={{ margin: "2px 0 0", fontSize: 9, color: "#6a657a" }}>{sub}</p>
      )}
    </div>
  );
}
