"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getLocalDate } from "@/lib/utils";
import { cachedFetch } from "@/lib/fetch-cache";
import { sumMacros, nutritionScore, getDailyKcalGoal, DEFAULT_DAILY_KCAL } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import type { Meal } from "@/types";

export function NutritionMiniCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [kcalGoal, setKcalGoal] = useState(DEFAULT_DAILY_KCAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const today = getLocalDate();
    Promise.all([
      cachedFetch<Meal[]>(`/api/meals?date=${today}`),
      cachedFetch<{ context?: Record<string, unknown> }>("/api/preferences"),
    ])
      .then(([mealsData, prefsData]) => {
        if (Array.isArray(mealsData)) setMeals(mealsData);
        const ctx = (prefsData?.context || {}) as Record<string, unknown>;
        setKcalGoal(getDailyKcalGoal(ctx));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const analyzed = meals.filter((m) => m.macros && m.status_analise === "analisado");
  const pending = meals.filter((m) => !m.macros || m.status_analise !== "analisado");
  const total = sumMacros(analyzed);

  // Sem refeições
  if (meals.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-primary/30 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => router.push("/nutricao/registrar")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍽️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t("registre_primeira")}</p>
              <p className="text-xs text-muted-foreground">{t("leva_menos_3min")}</p>
            </div>
            <span className="text-muted-foreground text-sm">+</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Tem refeições mas nenhuma analisada
  if (analyzed.length === 0) {
    return (
      <Card style={{ borderRadius: 16, background: "oklch(.58 .18 270 / .06)", border: "1px solid oklch(.58 .18 270 / .15)", cursor: "pointer", transition: "all .15s ease" }}
        onClick={() => router.push("/nutricao")}
        className="hover:bg-muted/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {meals.length} {t(meals.length > 1 ? "nu_refeicoes" : "nu_refeicao")} {t("pendente_analise").toLowerCase()}
              </p>
              <p className="text-xs text-muted-foreground">{t("nu_toque_analisar")}</p>
            </div>
            <span className="text-muted-foreground text-sm">→</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Refeições analisadas — card completo
  const score = nutritionScore(analyzed);
  const scoreColorVal = score >= 80 ? "oklch(0.45 0.15 160)" : score >= 60 ? "oklch(0.60 0.12 70)" : "oklch(0.50 0.15 15)";
  const scoreBgVal = scoreColorVal; // same for stroke
  const ringLen = 94.2;
  const dashLen = (score / 100) * ringLen;

  const kcalPct = Math.min(Math.round((total.calorias_kcal / kcalGoal) * 100), 100);

  return (
    <Card className="rounded-2xl hover:bg-muted/5 transition-colors cursor-pointer"
      onClick={() => router.push("/nutricao")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">🍽️ {t("nutricao")} {t("resumo_do_dia").toLowerCase()}</p>
          <span className="text-xs text-muted-foreground">{t("ver_refeicoes")}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Anel de score */}
          <div className="relative size-14 shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/20" />
              <circle cx="18" cy="18" r="15" fill="none"
                stroke={scoreBgVal}
                strokeWidth="2.5"
                strokeDasharray={`${dashLen} ${ringLen}`}
                strokeLinecap="round" />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: scoreColorVal }}>
              {score}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <p className="text-xl font-bold tracking-tight">
                {total.calorias_kcal} <span className="text-sm font-normal text-muted-foreground">kcal</span>
              </p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                <span>C: {total.carboidratos_g}g</span>
                <span>P: {total.proteinas_g}g</span>
                <span>G: {total.gorduras_g}g</span>
              </div>
            </div>
            {/* Barra de progresso da meta */}
            <div className="space-y-0.5">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  style={{
                    height: "100%", borderRadius: 9999, transition: "all .7s ease",
                    background: kcalPct >= 100 ? "oklch(0.60 0.12 70)" : "oklch(0.45 0.15 160)",
                    width: `${Math.min(kcalPct, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("nu_da_meta_diaria", { pct: String(kcalPct) })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{analyzed.length} {t(analyzed.length > 1 ? "nu_refeicoes" : "nu_refeicao")}</span>
          {pending.length > 0 && (
            <>
              <span>·</span>
              <span>{pending.length} {t("pendente_analise").toLowerCase()}</span>
            </>
          )}
          {score >= 80 ? " · 🌟" : score >= 60 ? " · 👍" : " · 💡"}
        </div>
      </CardContent>
    </Card>
  );
}
