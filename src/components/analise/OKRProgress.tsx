"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import type { QuarterlyCycle } from "@/types";
import { Section, CARD, FOREGROUND, MUTED, LILAC, GREEN, ProgressBar } from "./Section";

const UNIT_LABELS: Record<string, string> = {
  "%": "%", count: "x", kg: "kg", min: "min", km: "km", "R$": "R$",
};

export function OKRProgress() {
  const [cycles, setCycles] = useState<QuarterlyCycle[]>([]);

  useEffect(() => {
    safeCachedFetch<QuarterlyCycle[]>("/api/quarterly-cycles").then((data) => {
      if (Array.isArray(data)) setCycles(data);
    });
  }, []);

  const active = cycles.find((c) => c.status === "active");
  if (!active || !active.key_results || active.key_results.length === 0) return null;

  const krs = active.key_results;
  const avgPct = Math.round(
    krs.reduce(
      (s, kr) => s + (kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0),
      0,
    ) / krs.length,
  );

  return (
    <Section title="OKRs do trimestre">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: FOREGROUND }}>🎯 {active.label}</p>
            {active.theme && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: LILAC, fontStyle: "italic" }}>
                “{active.theme}”
              </p>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: LILAC, fontFamily: "monospace" }}>{avgPct}%</p>
            <p style={{ margin: 0, fontSize: 9, color: MUTED }}>
              {krs.filter((k) => k.status === "completed").length}/{krs.length} KRs
            </p>
          </div>
        </div>

        {krs.map((kr) => {
          const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
          const unit = UNIT_LABELS[kr.unit] ?? kr.unit;
          return (
            <div key={kr.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    color: FOREGROUND,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {kr.title}
                </span>
                <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>
                  {kr.current}{unit}/{kr.target}{unit}
                </span>
              </div>
              <ProgressBar pct={pct} color={kr.status === "completed" ? GREEN : undefined} />
            </div>
          );
        })}
      </div>
    </Section>
  );
}
