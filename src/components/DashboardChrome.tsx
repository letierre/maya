"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/sono", "/metas", "/planejamento", "/perfil", "/configurações"];
const FULLBLEED_PREFIXES = ["/metas", "/planejamento", "/financas"];
const HIDE_BOTTOMNAV_ROUTES = ["/diario/novo", "/check-in", "/metas/nova", "/metas/coach"];

export function HeaderWrapper() {
  return null;
}

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULLBLEED_ROUTES.includes(pathname) || FULLBLEED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isFullBleed) {
    return <main className="flex-1 overflow-y-auto min-h-0 w-full">{children}</main>;
  }
  return (
    <main className="flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-28">
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
