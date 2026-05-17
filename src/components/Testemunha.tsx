"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";
import { Heart } from "lucide-react";
import type { CheckIn } from "@/types";

export function Testemunha() {
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    cachedFetch<CheckIn[]>("/api/check-ins")
      .then((data) => {
        if (Array.isArray(data)) setCheckIns(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const recognition = useMemo(() => {
    if (!loaded || checkIns.length < 2) return null;

    const recent = checkIns.slice(0, 7);

    const hardDays = recent.filter((ci) => {
      const energy = ci.energy_level;
      const feeling = (ci.feeling || "").toLowerCase();
      return (
        (energy !== null && energy !== undefined && energy <= 4) ||
        feeling.includes("triste") ||
        feeling.includes("ansios") ||
        feeling.includes("cansad") ||
        feeling.includes("mal") ||
        feeling.includes("ruim")
      );
    });

    const honestDays = recent.filter((ci) => {
      if (!ci.positives) return false;
      const positives = Array.isArray(ci.positives) ? ci.positives : [];
      return positives.length <= 3;
    });

    if (hardDays.length === 0 && honestDays.length === 0) return null;

    const messages: string[] = [];

    if (hardDays.length >= 2) {
      messages.push(
        t("testemunha_hard_days_plural", { n: String(hardDays.length) })
      );
    } else if (hardDays.length === 1) {
      messages.push(t("testemunha_hard_days_single"));
    }

    if (honestDays.length >= 3 && hardDays.length === 0) {
      messages.push(t("testemunha_honest"));
    }

    if (recent.length >= 5) {
      messages.push(
        t("testemunha_presence", { n: String(recent.length) })
      );
    }

    return messages.length > 0 ? messages : null;
  }, [checkIns, loaded, t]);

  if (!recognition) return null;

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-rose-50/30 to-transparent dark:from-rose-950/10 border-rose-200/40 dark:border-rose-800/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="size-4 text-rose-500" />
          <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
            {t("so_pra_voce_saber")}
          </span>
        </div>
        <div className="space-y-2">
          {recognition.map((msg, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              {msg}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
