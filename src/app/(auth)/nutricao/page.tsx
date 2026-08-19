"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDate, getLocalDateFromISO, getWeekMondayDate } from "@/lib/utils";
import { cachedFetch, invalidateFetchCache } from "@/lib/fetch-cache";
import { sumMacros, nutritionScore, getDailyKcalGoal, DEFAULT_DAILY_KCAL, mealTypeEmoji, mealTypeLabel } from "@/lib/meal-utils";
import { MealCard } from "@/components/MealCard";
import { NutritionSummary } from "@/components/NutritionSummary";
import { WeeklyReport } from "@/components/WeeklyReport";
import { NutritionTips } from "@/components/NutritionTips";
import { NutritionChat } from "@/components/NutritionChat";
import { MonthlyReport } from "@/components/MonthlyReport";
import { FoodMoodCorrelation } from "@/components/FoodMoodCorrelation";
import { WeeklyMirror } from "@/components/WeeklyMirror";
import { NutritionQualityCard } from "@/components/NutritionQualityCard";
import { Plus, Sun, Calendar, Sparkles, Star, X, ShoppingCart } from "lucide-react";
import { ShoppingList } from "@/components/ShoppingList";
import type { Meal } from "@/types";
import { toast } from "sonner";

type TabView = "dia" | "semana" | "mes";

function parseTab(raw: string | null): TabView {
  if (raw === "semana" || raw === "mes") return raw;
  return "dia";
}

// ── Styles ──────────────────────────────────────────────────────

const BG_GRADIENT: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 55% at 80% 0%, oklch(.58 .18 270 / .15) 0%, transparent 55%),
    radial-gradient(ellipse 70% 40% at 0% 100%, oklch(.58 .18 270 / .1) 0%, transparent 50%),
    linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
  `,
  fontFamily: "var(--font-sans)",
  color: "#e0d6ff",
};

const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";

const viewStyle = (active: boolean): React.CSSProperties => ({
  display: active ? "flex" : "none",
  flexDirection: "column",
  gap: 24,
});

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 500, color: "#e0d6ff",
};

const mutedText: React.CSSProperties = {
  fontSize: 12, color: MUTED,
};

const emptyState: React.CSSProperties = {
  fontSize: 14, color: MUTED, textAlign: "center", padding: "16px 0",
};

// ── Wrapper (Suspense for useSearchParams) ──────────────────────

export default function NutricaoPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", ...BG_GRADIENT }} />}>
      <NutricaoPage />
    </Suspense>
  );
}

// ── Page ────────────────────────────────────────────────────────

function NutricaoPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab = parseTab(rawTab);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabView>(initialTab);
  const [todayDisplay, setTodayDisplay] = useState("");
  const [kcalGoal, setKcalGoal] = useState(DEFAULT_DAILY_KCAL);
  const [showChat, setShowChat] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [favoriteMeals, setFavoriteMeals] = useState<Meal[]>([]);
  const [addingFav, setAddingFav] = useState<string | null>(null);

  // Sync tab when URL param changes
  useEffect(() => {
    setTab(parseTab(rawTab));
  }, [rawTab]);

  useEffect(() => {
    setTodayDisplay(new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long",
    }));
  }, []);

  useEffect(() => {
    cachedFetch<{ context?: Record<string, unknown> }>("/api/preferences")
      .then((data) => {
        const ctx = (data?.context as Record<string, unknown>) || {};
        setKcalGoal(getDailyKcalGoal(ctx));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cachedFetch<unknown[]>("/api/meals")
      .then((data) => {
        if (Array.isArray(data)) setMeals(data as Meal[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    cachedFetch<unknown[]>("/api/meals?favorited=true")
      .then((data) => {
        if (Array.isArray(data)) setFavoriteMeals(data as Meal[]);
      })
      .catch(() => {});
  }, []);

  const switchTab = (mode: TabView) => {
    setTab(mode);
    const url = new URL(window.location.href);
    if (mode === "dia") url.searchParams.delete("tab");
    else url.searchParams.set("tab", mode);
    window.history.replaceState({}, "", url.toString());
  };

  const handleToggleFavorite = async (mealId: string, favorited: boolean) => {
    // Optimistic update in both lists
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, favorited } : m)));
    setFavoriteMeals((prev) =>
      favorited
        ? prev // will refresh from API
        : prev.filter((m) => m.id !== mealId)
    );
    try {
      await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mealId, favorited }),
      });
      // Refresh favorites after toggle
      if (favorited) {
        invalidateFetchCache("/api/meals?favorited=true");
        const data = await cachedFetch<unknown[]>("/api/meals?favorited=true");
        if (Array.isArray(data)) setFavoriteMeals(data as Meal[]);
      }
    } catch {
      // Rollback
      setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, favorited: !favorited } : m)));
    }
  };

  const handleFavoriteQuickAdd = async (fav: Meal) => {
    setAddingFav(fav.id);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_hora: new Date().toISOString(),
          tipo_refeicao: fav.tipo_refeicao,
          itens: fav.itens || [],
          macros: fav.macros || undefined,
          classificacao: fav.classificacao || undefined,
          observacao: fav.observacao || "",
          texto_livre: fav.texto_livre || fav.itens?.map((i) => i.nome).join(", ") || "",
          fotos: fav.fotos || [],
          status_analise: "analisado",
        }),
      });
      if (res.ok) {
        toast.success(`${mealTypeEmoji(fav.tipo_refeicao)} Refeição adicionada!`);
        // Refresh today's meals (sem cache)
        invalidateFetchCache("/api/meals");
        cachedFetch<unknown[]>("/api/meals").then((data) => {
          if (Array.isArray(data)) setMeals(data as Meal[]);
        });
      } else {
        toast.error("Erro ao adicionar");
      }
    } catch {
      toast.error("Erro ao adicionar");
    }
    setAddingFav(null);
  };

  const handleAddToShoppingList = async (items: { item_name: string; category: string }[]) => {
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.length} item(ns) adicionado(s) à lista! 🛒`);
        invalidateFetchCache("/api/shopping-list");
      } else {
        toast.error("Erro ao adicionar");
      }
    } catch {
      toast.error("Erro ao adicionar");
    }
  };

  // ── Derived data ────────────────────────────────────────────

  const todayMeals = useMemo(() => {
    const today = getLocalDate();
    return meals.filter((m) => getLocalDateFromISO(m.data_hora) === today);
  }, [meals]);

  const mealsByDay = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const m of meals) {
      const dia = getLocalDateFromISO(m.data_hora);
      const arr = map.get(dia) || [];
      arr.push(m);
      map.set(dia, arr);
    }
    return map;
  }, [meals]);

  const weekDays = useMemo(() => {
    const mondayDate = getWeekMondayDate();
    const days: { date: string; label: string; meals: Meal[]; kcal: number; score: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayMeals = mealsByDay.get(dateStr) || [];
      const analyzed = dayMeals.filter((m) => m.macros && m.status_analise === "analisado");
      days.push({
        date: dateStr,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }),
        meals: dayMeals,
        kcal: sumMacros(dayMeals.filter((m) => m.macros)).calorias_kcal,
        score: nutritionScore(analyzed),
      });
    }
    return days;
  }, [mealsByDay]);

  const monthMeals = useMemo(() => {
    const now = new Date();
    return meals.filter((m) => {
      const d = new Date(m.data_hora);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [meals]);

  const monthStats = useMemo(() => {
    const analyzed = monthMeals.filter((m) => m.macros);
    const total = sumMacros(analyzed);
    const avgKcal = analyzed.length > 0 ? Math.round(total.calorias_kcal / analyzed.length) : 0;
    const classCount = new Map<string, number>();
    for (const m of monthMeals) {
      if (m.classificacao) {
        classCount.set(m.classificacao, (classCount.get(m.classificacao) || 0) + 1);
      }
    }
    return { total: analyzed.length, avgKcal, classCount };
  }, [monthMeals]);

  // ── Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", ...BG_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: MUTED, fontSize: 13 }}>{t("carregando")}</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", minHeight: "100dvh", overflowX: "hidden", paddingBottom: 224, ...BG_GRADIENT }}>

      {/* FABs */}
      <button type="button" onClick={() => setShowChat(true)}
        style={{
          position: "fixed", bottom: 148, right: 24, zIndex: 40,
          width: 44, height: 44, borderRadius: "50%",
          background: "#1a1530", border: "1.5px solid rgba(167,139,250,0.3)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,92,255,0.25)",
        }}>
        <Sparkles size={20} color="#A78BFA" />
      </button>

      <button type="button" onClick={() => router.push("/nutricao/registrar")}
        style={{
          position: "fixed", bottom: 84, right: 20, zIndex: 40,
          width: 56, height: 56, borderRadius: "50%",
          background: "#7C5CFF", border: 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
        }}>
        <Plus size={24} color="#fff" />
      </button>

      {/* Header */}
      <div style={{ padding: "24px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, color: MUTED }}>
            {todayDisplay}
          </p>
          <h1 style={{ marginTop: 4, fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#e0d6ff" }}>
            Nutrição
          </h1>
        </div>
        <button type="button" onClick={() => setShowShoppingList(true)}
          style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "oklch(.17 .015 270 / .6)", border: `1px solid ${BORDER}`,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <ShoppingCart size={20} color="#A78BFA" />
        </button>
      </div>

      {/* ── Segmented control Dia / Semana / Mês ──────────── */}
      <div style={{ padding: "0 24px 16px" }}>
        <div style={{
          display: "flex", borderRadius: 14, background: "#1a1530",
          border: `1px solid ${BORDER}`, padding: 3,
        }}>
          {([
            { key: "dia", icon: Sun, label: "Dia" },
            { key: "semana", icon: Calendar, label: "Semana" },
            { key: "mes", icon: Calendar, label: "Mês" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} type="button" onClick={() => switchTab(key as TabView)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, border: 0,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 5, fontFamily: "inherit",
                fontSize: 12, fontWeight: 600,
                background: tab === key
                  ? "linear-gradient(135deg, #7C5CFF, #A78BFA)"
                  : "transparent",
                color: tab === key ? "#fff" : MUTED,
                transition: "all 0.2s ease",
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ padding: "0 16px" }}>

        {/* ========== DIA ========== */}
        <div style={viewStyle(tab === "dia")}>
          <NutritionSummary meals={todayMeals} label={t("resumo_do_dia")} kcalGoal={kcalGoal} />
          <NutritionQualityCard todayMeals={todayMeals} t={t} />

          {/* ── Favoritas ─────────────────────────────────── */}
          {favoriteMeals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#e0d6ff", display: "flex", alignItems: "center", gap: 6 }}>
                <Star style={{ width: 16, height: 16, color: "#fbbf24", fill: "#fbbf24" }} />
                Refeições favoritas
              </p>
              <div style={{
                display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4,
                scrollbarWidth: "none", msOverflowStyle: "none",
              }}>
                {favoriteMeals.map((fav) => {
                  const isLoading = addingFav === fav.id;
                  return (
                    <div
                      key={fav.id}
                      style={{
                        flexShrink: 0, textAlign: "left", minWidth: 150, maxWidth: 200,
                        borderRadius: 14, padding: 12,
                        background: "oklch(.17 .015 270 / .6)",
                        border: `1px solid ${BORDER}`,
                        opacity: isLoading ? 0.5 : 1,
                        position: "relative",
                      }}
                    >
                      {/* Unfavorite button — top right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(fav.id, false);
                        }}
                        style={{
                          position: "absolute", top: 8, right: 8,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "oklch(.22 .015 270 / .5)", border: 0,
                          cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          padding: 0,
                        }}
                        aria-label="Remover dos favoritos"
                      >
                        <X style={{ width: 12, height: 12, color: MUTED }} />
                      </button>

                      {/* Quick-add area */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleFavoriteQuickAdd(fav)}
                        style={{
                          width: "100%", textAlign: "left", padding: 0,
                          background: "none", border: 0,
                          cursor: isLoading ? "default" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, paddingRight: 24 }}>
                          <span style={{ fontSize: 14 }}>{mealTypeEmoji(fav.tipo_refeicao)}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#e0d6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fav.itens?.length ? fav.itens.map((i) => i.nome).join(", ") : mealTypeLabel(fav.tipo_refeicao)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: MUTED }}>
                            {fav.macros ? `${fav.macros.calorias_kcal} kcal` : "Sem macros"}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: "#A78BFA",
                            display: "inline-flex", alignItems: "center", gap: 2,
                          }}>
                            <Plus style={{ width: 12, height: 12 }} />
                            {isLoading ? "..." : "Add"}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de refeições */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={sectionTitle}>{t("refeicoes_hoje")}</p>
            {todayMeals.length > 0 && todayMeals.length < 3 && new Date().getHours() >= 14 && (
              <p style={{
                fontSize: 12, color: MUTED, background: "oklch(.22 .015 270 / .5)",
                borderRadius: 12, padding: "10px 12px", lineHeight: 1.6,
              }}>
                Você registrou {todayMeals.length} {todayMeals.length === 1 ? "refeição" : "refeições"} hoje — o resumo reflete apenas o que foi anotado. Se comeu mais, vale registrar para uma análise mais completa.
              </p>
            )}
            {todayMeals.length === 0 ? (
              <div style={{
                borderRadius: 16, border: "1px dashed rgba(167,139,250,0.3)",
                background: "rgba(124,92,255,0.05)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0",
              }}>
                <span style={{ fontSize: 36 }}>🍽️</span>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontWeight: 500, color: "#e0d6ff" }}>{t("nenhuma_refeicao")}</p>
                  <p style={{ fontSize: 14, color: MUTED }}>{t("registre_primeira")}</p>
                </div>
                <button type="button" onClick={() => router.push("/nutricao/registrar")}
                  style={{
                    padding: "10px 20px", borderRadius: 12, border: 0,
                    background: "#7C5CFF", color: "#fff",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>
                  {t("registrar_refeicao")}
                </button>
              </div>
            ) : (
              todayMeals
                .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
                .map((meal) => (
                  <MealCard key={meal.id} meal={meal} onClick={() => router.push(`/nutricao/${meal.id}`)} onToggleFavorite={handleToggleFavorite} />
                ))
            )}
          </div>

          <NutritionTips />
          <FoodMoodCorrelation meals={meals} />
        </div>

        {/* ========== SEMANA ========== */}
        <div style={viewStyle(tab === "semana")}>
          <NutritionSummary
            meals={weekDays.flatMap((d) => d.meals)}
            label={t("resumo_da_semana")}
            kcalGoal={kcalGoal}
          />
          <WeeklyMirror />
          <WeeklyReport meals={meals} weekDays={weekDays} onAddToShoppingList={handleAddToShoppingList} />

          {/* Lista de refeições da semana */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={sectionTitle}>Refeições da semana</p>
            {weekDays.flatMap((d) => d.meals).length === 0 ? (
              <p style={emptyState}>{t("nenhuma_refeicao")}</p>
            ) : (
              weekDays
                .filter((d) => d.meals.length > 0)
                .reverse()
                .map((day) => (
                  <div key={day.date} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={mutedText}>
                      {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long", day: "numeric", month: "short",
                      })}
                    </p>
                    {day.meals
                      .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
                      .map((meal) => (
                        <MealCard key={meal.id} meal={meal} onClick={() => router.push(`/nutricao/${meal.id}`)} onToggleFavorite={handleToggleFavorite} />
                      ))}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* ========== MÊS ========== */}
        <div style={viewStyle(tab === "mes")}>
          <NutritionSummary meals={monthMeals} label={t("resumo_do_mes")} kcalGoal={kcalGoal} />
          <MonthlyReport meals={monthMeals} monthStats={monthStats} onAddToShoppingList={handleAddToShoppingList} />
          {monthStats.total === 0 && (
            <p style={emptyState}>{t("sem_dados_suficientes")}</p>
          )}
        </div>

      </div>

      {/* ── AI Chat Modal ────────────────────────────────── */}
      {showChat && (
        <div onClick={() => setShowChat(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480, maxHeight: "85dvh",
              background: "#151520", borderRadius: "24px 24px 0 0",
              display: "flex", flexDirection: "column", overflow: "hidden",
              border: "1px solid rgba(167,139,250,0.15)",
            }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(167,139,250,0.1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#A78BFA" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>Assistente IA</span>
              </div>
              <button type="button" onClick={() => setShowChat(false)}
                style={{ background: "none", border: 0, color: MUTED, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
                ✕
              </button>
            </div>
            {/* Chat body */}
            <div style={{ flex: 1, overflow: "auto", padding: "0 16px" }}>
              <NutritionChat />
            </div>
          </div>
        </div>
      )}

      {/* ── Shopping List Modal ─────────────────────────── */}
      {showShoppingList && (
        <div onClick={() => setShowShoppingList(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480, maxHeight: "85dvh",
              background: "#151520", borderRadius: "24px 24px 0 0",
              display: "flex", flexDirection: "column", overflow: "hidden",
              border: "1px solid rgba(167,139,250,0.15)",
            }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid rgba(167,139,250,0.1)",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={18} color="#A78BFA" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>{t("lista_compras")}</span>
              </div>
              <button type="button" onClick={() => setShowShoppingList(false)}
                style={{ background: "none", border: 0, color: MUTED, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
                ✕
              </button>
            </div>
            {/* Shopping list body */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
              <ShoppingList />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
