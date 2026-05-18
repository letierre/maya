"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";

function getWeekLabel(): string {
  const mon = getWeekMondayDate();
  const sun = getWeekSundayDate();
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    return `${parseInt(day)}/${parseInt(m)}`;
  };
  return `${fmt(mon)} – ${fmt(sun)}`;
}

export function WeeklyMirror() {
  const { t, lang } = useTranslation();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekKey = getWeekMondayDate();
    const cacheKey = `weekly_mirror_${weekKey}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setNarrative(cached);
        setLoading(false);
        return;
      }
    } catch { /* localStorage unavailable */ }

    fetch("/api/reflect/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.narrative) {
          setNarrative(data.narrative);
          try { localStorage.setItem(cacheKey, data.narrative); } catch { /* ignore */ }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lang]);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, oklch(.94 .04 280 / .3) 0%, oklch(.97 .02 200 / .2) 100%)",
          border: "1px solid oklch(.6 .08 280 / .15)",
        }}
      >
        <Loader2 className="size-4 animate-spin shrink-0" style={{ color: "oklch(.5 .12 280)" }} />
        <span className="text-sm text-muted-foreground">{t("preparando_espelho")}</span>
      </div>
    );
  }

  if (!narrative) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, oklch(.93 .05 280 / .25) 0%, oklch(.96 .03 200 / .2) 100%)",
        border: "1px solid oklch(.6 .08 280 / .18)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid oklch(.6 .08 280 / .1)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 shrink-0" style={{ color: "oklch(.5 .14 280)" }} />
          <span className="text-sm font-semibold" style={{ color: "oklch(.35 .08 280)" }}>
            {t("espelho_titulo")}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {getWeekLabel()}
        </span>
      </div>

      {/* Narrative */}
      <div className="px-5 py-4 space-y-3">
        {narrative.split(/\n+/).filter(Boolean).map((para, i) => (
          <p
            key={i}
            className="text-sm leading-relaxed"
            style={{ color: i === 0 ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            {para}
          </p>
        ))}
      </div>

      <div className="px-5 pb-4">
        <p className="text-[10px] text-muted-foreground italic">
          {t("espelho_disclaimer")}
        </p>
      </div>
    </div>
  );
}
