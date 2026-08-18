"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/nutricao/registrar", "/sono", "/perfil", "/financas", "/financas/registrar", "/analise", "/agenda", "/leitura", "/configurações"];
const FULLBLEED_PREFIXES = ["/financas", "/check-in", "/diario"];

const NO_BOTTOM_NAV = [
  "/check-in", "/metas/coach",
  "/nutricao/registrar", "/financas/registrar",
];
const NO_BOTTOM_NAV_PREFIXES = ["/insights"];

// ── Main Wrapper ────────────────────────────────────────────────

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const decodedPathname = decodeURIComponent(pathname);
  const isFullBleed = FULLBLEED_ROUTES.includes(decodedPathname) || FULLBLEED_PREFIXES.some((p) => decodedPathname.startsWith(p));

  if (isFullBleed) {
    return <main className="flex-1 overflow-y-auto min-h-0 w-full">{children}</main>;
  }
  return (
    <main className="flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-28">
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
