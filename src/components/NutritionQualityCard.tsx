"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { dailyQuality, nutritionScore, sumMacros, classificationLabel } from "@/lib/meal-utils";
import type { Meal } from "@/types";

const CLASSIFICATION_STYLE: Record<string, { bg: string; text: string }> = {
  equilibrada:         { bg: "oklch(0.45 0.15 160 / 0.12)", text: "oklch(0.45 0.15 160)" },
  leve_proteina:       { bg: "oklch(0.60 0.12 70 / 0.12)",  text: "oklch(0.60 0.12 70)" },
  alta_acucar:         { bg: "oklch(0.50 0.15 15 / 0.12)",  text: "oklch(0.50 0.15 15)" },
  alta_gordura:        { bg: "oklch(0.55 0.15 45 / 0.12)",  text: "oklch(0.55 0.15 45)" },
  alta_sal:            { bg: "oklch(0.58 0.18 270 / 0.12)", text: "oklch(0.58 0.18 270)" },
  vegetais_baixo:      { bg: "oklch(0.50 0.12 220 / 0.12)", text: "oklch(0.50 0.12 220)" },
  nao_identificada:    { bg: "oklch(0.5 0 0 / 0.08)",       text: "#9e96b5" },
};

interface Props {
  todayMeals: Meal[];
  t: (key: string) => string;
}

export function NutritionQualityCard({ todayMeals, t }: Props) {
  const [open, setOpen] = useState(false);

  const quality = dailyQuality(todayMeals);

  const diagnostic = useMemo(() => {
    const analyzed = todayMeals.filter((m) => m.macros && m.status_analise === "analisado");
    if (analyzed.length === 0) return null;

    const total = sumMacros(analyzed);
    const totalG = total.carboidratos_g + total.proteinas_g + total.gorduras_g;
    const carbPct = totalG > 0 ? Math.round((total.carboidratos_g / totalG) * 100) : 0;
    const protPct = totalG > 0 ? Math.round((total.proteinas_g / totalG) * 100) : 0;
    const gordPct = totalG > 0 ? Math.round((total.gorduras_g / totalG) * 100) : 0;
    const score = nutritionScore(analyzed);
    const freq = analyzed.length;

    const carbOk = carbPct >= 40 && carbPct <= 65;
    const protOk = protPct >= 15 && protPct <= 30;
    const gordOk = gordPct >= 15 && gordPct <= 35;

    const issues: string[] = [];
    if (!carbOk) issues.push(carbPct > 65 ? t("nu_carb_acima") : t("nu_carb_abaixo"));
    if (!protOk) issues.push(protPct < 15 ? t("nu_prot_abaixo") : t("nu_prot_acima"));
    if (!gordOk) issues.push(gordPct > 35 ? t("nu_gord_acima") : t("nu_gord_abaixo"));
    if (freq < 3) issues.push(t("nu_poucas_refeicoes"));

    const classCount = new Map<string, number>();
    for (const m of todayMeals) {
      if (m.classificacao) {
        classCount.set(m.classificacao, (classCount.get(m.classificacao) || 0) + 1);
      }
    }

    return { carbPct, protPct, gordPct, score, freq, issues, carbOk, protOk, gordOk, classCount };
  }, [todayMeals, t]);

  if (todayMeals.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      style={{
        width: "100%", textAlign: "left", borderRadius: 12, cursor: "pointer",
        fontFamily: "inherit", transition: "all .15s ease",
        background: quality === "bom"
          ? "oklch(0.45 0.15 160 / 0.08)"
          : quality === "atencao"
          ? "oklch(0.60 0.12 70 / 0.08)"
          : "oklch(0.16 0.012 270 / 0.5)",
        border: quality === "bom"
          ? "1px solid oklch(0.45 0.15 160 / 0.15)"
          : quality === "atencao"
          ? "1px solid oklch(0.60 0.12 70 / 0.15)"
          : "1px solid oklch(.28 .02 270 / .25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: quality === "bom"
            ? "oklch(0.45 0.15 160)"
            : quality === "atencao"
            ? "oklch(0.60 0.12 70)"
            : "#9e96b5",
        }}>
          {quality === "bom" ? t("qualidade_bom") :
           quality === "atencao" ? t("qualidade_atencao") :
           t("qualidade_sem_dados")}
        </span>
        <ChevronDown style={{ width: 16, height: 16, color: "#9e96b5", transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>

      {open && diagnostic && quality !== "sem_dados" && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#9e96b5" }}>{t("nu_score")}:</span>
            <span style={{
              fontWeight: 700,
              color: diagnostic.score >= 80
                ? "oklch(0.45 0.15 160)"
                : diagnostic.score >= 60
                ? "oklch(0.60 0.12 70)"
                : "oklch(0.50 0.15 15)",
            }}>
              {diagnostic.score}/100
            </span>
            <span style={{ fontSize: 11, color: "#9e96b5" }}>
              ({diagnostic.freq} {t(diagnostic.freq === 1 ? "nu_refeicao" : "nu_refeicoes")})
            </span>
          </div>

          {/* Balanço de macros */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#9e96b5" }}>{t("nu_distribuicao_macros")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, textAlign: "center", fontSize: 11 }}>
              {(["carb", "prot", "gord"] as const).map((macro) => {
                const ok = macro === "carb" ? diagnostic.carbOk : macro === "prot" ? diagnostic.protOk : diagnostic.gordOk;
                const pct = macro === "carb" ? diagnostic.carbPct : macro === "prot" ? diagnostic.protPct : diagnostic.gordPct;
                const label = macro === "carb" ? t("nu_carbs") : macro === "prot" ? t("nu_prot") : t("nu_gord");
                const good = "oklch(0.45 0.15 160)";
                const bad = "oklch(0.50 0.15 15)";
                return (
                  <div key={macro} style={{
                    borderRadius: 8, padding: "6px 0",
                    background: ok ? `${good} / 0.10` : `${bad} / 0.08`,
                    color: ok ? good : bad, fontWeight: 600,
                  }}>
                    {label} {pct}%
                  </div>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: 10, color: "#9e96b5" }}>
              {t("nu_ideal_macros")}
            </p>
          </div>

          {/* Alertas específicos */}
          {diagnostic.issues.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#9e96b5" }}>{t("nu_o_que_melhorar")}</p>
              {diagnostic.issues.map((issue, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8, fontSize: 11,
                  color: "oklch(0.60 0.12 70)", background: "oklch(0.60 0.12 70 / 0.08)",
                  borderRadius: 8, padding: "4px 12px",
                }}>
                  <span>⚠️</span> {issue}
                </div>
              ))}
            </div>
          )}

          {/* Classificações do dia */}
          {diagnostic.classCount.size > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#9e96b5" }}>{t("nu_classificacoes_dia")}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {[...diagnostic.classCount.entries()].map(([classif, count]) => {
                  const s = CLASSIFICATION_STYLE[classif] || CLASSIFICATION_STYLE.nao_identificada;
                  return (
                    <span key={classif} style={{
                      display: "inline-flex", alignItems: "center", padding: "2px 8px",
                      borderRadius: 9999, fontSize: 10, fontWeight: 600,
                      background: s.bg, color: s.text,
                    }}>
                      {classificationLabel(classif as Meal["classificacao"] & string)} ({count}x)
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {quality === "bom" && diagnostic.issues.length === 0 && (
            <p style={{
              margin: 0, fontSize: 11, borderRadius: 8, padding: "8px 12px",
              color: "oklch(0.45 0.15 160)", background: "oklch(0.45 0.15 160 / 0.10)",
            }}>
              {t("nu_continue_assim")}
            </p>
          )}
        </div>
      )}
    </button>
  );
}
