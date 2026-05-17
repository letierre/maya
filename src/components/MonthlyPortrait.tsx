"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/useTranslation";
import { Loader2, Brush } from "lucide-react";

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyPortrait() {
  const { t, lang } = useTranslation();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const monthKey = getMonthKey();
    const cacheKey = `monthly_portrait_${monthKey}_${lang}`;

    // Verifica localStorage primeiro (evita até chamar a API)
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setNarrative(cached);
      setLoading(false);
      return;
    }

    fetch("/api/reflect/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.narrative) {
          setNarrative(data.narrative);
          localStorage.setItem(cacheKey, data.narrative);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lang]);

  if (loading) {
    return (
      <Card className="rounded-2xl bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10 border-amber-200/40 dark:border-amber-800/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-amber-500" />
          <span className="text-sm text-muted-foreground">{t("preparando_retrato")}</span>
        </CardContent>
      </Card>
    );
  }

  if (!narrative) return null;

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10 border-amber-200/40 dark:border-amber-800/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brush className="size-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {t("retrato_titulo")}
          </span>
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-3 whitespace-pre-wrap">
          {narrative}
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          {t("retrato_disclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}
