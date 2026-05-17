"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cachedFetch } from "@/lib/fetch-cache";
import { getLocalDate } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { Sparkles } from "lucide-react";
import type { CheckIn } from "@/types";

export function GentleDayCard() {
  const { t } = useTranslation();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const today = getLocalDate();
    cachedFetch<CheckIn[]>("/api/check-ins")
      .then((data) => {
        if (Array.isArray(data)) {
          setCheckIn(data.find((c: CheckIn) => c.date === today) || null);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const energy = checkIn?.energy_level;
  if (energy !== null && energy !== undefined && energy > 5) return null;

  const isVeryLow = energy !== null && energy !== undefined && energy <= 3;
  const isLow = energy !== null && energy !== undefined && energy <= 5 && energy > 3;
  const noCheckIn = !checkIn;

  const title = noCheckIn
    ? t("bom_dia_titulo")
    : isVeryLow
      ? t("corpo_pede_gentileza")
      : t("dia_de_leveza");

  const body = noCheckIn
    ? t("ainda_nao_fez_msg")
    : isVeryLow
      ? t("energia_bem_baixa_msg")
      : t("energia_meio_baixa_msg");

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 border-blue-200/40 dark:border-blue-800/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {title}
          </span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {body}
        </p>

        <div className="flex gap-2 text-[11px] text-muted-foreground">
          <span className="bg-white/60 dark:bg-white/5 rounded-full px-2.5 py-1">
            🫁 2 min de respiração
          </span>
          <span className="bg-white/60 dark:bg-white/5 rounded-full px-2.5 py-1">
            💧 um copo d'água
          </span>
          <span className="bg-white/60 dark:bg-white/5 rounded-full px-2.5 py-1">
            🎵 uma música
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground italic">
          {t("ideias_nao_obrigacao")}
        </p>
      </CardContent>
    </Card>
  );
}
