"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cachedFetch } from "@/lib/fetch-cache";
import { getLocalDateFromISO } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { Compass } from "lucide-react";
import type { CheckIn, Meal } from "@/types";

interface SystemInsight {
  titleKey: string;
  bodyKey: string;
  vars: Record<string, string>;
  type: "observation" | "pattern" | "highlight";
}

export function SystemForces() {
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      cachedFetch<CheckIn[]>("/api/check-ins"),
      cachedFetch<Meal[]>("/api/meals"),
    ])
      .then(([ci, m]) => {
        if (Array.isArray(ci)) setCheckIns(ci);
        if (Array.isArray(m)) setMeals(m);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const insights = useMemo(() => {
    if (!loaded) return [];

    const results: SystemInsight[] = [];

    const byDayOfWeek = new Map<number, CheckIn[]>();
    for (const ci of checkIns.slice(0, 28)) {
      const d = new Date(ci.date + "T12:00:00");
      const dow = d.getDay();
      const arr = byDayOfWeek.get(dow) || [];
      arr.push(ci);
      byDayOfWeek.set(dow, arr);
    }

    const weekdayCheckIns: CheckIn[] = [];
    const weekendCheckIns: CheckIn[] = [];
    for (const [dow, cis] of byDayOfWeek) {
      if (dow === 0 || dow === 6) weekendCheckIns.push(...cis);
      else weekdayCheckIns.push(...cis);
    }

    const avgEnergy = (list: CheckIn[]) => {
      const withEnergy = list.filter((c) => c.energy_level !== null && c.energy_level !== undefined);
      if (withEnergy.length === 0) return null;
      return withEnergy.reduce((s, c) => s + (c.energy_level as number), 0) / withEnergy.length;
    };

    const avgSleep = (list: CheckIn[]) => {
      const withSleep = list.filter((c) => c.slept_well !== null && c.slept_well !== undefined);
      if (withSleep.length === 0) return null;
      return withSleep.filter((c) => c.slept_well).length / withSleep.length;
    };

    const avgHabits = (list: CheckIn[]) => {
      const withPositives = list.filter((c) => Array.isArray(c.positives));
      if (withPositives.length === 0) return null;
      return withPositives.reduce((s, c) => s + (c.positives || []).length, 0) / withPositives.length;
    };

    const wdEnergy = avgEnergy(weekdayCheckIns);
    const weEnergy = avgEnergy(weekendCheckIns);
    const wdSleep = avgSleep(weekdayCheckIns);
    const weSleep = avgSleep(weekendCheckIns);

    if (wdEnergy !== null && weEnergy !== null && wdEnergy < weEnergy - 0.5 && weekdayCheckIns.length >= 5) {
      results.push({
        titleKey: "sistema_energia_titulo",
        bodyKey: "sistema_energia_body",
        vars: { wd: wdEnergy.toFixed(1), we: weEnergy.toFixed(1) },
        type: "pattern",
      });
    }

    if (wdSleep !== null && weSleep !== null && wdSleep < weSleep - 0.1 && weekdayCheckIns.length >= 5) {
      results.push({
        titleKey: "sistema_sono_titulo",
        bodyKey: "sistema_sono_body",
        vars: { wd: String(Math.round(wdSleep * 100)), we: String(Math.round(weSleep * 100)) },
        type: "observation",
      });
    }

    const lowEnergyDays = checkIns.slice(0, 28).filter(
      (c) => c.energy_level !== null && c.energy_level !== undefined && c.energy_level <= 4
    );
    if (lowEnergyDays.length >= 5) {
      results.push({
        titleKey: "sistema_bateria_titulo",
        bodyKey: "sistema_bateria_body",
        vars: { n: String(lowEnergyDays.length) },
        type: "highlight",
      });
    }

    const ciDates = new Set(checkIns.slice(0, 28).map((c) => c.date));
    const daysWithMeals = new Set<string>();
    const daysWithCIAndNoMeals = new Set<string>();
    for (const m of meals) {
      daysWithMeals.add(getLocalDateFromISO(m.data_hora));
    }
    for (const date of ciDates) {
      if (!daysWithMeals.has(date)) {
        daysWithCIAndNoMeals.add(date);
      }
    }

    if (daysWithCIAndNoMeals.size >= 4) {
      results.push({
        titleKey: "sistema_comer_titulo",
        bodyKey: "sistema_comer_body",
        vars: { n: String(daysWithCIAndNoMeals.size) },
        type: "observation",
      });
    }

    if (results.length === 0) return [];
    return results.slice(0, 3);
  }, [checkIns, meals, loaded]);

  if (!loaded || insights.length === 0) return null;

  const typeStyles: Record<SystemInsight["type"], { bg: string; border: string; icon: string }> = {
    pattern: { bg: "bg-sky-50/50 dark:bg-sky-950/10", border: "border-sky-200/40 dark:border-sky-800/30", icon: "🔍" },
    observation: { bg: "bg-violet-50/50 dark:bg-violet-950/10", border: "border-violet-200/40 dark:border-violet-800/30", icon: "👁️" },
    highlight: { bg: "bg-amber-50/50 dark:bg-amber-950/10", border: "border-amber-200/40 dark:border-amber-800/30", icon: "💡" },
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-sky-500" />
          <span className="text-sm font-medium">{t("contexto_revela")}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("contexto_descricao")}
        </p>

        <div className="space-y-2.5">
          {insights.map((insight, i) => {
            const style = typeStyles[insight.type];
            return (
              <div
                key={i}
                className={`p-3 rounded-xl border ${style.bg} ${style.border}`}
              >
                <p className="text-xs font-medium mb-1">
                  {style.icon} {t(insight.titleKey)}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(insight.bodyKey, insight.vars)}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground italic">
          {t("contexto_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}
