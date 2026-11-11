"use client";

import type { ReactNode } from "react";
import { formatPaceShort } from "@/lib/running/format";
import type { Split } from "@/lib/running/types";

export function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "rgba(26,21,48,0.82)", backdropFilter: "blur(8px)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
        <span style={{ color: "#A78BFA" }}>{icon}</span>
        <span style={{ fontSize: 10, color: "#9e96b5", fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>{value}</span>
    </div>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 12, padding: "12px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#9e96b5", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export function PaceChart({ splits }: { splits: Split[] }) {
  const speeds = splits.map(s => 3600 / Math.max(1, s.paceSecPerKm));
  const maxSpeed = Math.max(...speeds, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 132, padding: "0 2px" }}>
      {splits.map((s, i) => {
        const h = Math.round((speeds[i] / maxSpeed) * 92);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5, height: "100%" }}>
            <span style={{ fontSize: 8, color: "#A78BFA", fontWeight: 700, whiteSpace: "nowrap" }}>{formatPaceShort(s.paceSecPerKm)}</span>
            <div style={{ width: "100%", maxWidth: 24, height: Math.max(6, h), borderRadius: 6, background: s.partial ? "rgba(167,139,250,0.35)" : "#7C5CFF", boxShadow: "0 2px 8px rgba(124,92,255,0.25)" }} />
            <span style={{ fontSize: 8, color: "#5a5470", whiteSpace: "nowrap" }}>{s.distKm < 1 ? `${s.distKm.toFixed(1)}km` : `${s.distKm.toFixed(0)}km`}</span>
          </div>
        );
      })}
    </div>
  );
}
