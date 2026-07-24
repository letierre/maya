"use client";

import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { MayaAvatar } from "@/components/MayaAvatar";
import { ArrowLeft } from "lucide-react";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/nutricao/registrar", "/sono", "/metas", "/planejamento", "/perfil", "/financas", "/financas/registrar", "/analise", "/agenda"];
const FULLBLEED_PREFIXES = ["/metas", "/planejamento", "/financas", "/check-in", "/diario"];

// Routes that DON'T show bottom nav — the header appears on these
const NO_BOTTOM_NAV = [
  "/check-in", "/metas/nova", "/metas/coach",
  "/nutricao/registrar", "/financas/registrar",
];
const NO_BOTTOM_NAV_PREFIXES = ["/insights"];

// ── Header ──────────────────────────────────────────────────────

export function HeaderWrapper() {
  const pathname = usePathname();
  const router = useRouter();

  // Only show header on screens without bottom nav
  const hideBottomNav = NO_BOTTOM_NAV.includes(pathname) ||
    NO_BOTTOM_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  if (!hideBottomNav) return null;

  const isInsights = pathname.startsWith("/insights");

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 56, background: "#0F0F14",
        borderBottom: "1px solid rgba(167,139,250,0.15)",
        paddingTop: "env(safe-area-inset-top)",
        display: "flex", alignItems: "center",
        paddingInline: 16, maxWidth: 480, margin: "0 auto", width: "100%",
      }}
    >
      {!isInsights && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          style={{
            border: 0, background: "none", cursor: "pointer",
            color: "#A78BFA", display: "flex", alignItems: "center",
            padding: 0, flexShrink: 0, marginRight: 8,
          }}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <span style={{
        fontSize: 18, fontWeight: 800, color: "#A78BFA",
        fontFamily: "var(--font-sans)", letterSpacing: "-0.03em",
        userSelect: "none",
      }}>
        Maya
      </span>
      <div style={{ flex: 1 }} />
      {isInsights && <MayaAvatar state="mini" size={32} />}
    </header>
  );
}

// ── Main Wrapper ────────────────────────────────────────────────

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULLBLEED_ROUTES.includes(pathname) || FULLBLEED_PREFIXES.some((p) => pathname.startsWith(p));

  // Only pages WITHOUT bottom nav get top padding for the header
  const hideBottomNav = NO_BOTTOM_NAV.includes(pathname) ||
    NO_BOTTOM_NAV_PREFIXES.some((p) => pathname.startsWith(p));
  const pt = hideBottomNav ? "pt-14" : "";

  if (isFullBleed) {
    return <main className={`flex-1 overflow-y-auto min-h-0 w-full ${pt}`}>{children}</main>;
  }
  return (
    <main className={`flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-28 ${pt}`}>
      {children}
    </main>
  );
}

// ── Bottom Nav Wrapper ──────────────────────────────────────────

export function BottomNavWrapper() {
  const pathname = usePathname();

  const hide = NO_BOTTOM_NAV.includes(pathname) ||
    NO_BOTTOM_NAV_PREFIXES.some((p) => pathname.startsWith(p));
  if (hide) return null;
  return <BottomNav />;
}
