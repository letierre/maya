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
import { EllipsisVertical } from "lucide-react";

export function HeaderWrapper() {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="font-semibold text-primary text-lg flex items-center gap-2">
          🌱 Diario
        </Link>

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
  const isDashboard = pathname === "/dashboard";

  if (isDashboard) {
    return (
      <main className="flex-1 w-full">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-28">
      {children}
    </main>
  );
}
