"use client";

import type { CSSProperties, ReactNode } from "react";

// Tokens visuais do módulo de Análise (espelham a página /analise)
export const FOREGROUND = "#e0d6ff";
export const MUTED = "oklch(0.55 0.03 270)";
export const PURPLE = "#7C5CFF";
export const LILAC = "#A78BFA";
export const GREEN = "#22D18B";
export const RED = "#FF5C5C";

export const CARD: CSSProperties = {
  background: "oklch(0.16 0.012 270)",
  border: "1px solid oklch(0.28 0.02 270 / 0.5)",
  borderRadius: 18,
  padding: "16px 18px",
};

export function Section({
  title,
  subtitle,
  children,
  paddingTop = 20,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  paddingTop?: number;
}) {
  return (
    <div style={{ padding: `${paddingTop}px 16px 0` }}>
      <p
        style={{
          margin: subtitle ? "0 0 2px" : "0 0 10px",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "oklch(0.65 0.12 270)",
          paddingLeft: 4,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p style={{ margin: "0 0 10px", fontSize: 11, color: MUTED, paddingLeft: 4, fontWeight: 500 }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

export function ProgressBar({
  pct,
  color = PURPLE,
  height = 5,
}: {
  pct: number;
  color?: string;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 9999,
        background: "oklch(0.25 0.02 270)",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(Math.max(pct, 0), 100)}%`,
          borderRadius: 9999,
          background: color,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}

export function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ textAlign: "center", minWidth: 0, flex: 1 }}>
      <p
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          color: color || FOREGROUND,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
      <p
        style={{
          margin: "3px 0 0",
          fontSize: 9,
          color: MUTED,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {label}
      </p>
    </div>
  );
}
