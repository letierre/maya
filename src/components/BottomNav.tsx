"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, BarChart3, CalendarDays, User } from "lucide-react";
import { MayaAvatar } from "@/components/MayaAvatar";

const NAV_ITEMS = [
  { href: "/dashboard",    icon: Home,        label: "Início", slug: "dashboard" },
  { href: "/insights",     icon: null,        label: "Maya",   slug: "insights" },
  // Comunidade oculta temporariamente — reativar quando houver usuários ativos suficientes
  // { href: "/comunidade",   icon: Heart,       label: "Comunidade", slug: "comunidade" },
  { href: "/analise",      icon: BarChart3,   label: "Análise", slug: "analise" },
  { href: "/agenda",       icon: CalendarDays, label: "Plano",  slug: "agenda" },
  { href: "/perfil",       icon: User,        label: "Perfil",  slug: "perfil" },
];

// Screens where the bottom nav should be hidden
const HIDE_ON = [
  "/diario/novo",
  "/check-in",
  "/metas/coach",
  "/nutricao/registrar",
  "/financas/registrar",
];

export function BottomNav() {
  const pathname = usePathname();
  const [hasNudge, setHasNudge] = useState(false);

  // Check for unread Maya nudge
  useEffect(() => {
    fetch("/api/maya/nudge")
      .then(r => r.json())
      .then(data => { setHasNudge(data.nudges?.length > 0); })
      .catch(() => {});
  }, []);

  // Hide on full-screen experiences
  if (HIDE_ON.includes(pathname)) return null;
  // Editor do check-in (histórico) também é fullscreen
  if (pathname.startsWith("/check-in/")) return null;
  // Also hide on chat (it has its own input bar)
  if (pathname.startsWith("/insights")) return null;
  // Hide on reader page (fullscreen)
  if (/\/leitura\/.+\/ler/.test(pathname)) return null;
  // Hide on reading timer (fullscreen focus mode)
  if (pathname.startsWith("/leitura/leitor")) return null;

  const isActive = (slug: string) => {
    if (slug === "dashboard") return pathname === "/dashboard";
    if (slug === "insights") return pathname.startsWith("/insights");
    if (slug === "analise") return pathname.startsWith("/analise");
    if (slug === "agenda") return pathname.startsWith("/agenda");
    if (slug === "perfil") return pathname.startsWith("/perfil");
    if (slug === "comunidade") return pathname.startsWith("/comunidade");
    return false;
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 64,
        background: "oklch(0.14 0.012 270 / 0.97)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          height: "100%",
          paddingInline: 8,
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label, slug }) => {
          const active = isActive(slug);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                height: "100%",
                flex: 1,
                minWidth: 0,
                color: active ? "#A78BFA" : "oklch(0.55 0.04 270)",
                textDecoration: "none",
                transition: "color 0.15s ease",
                padding: "0 4px",
              }}
            >
              {slug === "insights" ? (
                <div style={{ position: "relative" }}>
                  <MayaAvatar state="mini" size={24} />
                  {hasNudge && (
                    <span style={{
                      position: "absolute", top: -2, right: -2,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#FF4D4D", border: "1.5px solid #0F0F14",
                    }} />
                  )}
                </div>
              ) : Icon ? (
                <Icon size={22} />
              ) : null}
              <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
