"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { mealTypeEmoji } from "@/lib/meal-utils";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Meal, MealType } from "@/types";

interface FrequentMeal {
  tipo: MealType;
  itens: string[];
  macros: { calorias_kcal: number } | null;
  count: number;
}

function getFrequentMeals(meals: Meal[], minCount = 2): FrequentMeal[] {
  const groups = new Map<string, { tipo: MealType; itens: string[]; macros: typeof meals[0]["macros"]; count: number }>();

  for (const m of meals) {
    if (!m.itens || m.itens.length === 0) continue;
    const names = m.itens.map((i) => i.nome.trim().toLowerCase()).filter((n) => n.length > 1).sort();
    if (names.length === 0) continue;
    const key = `${m.tipo_refeicao}:${names.join("|")}`;

    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (m.macros && !existing.macros) existing.macros = m.macros;
    } else {
      groups.set(key, { tipo: m.tipo_refeicao, itens: names, macros: m.macros, count: 1 });
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((g) => ({
      tipo: g.tipo,
      itens: g.itens,
      macros: g.macros ? { calorias_kcal: g.macros.calorias_kcal } : null,
      count: g.count,
    }));
}

export function QuickAddMeals({ meals }: { meals: Meal[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);

  const frequent = useMemo(() => getFrequentMeals(meals), [meals]);

  if (frequent.length === 0) return null;

  const handleQuickAdd = async (fav: FrequentMeal) => {
    const key = `${fav.tipo}:${fav.itens.join("|")}`;
    setAdding(key);

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_hora: new Date().toISOString(),
          tipo_refeicao: fav.tipo,
          itens: fav.itens.map((nome) => ({ nome })),
          macros: fav.macros || undefined,
          texto_livre: fav.itens.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(", "),
          status_analise: "analisado",
        }),
      });

      if (res.ok) {
        toast.success(`${mealTypeEmoji(fav.tipo)} ${t("nu_refeicao_adicionada")}`);
        router.refresh();
      } else {
        toast.error(t("nu_erro_adicionar"));
      }
    } catch {
      toast.error(t("nu_erro_adicionar"));
    }
    setAdding(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("nu_suas_refeicoes")}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {frequent.map((fav, i) => {
          const key = `${fav.tipo}:${fav.itens.join("|")}`;
          const isLoading = adding === key;
          return (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickAdd(fav)}
              className="shrink-0 text-left bg-muted/50 hover:bg-muted rounded-xl p-3 transition-colors disabled:opacity-50 min-w-[140px] max-w-[180px]"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">{mealTypeEmoji(fav.tipo)}</span>
                <span className="text-[11px] font-medium truncate">{fav.itens.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {fav.macros ? `${fav.macros.calorias_kcal} kcal` : `${fav.count}x`}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-primary font-medium">
                  <Plus className="size-3" />
                  {isLoading ? "..." : t("nu_add")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
