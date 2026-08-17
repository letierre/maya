"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { getReflectionWeek } from "@/lib/utils";
import { Loader2, Sparkles, ChevronDown } from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const FOREGROUND = "#e0d6ff";

interface MirrorData {
  narrative: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
}

function formatRange(weekStart: string, weekEnd: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    return `${parseInt(day)}/${parseInt(m)}`;
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

// "gerado a X minutos (ou horas)" — relativo, no idioma do usuário.
function timeAgoLabel(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return lang === "pt" ? "agora mesmo" : lang === "es" ? "ahora mismo" : "just now";
  }
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const u =
      lang === "en"
        ? hrs === 1 ? "hour" : "hours"
        : hrs === 1 ? "hora" : "horas";
    return `${hrs} ${u}`;
  }
  const days = Math.floor(hrs / 24);
  const u =
    lang === "pt" ? (days === 1 ? "dia" : "dias")
    : lang === "es" ? (days === 1 ? "día" : "días")
    : days === 1 ? "day" : "days";
  return `${days} ${u}`;
}

export function WeeklyMirror() {
  const { t, lang } = useTranslation();
  const [data, setData] = useState<MirrorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { monday, daysSinceSunday } = getReflectionWeek();

    // Fora da janela (quinta a sábado) não existe espelho — some do feed.
    if (daysSinceSunday > 3) {
      setLoading(false);
      return;
    }

    const cacheKey = `weekly_mirror_${monday}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as MirrorData;
        if (parsed?.narrative && parsed?.weekStart) {
          setData(parsed);
          setLoading(false);
          return;
        }
      }
    } catch { /* cache vazio ou formato antigo — regenera abaixo */ }

    fetch("/api/reflect/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.narrative && res.weekStart) {
          const next: MirrorData = {
            narrative: res.narrative,
            weekStart: res.weekStart,
            weekEnd: res.weekEnd,
            generatedAt: res.generatedAt ?? new Date().toISOString(),
          };
          setData(next);
          try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* ignore */ }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lang]);

  if (loading) {
    return (
      <div
        style={{
          borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(135deg, oklch(.58 .18 270 / .08) 0%, oklch(.65 .15 280 / .05) 100%)",
          border: "1px solid oklch(.58 .18 270 / .15)",
        }}
      >
        <Loader2 className="animate-spin" style={{ width: 16, height: 16, flexShrink: 0, color: "oklch(.58 .18 270)" }} />
        <span style={{ fontSize: 13, color: MUTED }}>{t("preparando_espelho")}</span>
      </div>
    );
  }

  if (!data) return null;

  const firstPara = data.narrative.split(/\n+/).filter(Boolean)[0] ?? "";
  const range = formatRange(data.weekStart, data.weekEnd);
  const ago = timeAgoLabel(data.generatedAt, lang);

  return (
    <div
      style={{
        borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(135deg, oklch(.58 .18 270 / .10) 0%, oklch(.60 .15 280 / .06) 100%)",
        border: "1px solid oklch(.58 .18 270 / .18)",
      }}
    >
      {/* Header — sempre visível, clicável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", padding: "16px 20px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "transparent", border: 0, cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles style={{ width: 16, height: 16, flexShrink: 0, color: "oklch(.58 .18 270)" }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", color: "oklch(.50 .14 280)" }}>
              {t("espelho_titulo")}
            </span>
            <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {t("espelho_semana_de", { range })}
            </span>
            <span style={{ fontSize: 10, color: MUTED, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>
              {t("gerado_ha", { time: ago })}
            </span>
          </div>
        </div>
        <ChevronDown
          style={{
            width: 16, height: 16, flexShrink: 0, transition: "transform .2s ease",
            color: "oklch(.55 .12 280)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Preview quando fechado */}
      {!open && (
        <div
          style={{ padding: "0 20px 16px", borderTop: "1px solid oklch(.58 .18 270 / .08)" }}
        >
          <p
            style={{
              fontSize: 13, lineHeight: 1.6, color: MUTED, marginTop: 12,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {firstPara}
          </p>
        </div>
      )}

      {/* Narrativa completa quando aberto */}
      {open && (
        <div style={{ borderTop: "1px solid oklch(.58 .18 270 / .10)" }}>
          <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {data.narrative.split(/\n+/).filter(Boolean).map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 13, lineHeight: 1.6,
                  color: FOREGROUND,
                }}
              >
                {para}
              </p>
            ))}
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            <p style={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
              {t("espelho_disclaimer")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
