import { getLocale } from "@/lib/language";
import { useMemo } from "react";
import { sumMacros, nutritionScore, mealTypeLabel, mealTypeEmoji } from "@/lib/meal-utils";
import { detectNutrientGaps } from "@/lib/nutrient-data";
import { getLocalDateFromISO, getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ShoppingCart } from "lucide-react";
import type { Meal, MealType } from "@/types";

interface WeekDay {
  date: string;
  label: string;
  meals: Meal[];
  kcal: number;
  score: number;
}

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE = "oklch(.58 .18 270)";
const TEAL = "oklch(0.45 0.15 160)";
const AMBER = "oklch(0.60 0.12 70)";

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
  fontSize: 13, fontWeight: 600, color: "#e0d6ff",
};

const mutedText: React.CSSProperties = {
  fontSize: 11, color: MUTED,
};

export function WeeklyReport({ meals, weekDays, onAddToShoppingList }: { meals: Meal[]; weekDays: WeekDay[]; onAddToShoppingList?: (items: { item_name: string; category: string }[]) => void }) {
  const mondayDate = getWeekMondayDate();
  const sundayDate = getWeekSundayDate();

  // Semana atual vs anterior (seg-dom vs seg-dom anterior)
  const { thisWeekAvg, lastWeekAvg, trend, trendPct } = useMemo(() => {
    const prevMonday = new Date(mondayDate + "T12:00:00");
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevMondayStr = prevMonday.toISOString().slice(0, 10);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    const prevSundayStr = prevSunday.toISOString().slice(0, 10);

    const thisWeekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.macros;
    });
    const lastWeekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= prevMondayStr && d <= prevSundayStr && m.macros;
    });

    const thisDays = new Set(thisWeekMeals.map((m) => getLocalDateFromISO(m.data_hora))).size;
    const lastDays = new Set(lastWeekMeals.map((m) => getLocalDateFromISO(m.data_hora))).size;
    const avg1 = thisDays > 0 ? Math.round(sumMacros(thisWeekMeals as { macros: NonNullable<Meal["macros"]> }[]).calorias_kcal / thisDays) : 0;
    const avg2 = lastDays > 0 ? Math.round(sumMacros(lastWeekMeals as { macros: NonNullable<Meal["macros"]> }[]).calorias_kcal / lastDays) : 0;

    let t: "up" | "down" | "flat" = "flat";
    let pct = 0;
    if (avg1 > 0 && avg2 > 0) {
      pct = Math.round(((avg1 - avg2) / avg2) * 100);
      t = pct > 5 ? "up" : pct < -5 ? "down" : "flat";
    }
    return { thisWeekAvg: avg1, lastWeekAvg: avg2, trend: t, trendPct: Math.abs(pct) };
  }, [meals, mondayDate, sundayDate]);

  // Distribuição por tipo de refeição — semana atual (Seg-Dom)
  const mealTypeDist = useMemo(() => {
    const map = new Map<MealType, { kcal: number; count: number }>();
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate;
    });
    for (const m of weekMeals) {
      if (!m.macros) continue;
      const entry = map.get(m.tipo_refeicao) || { kcal: 0, count: 0 };
      entry.kcal += m.macros.calorias_kcal;
      entry.count += 1;
      map.set(m.tipo_refeicao, entry);
    }
    const totalKcal = [...map.values()].reduce((s, e) => s + e.kcal, 0);
    return [...map.entries()]
      .map(([tipo, data]) => ({
        tipo,
        emoji: mealTypeEmoji(tipo),
        label: mealTypeLabel(tipo),
        kcal: data.kcal,
        count: data.count,
        pct: totalKcal > 0 ? Math.round((data.kcal / totalKcal) * 100) : 0,
      }))
      .sort((a, b) => b.kcal - a.kcal);
  }, [meals, mondayDate, sundayDate]);

  // Itens mais frequentes — semana atual
  const topItems = useMemo(() => {
    const itemMap = new Map<string, number>();
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.itens;
    });
    for (const m of weekMeals) {
      for (const item of m.itens || []) {
        const name = item.nome.toLowerCase().trim();
        if (name.length < 2) continue;
        itemMap.set(name, (itemMap.get(name) || 0) + 1);
      }
    }
    return [...itemMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [meals, mondayDate, sundayDate]);

  // Melhor e pior dia
  const { bestDay, worstDay } = useMemo(() => {
    let best: WeekDay | null = null;
    let worst: WeekDay | null = null;
    for (const day of weekDays) {
      const analyzed = day.meals.filter((m) => m.macros && m.status_analise === "analisado");
      if (analyzed.length === 0) continue;
      const score = nutritionScore(analyzed);
      if (!best || score > nutritionScore(best.meals.filter((m) => m.macros && m.status_analise === "analisado"))) best = { ...day, score };
      if (!worst || score < nutritionScore(worst.meals.filter((m) => m.macros && m.status_analise === "analisado"))) worst = { ...day, score };
    }
    return { bestDay: best, worstDay: worst };
  }, [weekDays]);

  // Possíveis lacunas de micronutrientes
  const { nutrientGaps, analyzedCount, sparseData } = useMemo(() => {
    const weekMeals = meals.filter((m) => {
      const d = getLocalDateFromISO(m.data_hora);
      return d >= mondayDate && d <= sundayDate && m.status_analise === "analisado";
    });
    const allItems = weekMeals.flatMap((m) => (m.itens || []).map((i) => i.nome.toLowerCase().trim()));
    const gaps = detectNutrientGaps(allItems);
    return {
      nutrientGaps: gaps,
      analyzedCount: weekMeals.length,
      sparseData: weekMeals.length < 5,
    };
  }, [meals, mondayDate, sundayDate]);

  const hasWeekData = weekDays.some((d) => d.kcal > 0);
  if (!hasWeekData) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Comparação semanal ─────────────────────────────── */}
      <div style={cardStyle}>
        <p style={sectionTitle}>📊 Comparação semanal</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <p style={mutedText}>Esta semana</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>
              {thisWeekAvg || "–"}
            </p>
            <p style={mutedText}>kcal/dia</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
            {trend === "up" ? (
              <TrendingUp style={{ width: 20, height: 20, color: PURPLE }} />
            ) : trend === "down" ? (
              <TrendingDown style={{ width: 20, height: 20, color: TEAL }} />
            ) : (
              <Minus style={{ width: 20, height: 20, color: MUTED }} />
            )}
            {trendPct > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 600, marginTop: 2,
                color: trend === "up" ? PURPLE : TEAL,
              }}>
                {trendPct}%
              </span>
            )}
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <p style={mutedText}>Semana passada</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {lastWeekAvg || "–"}
            </p>
            <p style={mutedText}>kcal/dia</p>
          </div>
        </div>
      </div>

      {/* ── Melhor / Pior dia ──────────────────────────────── */}
      {(bestDay || worstDay) && bestDay?.date !== worstDay?.date && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {bestDay && (
            <div style={{
              borderRadius: 16, padding: 12, textAlign: "center",
              background: `${TEAL} / 0.08`,
              border: `1px solid ${TEAL} / 0.18`,
            }}>
              <p style={mutedText}>🌟 Melhor dia</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#e0d6ff" }}>
                {new Date(bestDay.date + "T12:00:00").toLocaleDateString(getLocale(), { weekday: "short", day: "numeric" })}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: TEAL }}>{bestDay.score}</p>
            </div>
          )}
          {worstDay && (
            <div style={{
              borderRadius: 16, padding: 12, textAlign: "center",
              background: `${AMBER} / 0.08`,
              border: `1px solid ${AMBER} / 0.18`,
            }}>
              <p style={mutedText}>💡 A melhorar</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#e0d6ff" }}>
                {new Date(worstDay.date + "T12:00:00").toLocaleDateString(getLocale(), { weekday: "short", day: "numeric" })}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: AMBER }}>{worstDay.score}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Distribuição por tipo de refeição ──────────────── */}
      {mealTypeDist.length > 0 && (
        <div style={cardStyle}>
          <p style={sectionTitle}>🍽️ Distribuição por refeição</p>
          {mealTypeDist.map((d) => (
            <div key={d.tipo} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#e0d6ff" }}>{d.emoji} {d.label}</span>
                <span style={mutedText}>{d.kcal} kcal · {d.pct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.10)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 9999, transition: "all .3s ease",
                  background: `linear-gradient(90deg, ${PURPLE}, oklch(.65 .15 270))`,
                  width: `${Math.max(d.pct, 4)}%`,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Itens mais frequentes ──────────────────────────── */}
      {topItems.length > 0 && (
        <div style={cardStyle}>
          <p style={sectionTitle}>🔁 O que mais apareceu</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topItems.map(([nome, count]) => (
              <span key={nome} style={{
                fontSize: 12, background: "oklch(.22 .015 270 / .5)",
                color: "#e0d6ff", padding: "4px 10px", borderRadius: 9999,
              }}>
                {nome} <span style={{ fontWeight: 600, color: PURPLE }}>{count}x</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Possíveis lacunas ──────────────────────────────── */}
      {nutrientGaps.length > 0 && (
        <div style={{
          ...cardStyle,
          background: `${AMBER} / 0.06`,
          border: `1px solid ${AMBER} / 0.18`,
        }}>
          <p style={sectionTitle}>🔍 Possíveis lacunas</p>
          {sparseData && (
            <p style={{
              fontSize: 12, color: "oklch(0.55 0.12 65)", lineHeight: 1.6,
              background: `${AMBER} / 0.12`, borderRadius: 10, padding: "8px 12px",
            }}>
              Você registrou apenas {analyzedCount} {analyzedCount === 1 ? "refeição" : "refeições"} com análise esta semana. As lacunas abaixo provavelmente subestimam a realidade.
            </p>
          )}
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
            {sparseData
              ? "Com os dados disponíveis, estes nutrientes provavelmente estão em falta:"
              : "Baseado nos alimentos registrados esta semana, estes nutrientes podem estar em falta:"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {nutrientGaps.map((gap) => (
              <div key={gap.nutrient}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{gap.emoji}</span>
                  <span style={{ fontWeight: 500, color: "#e0d6ff" }}>{gap.nutrient}</span>
                </div>
                <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, margin: 0, paddingLeft: 26 }}>
                  💡 Experimente: {gap.sources.join(", ")}
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
                    Adicionar à lista
                  </button>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
            Análise baseada nos alimentos registrados. Pode não refletir sua ingestão real completa.
          </p>
        </div>
      )}
    </div>
  );
}
