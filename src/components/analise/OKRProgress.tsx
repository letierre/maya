"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import type { QuarterlyCycle } from "@/types";
import { Section, CARD, FOREGROUND, MUTED, LILAC, GREEN, ProgressBar } from "./Section";

const UNIT_LABELS: Record<string, string> = {
  "%": "%", count: "x", kg: "kg", min: "min", km: "km", "R$": "R$",
};

type Period = "semana" | "mes" | "trimestre";

function cyclePct(cycle: QuarterlyCycle): number {
  const krs = cycle.key_results ?? [];
  if (krs.length === 0) return 0;
  return Math.round(
    krs.reduce(
      (s, kr) => s + (kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0),
      0,
    ) / krs.length,
  );
}

export function OKRProgress({ period }: { period: Period }) {
  const [cycles, setCycles] = useState<QuarterlyCycle[]>([]);

  useEffect(() => {
    safeCachedFetch<QuarterlyCycle[]>("/api/quarterly-cycles").then((data) => {
      if (Array.isArray(data)) setCycles(data);
    });
  }, []);

  const active = cycles.find((c) => c.status === "active");
  const hasActive = !!active && !!active.key_results && active.key_results.length > 0;
  // No trimestre, também mostramos os ciclos anteriores já concluídos
  const past = period === "trimestre"
    ? cycles.filter((c) => c.status === "completed" && !!c.key_results && c.key_results.length > 0).slice(0, 4)
    : [];

  if (!hasActive && past.length === 0) return null;

  return (
    <Section title="OKRs do trimestre">
      <div style={{ ...CARD }}>
        {hasActive && active && (
          <>
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
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: LILAC, fontFamily: "monospace" }}>{cyclePct(active)}%</p>
                <p style={{ margin: 0, fontSize: 9, color: MUTED }}>
                  {active.key_results!.filter((k) => k.status === "completed").length}/{active.key_results!.length} KRs
                </p>
              </div>
            </div>

            {active.key_results!.map((kr) => {
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
          </>
        )}

        {past.length > 0 && (
          <>
            {hasActive && <div style={{ height: 1, background: "oklch(0.25 0.02 270)", margin: "16px 0 14px" }} />}
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: MUTED }}>
              Trimestres anteriores
            </p>
            {past.map((c) => (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: FOREGROUND }}>{c.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>{cyclePct(c)}%</span>
                </div>
                <ProgressBar pct={cyclePct(c)} color={LILAC} />
              </div>
            ))}
          </>
        )}
      </div>
    </Section>
  );
}
