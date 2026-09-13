"use client";

import { useTranslation } from "@/lib/useTranslation";

interface MayaStrategyCardProps {
  insight?: { message: string; action?: { label: string; href: string } } | null;
  loading?: boolean;
}

export function MayaStrategyCard({ insight, loading }: MayaStrategyCardProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div style={{
        background: "#151520", borderRadius: 20, border: "1px solid rgba(124,92,255,0.1)",
        padding: "16px 18px", marginBottom: 16, opacity: 0.6,
      }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,255,0.1)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 10, width: 80, borderRadius: 5, background: "rgba(167,139,250,0.1)", marginBottom: 8 }} />
            <div style={{ height: 8, width: "100%", borderRadius: 4, background: "rgba(167,139,250,0.06)", marginBottom: 4 }} />
            <div style={{ height: 8, width: "70%", borderRadius: 4, background: "rgba(167,139,250,0.06)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #151520 0%, #1a1530 100%)",
      borderRadius: 20,
      border: "1px solid rgba(124,92,255,0.15)",
      padding: "16px 18px",
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow accent */}
      <div style={{
        position: "absolute", top: -30, right: -20,
        width: 100, height: 100, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,92,255,0.1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
        {/* Maya mini avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(124,92,255,0.3)",
        }}>
          <span style={{ fontSize: 18 }}>🧠</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#A78BFA" }}>
            {t("plc_maya_sugere")}
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#e0d6ff", lineHeight: 1.5, letterSpacing: "-0.01em" }}>
            {insight.message}
          </p>
        </div>
      </div>
    </div>
  );
}
