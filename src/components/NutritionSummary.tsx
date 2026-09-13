import React from "react";
import { sumMacros, nutritionScore, DEFAULT_DAILY_KCAL } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import type { Meal } from "@/types";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";

export function NutritionSummary({ meals, label, kcalGoal = DEFAULT_DAILY_KCAL }: { meals: Meal[]; label: string; kcalGoal?: number }) {
  const { t } = useTranslation();
  const analyzed = meals.filter((m) => m.macros && m.status_analise === "analisado");
  const total = sumMacros(analyzed);
  const hasData = analyzed.length > 0;

  const totalG = total.carboidratos_g + total.proteinas_g + total.gorduras_g;
  const carbPct = totalG > 0 ? Math.round((total.carboidratos_g / totalG) * 100) : 0;
  const protPct = totalG > 0 ? Math.round((total.proteinas_g / totalG) * 100) : 0;
  const gordPct = totalG > 0 ? Math.round((total.gorduras_g / totalG) * 100) : 0;

  const score = hasData ? nutritionScore(analyzed) : 0;
  const scoreColor = score >= 80 ? "oklch(0.45 0.15 160)" : score >= 60 ? "oklch(0.60 0.12 70)" : "oklch(0.50 0.15 15)";

  const kcalPct = hasData ? Math.min(Math.round((total.calorias_kcal / kcalGoal) * 100), 100) : 0;
  const progressColor = kcalPct >= 100 ? "oklch(0.60 0.12 70)" : "oklch(0.45 0.15 160)";

  // Dados para o anel de macros
  const ringData = [
    { pct: carbPct, color: "oklch(0.60 0.12 70)", label: "Carbs", grams: total.carboidratos_g },
    { pct: protPct, color: "oklch(0.50 0.15 15)", label: "Prot", grams: total.proteinas_g },
    { pct: gordPct, color: "oklch(0.55 0.15 45)", label: "Gord", grams: total.gorduras_g },
  ].filter((d) => d.pct > 0);

  const ringCirc = 2 * Math.PI * 15; // ≈ 94.2

  return (
    <div style={{
      borderRadius: 16,
      background: `linear-gradient(135deg, ${BORDER}, oklch(.58 .18 270 / .04))`,
      border: `1px solid ${BORDER}`,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>{label}</p>
        {hasData && (
          <span style={{ fontSize: 11, color: MUTED }}>
            {analyzed.length} {t(analyzed.length === 1 ? "nu_refeicao" : "nu_refeicoes")}
          </span>
        )}
      </div>

      {!hasData ? (
        <p style={{ fontSize: 13, color: MUTED, textAlign: "center", padding: "16px 0" }}>
          {t("nu_nenhuma_analisada")}
        </p>
      ) : (
        <>
          {/* Kcal + Score lado a lado */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>
                  {total.calorias_kcal}
                </span>
                <span style={{ fontSize: 13, color: MUTED, marginLeft: 4 }}>kcal</span>
              </div>
              {/* Barra de progresso da meta */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.10)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%", borderRadius: 9999, transition: "all .7s ease",
                      background: progressColor, width: `${Math.min(kcalPct, 100)}%`,
                    }}
                  />
                </div>
                <p style={{ fontSize: 10, color: MUTED }}>
                  {t("nu_da_meta", { pct: String(kcalPct), kcal: String(kcalGoal) })}
                </p>
              </div>
            </div>

            {/* Anel de macros */}
            <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
              <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(167,139,250,0.12)" strokeWidth="3" />
                {ringData.reduce(
                  (els, seg, i) => {
                    const prevSum = ringData.slice(0, i).reduce((s, d) => s + d.pct, 0);
                    const dashLen = (seg.pct / 100) * ringCirc;
                    const offset = ringCirc - (prevSum / 100) * ringCirc;
                    els.push(
                      <circle
                        key={seg.label}
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="3"
                        strokeDasharray={`${dashLen} ${ringCirc}`}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                      />
                    );
                    return els;
                  },
                  [] as React.ReactElement[]
                )}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>{score}</span>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", fontSize: 11 }}>
            <div>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "oklch(0.60 0.12 70)", marginRight: 4, verticalAlign: "middle" }} />
              <span style={{ color: MUTED }}>{t("nu_carbs")}</span>
              <p style={{ fontWeight: 600, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>{total.carboidratos_g}g</p>
            </div>
            <div>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "oklch(0.50 0.15 15)", marginRight: 4, verticalAlign: "middle" }} />
              <span style={{ color: MUTED }}>{t("nu_prot")}</span>
              <p style={{ fontWeight: 600, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>{total.proteinas_g}g</p>
            </div>
            <div>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "oklch(0.55 0.15 45)", marginRight: 4, verticalAlign: "middle" }} />
              <span style={{ color: MUTED }}>{t("nu_gord")}</span>
              <p style={{ fontWeight: 600, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>{total.gorduras_g}g</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
