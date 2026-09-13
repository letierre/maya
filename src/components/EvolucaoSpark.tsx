"use client";

import { useTranslation } from "@/lib/useTranslation";

interface EvolucaoSparkProps {
  data: number[];
  loading?: boolean;
}

function SparkSmall({ data, color = "oklch(.58 .18 270)" }: { data: number[]; color?: string }) {
  const W = 140;
  const H = 38;
  const P = 2;
  const max = Math.max(...data, 1);
  const xStep = (W - P * 2) / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = P + i * xStep;
    const y = P + (H - P * 2) * (1 - v / max);
    return [x, y] as const;
  });
  const line = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  const fill = `${line} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: 38, display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ssFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#ssFill)" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EvolucaoSpark({ data, loading }: EvolucaoSparkProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="px-3.5 pt-5">
        <div
          className="rounded-[18px] px-4 pt-4 pb-[18px] border animate-pulse"
          style={{
            background: "var(--surface)",
            borderColor: "var(--surface-border)",
          }}
        >
          <div className="h-3 rounded-full w-24 mb-3" style={{ background: "var(--surface-3)" }} />
          <div className="h-8 rounded-lg w-full" style={{ background: "var(--surface-3)" }} />
        </div>
      </div>
    );
  }

  const hasData = data.some((v) => v > 0);

  const sparkAvg =
    data.filter((v) => v > 0).length > 0
      ? data.reduce((a, b) => a + b, 0) / data.length
      : 0;

  const sparkTrend = (() => {
    if (data.filter((v) => v > 0).length < 2) return "";
    const avg1 = data.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const avg2 = data.slice(7).reduce((a, b) => a + b, 0) / 7;
    if (avg2 - avg1 > 0.5) return t("subindo");
    if (avg1 - avg2 > 0.5) return t("caindo");
    return t("estavel");
  })();

  return (
    <div className="px-3.5 pt-5">
      <div
        className="rounded-[18px] px-4 pt-4 pb-[18px] border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--surface-border)",
          boxShadow: "inset 0 1px 0 var(--surface-highlight)",
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <p
            className="m-0 text-[10px] font-bold tracking-[.12em] uppercase"
            style={{ color: "#A78BFA" }}
          >
            {t("ev_titulo")}
          </p>
        </div>

        {hasData ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[20px] font-bold tracking-tight leading-none tabular-nums"
                style={{ color: "#e0d6ff" }}
              >
                {sparkAvg.toFixed(1)}
              </span>
              <span className="text-[10.5px]" style={{ color: "oklch(0.55 0.03 270)" }}>
                {t("ev_media")}{sparkTrend ? ` · ${sparkTrend}` : ""}
              </span>
            </div>
            <div className="mt-2">
              <SparkSmall data={data} />
            </div>
          </>
        ) : (
          <p className="m-0 text-[11px]" style={{ color: "oklch(0.55 0.03 270)" }}>
            {t("ev_sem_dados")}
          </p>
        )}
      </div>
    </div>
  );
}
