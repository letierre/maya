"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Camera, Moon, CheckCircle2, Grid2x2, BookOpen, MessageCircle, BarChart2, User, Settings, Utensils } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import { UserAvatar } from "@/components/UserAvatar";
import { useState } from "react";

// ── More sheet items ──────────────────────────────────────────────────────────

const MORE_ITEMS = [
  { href: "/nutricao",        icon: Utensils,      label: "Nutrição" },
  { href: "/diario",          icon: BookOpen,      label: "Diário" },
  { href: "/check-in",        icon: CheckCircle2,  label: "Check-in" },
  { href: "/historico",       icon: BarChart2,      label: "Histórico" },
  { href: "/perfil",          icon: User,           label: "Perfil" },
  { href: "/configurações",   icon: Settings,       label: "Config." },
];

function MoreSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "oklch(.1 .02 160 / .35)",
          backdropFilter: "blur(4px)",
          animation: "fadeIn .15s ease",
        }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "22px 22px 0 0",
        background: "oklch(.99 .004 160)",
        boxShadow: "0 -4px 32px oklch(.2 .04 160 / .12)",
        padding: "16px 20px calc(env(safe-area-inset-bottom) + 20px)",
        animation: "slideUp .2s ease",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.82 .02 160)", margin: "0 auto 18px" }} />
        <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
          Mais recursos
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {MORE_ITEMS.map(({ href, icon: Icon, label }) => (
            <button
              key={href}
              type="button"
              onClick={() => go(href)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                padding: "14px 4px", borderRadius: 16, border: 0, cursor: "pointer",
                background: "oklch(.95 .015 160)",
                transition: "background .12s ease",
              }}
            >
              <Icon size={22} style={{ color: "oklch(.4 .1 160)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(.38 .08 160)" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const MORE_PATHS = MORE_ITEMS.map((i) => i.href);
  const moreActive = MORE_PATHS.some((p) => pathname.startsWith(p));

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 3, height: "100%", flex: 1,
    minWidth: 0, padding: "0 4px",
    color: active ? "var(--primary)" : "oklch(.55 .04 160)",
    textDecoration: "none",
    transition: "color .15s ease",
  });

  return (
    <>
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        height: 64, background: "oklch(.99 .004 160 / .95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid oklch(.88 .02 160 / .6)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <div style={{
          maxWidth: 480, margin: "0 auto", display: "flex",
          alignItems: "center", justifyContent: "space-around", height: "100%", paddingInline: 8,
        }}>
          {/* Home */}
          <Link href="/dashboard" style={linkStyle(isActive("/dashboard"))} prefetch>
            <Home size={22} />
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{t("inicio")}</span>
          </Link>

          {/* Sono */}
          <Link href="/sono" style={linkStyle(isActive("/sono"))} prefetch>
            <Moon size={22} />
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>Sono</span>
          </Link>

          {/* FAB — Nutrição */}
          <Link
            href="/nutricao/registrar"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 3, height: "100%", flex: 1,
              minWidth: 0, textDecoration: "none", color: "oklch(.55 .04 160)",
              marginTop: -20,
            }}
          >
            <span style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px -2px oklch(.5 .12 160 / .5)",
            }}>
              <Camera size={22} color="#fff" />
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1, color: "oklch(.55 .04 160)" }}>
              {t("nutricao")}
            </span>
          </Link>

          {/* Maya */}
          <Link href="/insights" style={linkStyle(isActive("/insights"))} prefetch>
            <MessageCircle size={22} />
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>Maya</span>
          </Link>

          {/* Mais */}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            style={{
              ...linkStyle(moreActive),
              border: 0, cursor: "pointer", background: "transparent",
              fontFamily: "inherit",
            }}
          >
            <Grid2x2 size={22} />
            <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1 }}>Mais</span>
          </button>
        </div>
      </nav>

      {showMore && <MoreSheet onClose={() => setShowMore(false)} />}
    </>
  );
}
