"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface ModuloPreviewCardProps {
  emoji: string;
  label: string;
  preview: string | null;
  sub?: string;
  href: string;
  accent?: string;
  loading?: boolean;
}

export function ModuloPreviewCard({
  emoji,
  label,
  preview,
  sub,
  href,
  accent = "#A78BFA",
  loading,
}: ModuloPreviewCardProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div
        className="rounded-2xl animate-pulse flex flex-col gap-2 p-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--surface-border)",
        }}
      >
        <div className="w-8 h-8 rounded-full" style={{ background: "var(--surface-3)" }} />
        <div className="h-3 rounded-full w-20" style={{ background: "var(--surface-3)" }} />
        <div className="h-3 rounded-full w-28" style={{ background: "var(--surface-3)" }} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="rounded-2xl p-4 text-left cursor-pointer transition-all active:scale-[0.98] flex flex-col gap-2 group relative overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--surface-border)",
        boxShadow: "inset 0 1px 0 var(--surface-highlight)",
      }}
    >
      {/* Accent glow */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />

      <span className="text-2xl leading-none relative">{emoji}</span>

      <p
        className="m-0 text-[10px] font-bold tracking-[.1em] uppercase"
        style={{ color: accent }}
      >
        {label}
      </p>

      <p
        className="m-0 text-[12px] font-medium leading-snug flex-1"
        style={{ color: "#e0d6ff" }}
      >
        {preview || sub || "—"}
      </p>

      {sub && (
        <p className="m-0 text-[10px]" style={{ color: "oklch(0.55 0.03 270)" }}>
          {sub}
        </p>
      )}

      <ArrowRight
        className="w-3 h-3 absolute bottom-3 right-3 opacity-30 group-hover:opacity-70 transition-opacity"
        style={{ color: accent }}
      />
    </button>
  );
}
