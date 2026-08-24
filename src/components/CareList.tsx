"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import type { CareSignal } from "@/lib/care-signals";
import { getLocalDate } from "@/lib/utils";

export function CareList() {
  const router = useRouter();
  const [items, setItems] = useState<CareSignal[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(`care_list_dismissed_${getLocalDate()}`)) {
      setDismissed(true);
      return;
    }
    fetch("/api/maya/care-list")
      .then((r) => r.json())
      .then((data) => {
        if (data.items?.length) setItems(data.items);
      })
      .catch(() => {});
  }, []);

  if (dismissed || items.length === 0) return null;

  const dismiss = () => {
    localStorage.setItem(`care_list_dismissed_${getLocalDate()}`, "1");
    setDismissed(true);
  };

  return (
    <div className="px-3.5 pt-3">
      <div
        className="rounded-[18px] overflow-hidden relative"
        style={{ background: "linear-gradient(135deg,#2D1B69 0%,#1A1035 100%)" }}
      >
        {/* Glow decorativo */}
        <div
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full pointer-events-none opacity-[.3]"
          style={{ background: "radial-gradient(circle, oklch(.55 .2 270) 0%, transparent 70%)" }}
        />
        <div className="absolute -right-4 top-6 w-20 h-20 rounded-full border border-white/[.12] pointer-events-none" />

        <div className="relative px-[20px] py-4" style={{ zIndex: 10 }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                className="m-0 text-[10px] font-bold tracking-[.14em] uppercase text-white/65"
              >
                Maya sugere
              </p>
              <h3 className="m-0 mt-1 text-[16px] font-bold text-white leading-tight tracking-tight">
                O que cuidar nos próximos dias
              </h3>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dispensar"
              className="size-6 rounded-full flex items-center justify-center border-0 cursor-pointer text-white/50 hover:text-white/80"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {items.map((it) => {
              const inner = (
                <>
                  <span className="text-[20px] leading-none shrink-0">{it.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13px] font-bold text-white leading-tight">{it.title}</p>
                    <p className="m-0 mt-0.5 text-[11.5px] leading-snug text-white/70">
                      {it.description}
                    </p>
                  </div>
                  {it.action && <ArrowRight className="w-4 h-4 text-white/40 shrink-0" />}
                </>
              );
              const rowClass =
                "flex items-center gap-2.5 text-left rounded-xl px-2.5 py-2 w-full";
              return it.action ? (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => router.push(it.action!.href)}
                  className={`${rowClass} border-0 cursor-pointer hover:bg-white/[.06] transition-colors`}
                  style={{ background: "rgba(255,255,255,.04)", fontFamily: "inherit" }}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={it.id}
                  className={rowClass}
                  style={{ background: "rgba(255,255,255,.04)" }}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
