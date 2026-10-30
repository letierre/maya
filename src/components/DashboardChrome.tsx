"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/nutricao/registrar", "/sono", "/perfil", "/financas", "/financas/registrar", "/analise", "/agenda", "/leitura", "/configurações", "/meditacao", "/respiracao", "/visualizacao"];
const FULLBLEED_PREFIXES = ["/financas", "/check-in", "/diario", "/nutricao", "/compras"];

const NO_BOTTOM_NAV = [
  "/check-in", "/metas/coach",
  "/nutricao/registrar", "/financas/registrar",
  "/meditacao", "/respiracao", "/visualizacao",
];
const NO_BOTTOM_NAV_PREFIXES = ["/insights"];

// ── Main Wrapper ────────────────────────────────────────────────

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const decodedPathname = decodeURIComponent(pathname);
  const isFullBleed = FULLBLEED_ROUTES.includes(decodedPathname) || FULLBLEED_PREFIXES.some((p) => decodedPathname.startsWith(p));

  if (isFullBleed) {
    // `viewport-fit: cover` estende o conteúdo até a borda; o padding-top do
    // safe-area empurra o cabeçalho para baixo do notch, evitando que o conteúdo
    // (título, foto da Maya) fique cortado sob a status bar.
    return <main className="flex-1 overflow-y-auto min-h-0 w-full" style={{ paddingTop: "env(safe-area-inset-top)" }}>{children}</main>;
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
