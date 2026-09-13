"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";
import { MayaAvatar } from "@/components/MayaAvatar";

interface HomeMessage {
  message: string;
  state?: string;
  action?: { label: string; href: string };
}

interface MayaHeroProps {
  firstName: string;
  userGender: string;
  homeMessage: HomeMessage | null;
  /** Whether the dashboard is still loading core data */
  loading?: boolean;
}

const AURA_GRADIENTS: Record<string, string> = {
  celebration:
    "radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 35%, transparent 65%)",
  concern:
    "radial-gradient(circle, rgba(94,234,212,0.12) 0%, rgba(94,234,212,0.03) 35%, transparent 65%)",
  reflection:
    "radial-gradient(circle, rgba(167,139,250,0.10) 0%, rgba(124,92,255,0.04) 35%, transparent 65%)",
  greeting:
    "radial-gradient(circle, rgba(124,92,255,0.15) 0%, rgba(94,234,212,0.05) 35%, transparent 65%)",
};

export function MayaHero({
  firstName,
  userGender: _userGender,
  homeMessage,
  loading,
}: MayaHeroProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const auraStyle = useMemo(() => {
    const state = homeMessage?.state || "greeting";
    return AURA_GRADIENTS[state] || AURA_GRADIENTS.greeting;
  }, [homeMessage?.state]);

  const message = homeMessage?.message ?? null;

  const ctaLabel = useMemo(() => {
    if (homeMessage?.action) return homeMessage.action.label;
    return t("conversar_com_maya");
  }, [homeMessage?.action, t]);

  const ctaHref = useMemo(() => {
    if (homeMessage?.action) return homeMessage.action.href;
    // Carry Maya's message as context for the chat
    if (message) return `/insights?context=${encodeURIComponent(message)}`;
    return "/insights";
  }, [homeMessage?.action, message]);

  return (
    <div className="relative flex flex-col items-center" style={{ paddingTop: 0, paddingBottom: 24 }}>
      {/* Background aura — adapts to Maya's state */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: auraStyle,
          transition: "background 0.8s ease",
        }}
      />

      {/* Maya — full image, no circle */}
      <div style={{ marginBottom: 8, position: "relative" }}>
        <MayaAvatar state="hero" size={280} />
      </div>

      {/* Message */}
      <div
        style={{
          maxWidth: 340,
          textAlign: "center",
          paddingInline: 24,
          marginBottom: 20,
        }}
      >
        {loading || !message ? (
          <div className="space-y-2 flex flex-col items-center">
            <div
              className="h-4 rounded-full animate-pulse w-[260px]"
              style={{ background: "var(--surface-3)" }}
            />
            <div
              className="h-4 rounded-full animate-pulse w-[200px]"
              style={{ background: "var(--surface-3)" }}
            />
            <div
              className="h-4 rounded-full animate-pulse w-[160px]"
              style={{ background: "var(--surface-3)" }}
            />
          </div>
        ) : (
          <p
            className="text-[16px] leading-[1.5] font-medium tracking-tight whitespace-pre-wrap"
            style={{ color: "#e0d6ff" }}
          >
            {message}
          </p>
        )}
      </div>

      {/* CTA Button */}
      <button
        type="button"
        onClick={() => router.push(ctaHref)}
        className="inline-flex items-center justify-center h-12 px-8 rounded-2xl border-0 cursor-pointer font-[inherit] text-[15px] font-bold text-white transition-transform duration-150 ease-out"
        style={{
          background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
          boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
          e.currentTarget.style.boxShadow = "0 6px 28px rgba(124,92,255,0.55)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,92,255,0.4)";
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
