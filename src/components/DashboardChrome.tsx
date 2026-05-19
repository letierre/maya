"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/LogoutButton";
import { BottomNav } from "@/components/BottomNav";
import { EllipsisVertical } from "lucide-react";

const FULLBLEED_ROUTES = ["/dashboard", "/diario", "/diario/novo", "/check-in", "/historico", "/nutricao", "/sono", "/metas", "/planejamento"];
const FULLBLEED_PREFIXES = ["/metas", "/planejamento"];
const HIDE_BOTTOMNAV_ROUTES = ["/diario/novo", "/check-in", "/metas/nova", "/metas/coach"];

export function HeaderWrapper() {
  const pathname = usePathname();
  const isFullBleed = FULLBLEED_ROUTES.includes(pathname) || FULLBLEED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isFullBleed) return null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex items-center justify-end px-4 h-14">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <span className="size-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer">
                <EllipsisVertical className="size-5" />
              </span>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={
                <Link
                  href="/nutricao"
                  className="w-full text-left px-2 py-1.5 text-sm block"
                >
                  🍽️ Nutrição
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  href="/sono"
                  className="w-full text-left px-2 py-1.5 text-sm block"
                >
                  🌙 Sono
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  href="/check-in"
                  className="w-full text-left px-2 py-1.5 text-sm block"
                >
                  ✍️ Check-in
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  href="/perfil"
                  className="w-full text-left px-2 py-1.5 text-sm block"
                >
                  Meu Perfil
                </Link>
              }
            />
            <DropdownMenuItem
              render={
                <Link
                  href="/configurações"
                  className="w-full text-left px-2 py-1.5 text-sm block"
                >
                  Configurações
                </Link>
              }
            />
            <DropdownMenuItem
              render={<LogoutButton />}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
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
