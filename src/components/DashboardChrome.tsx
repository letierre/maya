"use client";

import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { MayaAvatar } from "@/components/MayaAvatar";
import { ArrowLeft } from "lucide-react";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/nutricao/registrar", "/sono", "/metas", "/planejamento", "/perfil", "/configurações", "/financas", "/financas/registrar", "/analise"];
const FULLBLEED_PREFIXES = ["/metas", "/planejamento", "/financas", "/check-in", "/diario"];
const HIDE_BOTTOMNAV_ROUTES = ["/diario/novo", "/check-in", "/metas/nova", "/metas/coach"];

const SECONDARY_SCREENS = [
  "/check-in", "/diario", "/diario/novo", "/diario/evolucao",
  "/metas", "/metas/nova", "/metas/coach",
  "/nutricao", "/nutricao/registrar",
  "/financas", "/financas/registrar",
  "/sono", "/historico", "/perfil", "/configuracoes",
  "/planejamento", "/analise",
];

export function HeaderWrapper() {
  const pathname = usePathname();
  const router = useRouter();

  const isSecondary = SECONDARY_SCREENS.includes(pathname) ||
    SECONDARY_SCREENS.some((p) => pathname.startsWith(p + "/"));
  const isDashboard = pathname === "/dashboard";
  const isChat = pathname.startsWith("/insights");

  // Chat has its own header — don't show this one
  if (isChat) return null;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
        background: "oklch(0.12 0.012 270)",
        borderBottom: "1px solid oklch(0.28 0.02 270 / 0.5)",
        paddingTop: "env(safe-area-inset-top)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingInline: 16,
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {isSecondary ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Voltar"
            style={{
              border: 0,
              background: "none",
              cursor: "pointer",
              color: "#A78BFA",
              display: "flex",
              alignItems: "center",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div style={{ width: 28, flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#A78BFA",
            fontFamily: "var(--font-sans)",
            letterSpacing: "-0.03em",
            userSelect: "none",
          }}
        >
          Maya
        </span>
      </div>

      {!isDashboard && <MayaAvatar state="mini" size={32} />}
    </header>
  );
}

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULLBLEED_ROUTES.includes(pathname) || FULLBLEED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isFullBleed) {
    return <main className="flex-1 overflow-y-auto min-h-0 w-full pt-14">{children}</main>;
  }
  return (
    <main className="flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-28 pt-14">
      {children}
    </main>
  );
}

const HIDE_BOTTOMNAV_PREFIXES = ["/metas/nova", "/metas/coach"];

export function BottomNavWrapper() {
  const pathname = usePathname();
  const hide = HIDE_BOTTOMNAV_ROUTES.includes(pathname) || HIDE_BOTTOMNAV_PREFIXES.some((p) => pathname.startsWith(p));
  if (hide) return null;
  return <BottomNav />;
}
