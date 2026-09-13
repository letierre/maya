"use client";

import { useMemo } from "react";
import { sumMacros, mealTypeLabel, mealTypeEmoji } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import { detectNutrientGaps } from "@/lib/nutrient-data";
import { TrendingUp, TrendingDown, Minus, ShoppingCart } from "lucide-react";
import type { Meal, MealType } from "@/types";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE = "oklch(.58 .18 270)";
const TEAL = "oklch(0.45 0.15 160)";
const AMBER = "oklch(0.60 0.12 70)";
const RED = "oklch(0.50 0.15 15)";
const FOREGROUND = "#e0d6ff";

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "oklch(.17 .015 270 / .6)",
  border: `1px solid ${BORDER}`,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: FOREGROUND,
};

const mutedText: React.CSSProperties = {
  fontSize: 11, color: MUTED,
};

interface MonthData {
  total: number;
  avgKcal: number;
  classCount: Map<string, number>;
}

export function MonthlyReport({ meals, monthStats, onAddToShoppingList }: { meals: Meal[]; monthStats: MonthData; onAddToShoppingList?: (items: { item_name: string; category: string }[]) => void }) {
  const { t } = useTranslation();
  const analysis = useMemo(() => {
    const analyzed = meals.filter((m) => m.macros && m.status_analise === "analisado");

    // Variedade: itens únicos
    const allItems = analyzed.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase().trim()));
    const uniqueItems = new Set(allItems);
    const varietyScore = uniqueItems.size >= 20 ? t("nu_excelente") : uniqueItems.size >= 12 ? t("nu_boa") : uniqueItems.size >= 6 ? t("nu_regular") : t("nu_baixa");
    const varietyColor = uniqueItems.size >= 20 ? TEAL : uniqueItems.size >= 12 ? AMBER : RED;

    // Top itens
    const itemFreq = new Map<string, number>();
    for (const item of allItems) {
      itemFreq.set(item, (itemFreq.get(item) || 0) + 1);
    }
    const topItems = [...itemFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Distribuição por tipo de refeição
    const byType = new Map<string, { kcal: number; count: number }>();
    for (const m of analyzed) {
      const entry = byType.get(m.tipo_refeicao) || { kcal: 0, count: 0 };
      entry.kcal += m.macros?.calorias_kcal || 0;
      entry.count++;
      byType.set(m.tipo_refeicao, entry);
    }

    // Lacunas de micronutrientes
    const nutrientGaps = detectNutrientGaps(allItems);

    // Tendência semanal dentro do mês
    const weeklyKcal: { label: string; kcal: number; count: number }[] = [];
    const now = new Date();
    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), w * 7 + 1);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), (w + 1) * 7);
      const weekMeals = analyzed.filter((m) => {
        const d = new Date(m.data_hora);
        return d >= weekStart && d <= weekEnd;
      });
      const total = sumMacros(weekMeals);
      weeklyKcal.push({
        label: `${t("nu_sem")} ${w + 1}`,
        kcal: weekMeals.length > 0 ? Math.round(total.calorias_kcal / Math.max(weekMeals.length, 1)) : 0,
        count: weekMeals.length,
      });
    }

    // Tendência (comparando primeira vs última semana com dados)
    const weeksWithData = weeklyKcal.filter((w) => w.count > 0);
    let trend: "up" | "down" | "stable" = "stable";
    if (weeksWithData.length >= 2) {
      const first = weeksWithData[0].kcal;
      const last = weeksWithData[weeksWithData.length - 1].kcal;
      if (last > first * 1.1) trend = "up";
      else if (last < first * 0.9) trend = "down";
    }

    return {
      uniqueItems,
      varietyScore,
      varietyColor,
      topItems,
      byType,
      nutrientGaps,
      weeklyKcal,
      trend,
    };
  }, [meals, t]);

  if (monthStats.total === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Variedade alimentar ────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={sectionTitle}>{t("nu_variedade_alimentar")}</p>
          <span style={{ fontSize: 13, fontWeight: 700, color: analysis.varietyColor }}>
            {analysis.varietyScore}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: FOREGROUND }}>{analysis.uniqueItems.size}</span>
          <span style={mutedText}>
            {analysis.uniqueItems.size === 1 ? t("nu_alimento_diferente") : t("nu_alimentos_diferentes")}
          </span>
        </div>
        {analysis.uniqueItems.size < 12 && (
          <p style={{
            fontSize: 12, color: MUTED, lineHeight: 1.6,
            background: "oklch(.22 .015 270 / .5)", borderRadius: 10, padding: "8px 12px",
          }}>
            {t("nu_variedade_msg")}
          </p>
        )}
      </div>

      {/* ── Média kcal por semana ──────────────────────────── */}
      {analysis.weeklyKcal.some((w) => w.count > 0) && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={sectionTitle}>{t("nu_media_kcal_semana")}</span>
            {analysis.trend === "up" && <TrendingUp style={{ width: 16, height: 16, color: PURPLE }} />}
            {analysis.trend === "down" && <TrendingDown style={{ width: 16, height: 16, color: TEAL }} />}
            {analysis.trend === "stable" && <Minus style={{ width: 16, height: 16, color: MUTED }} />}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
            {analysis.weeklyKcal.map((w) => {
              const maxKcal = Math.max(...analysis.weeklyKcal.map((x) => x.kcal), 1);
              const height = (w.kcal / maxKcal) * 100;
              return (
                <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: FOREGROUND, fontVariantNumeric: "tabular-nums" }}>
                    {w.kcal > 0 ? w.kcal : "-"}
                  </span>
                  <div
                    style={{
                      width: "100%", borderRadius: "4px 4px 0 0", transition: "all .3s ease",
                      background: `linear-gradient(180deg, ${PURPLE}, oklch(.50 .18 270 / .6))`,
                      height: `${Math.max(height, 4)}%`,
                      opacity: w.count > 0 ? 1 : 0.3,
                    }}
                  />
                  <span style={{ fontSize: 10, color: MUTED }}>{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Distribuição por tipo ──────────────────────────── */}
      {analysis.byType.size > 0 && (
        <div style={cardStyle}>
          <p style={sectionTitle}>{t("nu_distribuicao_refeicao")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...analysis.byType.entries()]
              .sort((a, b) => b[1].kcal - a[1].kcal)
              .map(([type, data]) => {
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span>{mealTypeEmoji(type as MealType)}</span>
                    <span style={{ flex: 1, color: FOREGROUND }}>{mealTypeLabel(type as MealType)}</span>
                    <span style={mutedText}>{data.count}x</span>
                    <span style={{ fontWeight: 600, color: FOREGROUND, width: 64, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(data.kcal)} kcal
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Mais consumidos ────────────────────────────────── */}
      {analysis.topItems.length > 0 && (
        <div style={cardStyle}>
          <p style={sectionTitle}>{t("nu_mais_consumidos")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {analysis.topItems.map(([name, count]) => (
              <span key={name} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 9999, fontSize: 12,
                background: "oklch(.22 .015 270 / .5)", color: FOREGROUND,
              }}>
                {name}
                <span style={{ fontSize: 10, color: MUTED }}>{count}x</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Possíveis lacunas ──────────────────────────────── */}
      {analysis.nutrientGaps.length > 0 && (
        <div style={{
          ...cardStyle,
          background: `${AMBER} / 0.06`,
          border: `1px solid ${AMBER} / 0.18`,
        }}>
          <p style={sectionTitle}>{t("nu_possiveis_lacunas")}</p>
          {monthStats.total < 15 && (
            <p style={{
              fontSize: 12, color: "oklch(0.55 0.12 65)", lineHeight: 1.6,
              background: `${AMBER} / 0.12`, borderRadius: 10, padding: "8px 12px",
            }}>
              {t(monthStats.total === 1 ? "nu_registrou_mes_uma" : "nu_registrou_mes_varias", { n: String(monthStats.total) })}
            </p>
          )}
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            {monthStats.total < 15
              ? t("nu_dados_disponiveis")
              : t("nu_baseado_mes")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {analysis.nutrientGaps.map((gap) => (
              <div key={gap.nutrient}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{gap.emoji}</span>
                  <span style={{ fontWeight: 500, color: FOREGROUND }}>{gap.nutrient}</span>
                </div>
                <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, margin: 0, paddingLeft: 26 }}>
                  💡 {t("nu_experimente")}: {gap.sources.join(", ")}
                </p>
                {onAddToShoppingList && gap.sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onAddToShoppingList(gap.sources.map((s) => ({ item_name: s, category: gap.nutrient })))}
                    style={{
                      fontSize: 11, fontWeight: 600, color: "#A78BFA",
                      background: "oklch(.22 .015 270 / .5)", border: 0,
                      borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                      fontFamily: "inherit", display: "inline-flex",
                      alignItems: "center", gap: 4, marginTop: 6, marginLeft: 26,
                    }}
                  >
                    <ShoppingCart style={{ width: 12, height: 12 }} />
                    {t("nu_adicionar_lista")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
            {t("nu_analise_baseada")}
          </p>
        </div>
      )}
    </div>
  );
}
