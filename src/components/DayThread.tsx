"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cachedFetch } from "@/lib/fetch-cache";
import { getLocalDateFromISO } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { sumMacros } from "@/lib/meal-utils";
import type { CheckIn, Meal } from "@/types";

interface DayNode {
  date: string;
  label: string;
  energy: number | null;
  sleptWell: boolean | null;
  kcal: number;
  mealCount: number;
  hasCheckIn: boolean;
}

export function DayThread() {
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<Meal[]>("/api/meals"),
    ])
      .then(([ciData, mealData]) => {
        if (Array.isArray(ciData)) setCheckIns(ciData);
        if (Array.isArray(mealData)) setMeals(mealData);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const days = useMemo(() => {
    if (!loaded) return [];

    const mealsByDay = new Map<string, Meal[]>();
    for (const m of meals) {
      const day = getLocalDateFromISO(m.data_hora);
      const arr = mealsByDay.get(day) || [];
      arr.push(m);
      mealsByDay.set(day, arr);
    }

    const checkInsByDay = new Map<string, CheckIn>();
    for (const ci of checkIns) {
      checkInsByDay.set(ci.date, ci);
    }

    const nodes: DayNode[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateFromISO(d.toISOString());
      const ci = checkInsByDay.get(dateStr);
      const dayMeals = mealsByDay.get(dateStr) || [];
      const analyzed = dayMeals.filter((m) => m.macros && m.status_analise === "analisado");
      const total = sumMacros(analyzed);

      nodes.push({
        date: dateStr,
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }),
        energy: ci?.energy_level ?? null,
        sleptWell: ci?.slept_well ?? null,
        kcal: Math.round(total.calorias_kcal),
        mealCount: analyzed.length,
        hasCheckIn: !!ci,
      });
    }
    return nodes;
  }, [checkIns, meals, loaded]);

  if (!loaded || days.length === 0) return null;

  const hasData = days.some((d) => d.hasCheckIn || d.mealCount > 0);
  if (!hasData) return null;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">🧵 {t("fio_titulo")}</p>
        <p className="text-[11px] text-muted-foreground">
          {t("fio_descricao")}
        </p>

        <div className="space-y-0">
          {days.map((day, i) => {
            const prevDay = i > 0 ? days[i - 1] : null;
            const sleepArrow =
              prevDay?.sleptWell === false && day.energy !== null && day.energy <= 5
                ? "↓"
                : prevDay?.sleptWell === true && day.energy !== null && day.energy >= 6
                  ? "↑"
                  : null;

            return (
              <div key={day.date}>
                {i > 0 && (
                  <div className="flex items-center gap-2 pl-4 ml-2 border-l-2 border-muted py-0.5">
                    <div className="h-4 w-0" />
                    {sleepArrow && (
                      <span className="text-[10px] text-muted-foreground">
                        {sleepArrow} {t("sono_vespera")}
                      </span>
                    )}
                    {prevDay && !prevDay.hasCheckIn && !prevDay.mealCount && day.hasCheckIn && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("retomou_dia")}
                      </span>
                    )}
                  </div>
                )}

                <div className={`flex items-center gap-3 py-2 px-3 rounded-xl ${
                  day.hasCheckIn || day.mealCount > 0 ? "bg-muted/30" : "opacity-40"
                }`}>
                  <span className="text-xs font-medium w-8 text-muted-foreground">
                    {day.label}
                  </span>

                  {day.hasCheckIn ? (
                    <div className="flex items-center gap-2 text-xs">
                      {day.sleptWell !== null && (
                        <span>{day.sleptWell ? "😴" : "😵"}</span>
                      )}
                      {day.energy !== null && (
                        <span className={`font-medium ${
                          day.energy >= 7 ? "text-emerald-600" :
                          day.energy >= 5 ? "text-amber-600" :
                          "text-red-500"
                        }`}>
                          {day.energy}/10
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{t("sem_registro")}</span>
                  )}

                  {day.mealCount > 0 && (
                    <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
                      <span>{day.mealCount} {t("ref_abrev")}</span>
                      <span>{day.kcal} kcal</span>
                    </div>
                  )}

                  {!day.mealCount && day.hasCheckIn && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {t("sem_refeicoes_curto")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
