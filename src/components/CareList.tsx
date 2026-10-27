"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import type { CareSignal } from "@/lib/care-signals";
import { getLocalDate } from "@/lib/utils";
import { onCareDataChanged } from "@/lib/care-events";
import { cachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";

export function CareList() {
  const router = useRouter();
  const { t } = useTranslation();
  const [items, setItems] = useState<CareSignal[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const loadItems = useCallback((fresh = false) => {
    // Sinais crônicos saem da lista: não martelar o mesmo alerta por semanas.
    const visible = (list: CareSignal[]) => list.filter((it) => it.recurrence?.stage !== "cronico");
    const finish = () => setReady(true);
    if (fresh) {
      // Dados mudaram (evento de care-data): busca fresca, sem cache.
      fetch("/api/maya/care-list")
        .then((r) => r.json())
        .then((data) => setItems(visible(data.items ?? [])))
        .catch(() => {})
        .finally(finish);
      return;
    }
    // Montagem/volta à home: usa cache para não recomputar os sinais toda vez.
    cachedFetch<{ items?: CareSignal[] }>("/api/maya/care-list")
      .then((data) => setItems(visible(data.items ?? [])))
      .catch(() => {})
      .finally(finish);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(`care_list_dismissed_${getLocalDate()}`)) {
      setDismissed(true);
      setReady(true);
      return;
    }
    loadItems();
  }, [loadItems]);

  // Atualiza em tempo real quando um dado que alimenta os sinais muda
  // (check-in salvo, corrida, sono, refeições…).
  useEffect(() => {
    return onCareDataChanged(() => {
      if (localStorage.getItem(`care_list_dismissed_${getLocalDate()}`)) return;
      loadItems(true);
    });
  }, [loadItems]);

  if (!ready) {
    return (
      <div className="px-3.5 pt-3">
        <div
          className="rounded-[18px] p-4 animate-pulse"
          style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}
        >
          <div className="h-3 rounded-full w-28" style={{ background: "var(--surface-3)" }} />
          <div className="mt-2 h-4 rounded-full w-44" style={{ background: "var(--surface-3)" }} />
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="h-12 rounded-xl" style={{ background: "var(--surface-2)" }} />
            <div className="h-12 rounded-xl" style={{ background: "var(--surface-2)" }} />
          </div>
        </div>
      </div>
    );
  }

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
                {t("plc_maya_sugere")}
              </p>
              <h3 className="m-0 mt-1 text-[16px] font-bold text-white leading-tight tracking-tight">
                {t("cl_cuidar_dias")}
              </h3>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("cl_dispensar")}
              className="size-6 rounded-full flex items-center justify-center border-0 cursor-pointer text-white/50 hover:text-white/80"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {items.map((it) => {
              const persistent = it.recurrence?.stage === "persistente";
              // Persistente: o CTA vira "conversar" (reflexão), não uma dica.
              const action = persistent ? { label: t("care_action_chat"), href: "/insights" } : it.action;
              const inner = (
                <>
                  <span
                    className="size-9 rounded-[10px] flex items-center justify-center text-[18px] leading-none shrink-0"
                    style={{ background: "rgba(167,139,250,.14)", boxShadow: "inset 0 0 0 1px rgba(167,139,250,.18)" }}
                  >
                    {it.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="m-0 text-[13px] font-bold text-white leading-tight">{it.title}</p>
                      {persistent && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: "rgba(94,234,212,.15)", color: "#5EEAD4" }}
                        >
                          {t("cl_persistente")}
                        </span>
                      )}
                    </div>
                    <p className="m-0 mt-0.5 text-[11.5px] leading-snug" style={{ color: "#cbbde8" }}>
                      {it.description}
                    </p>
                  </div>
                  {action && <ArrowRight className="w-4 h-4 text-white/40 shrink-0" />}
                </>
              );
              const rowClass =
                "flex items-center gap-2.5 text-left rounded-xl px-2.5 py-2 w-full";
              return action ? (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => router.push(action!.href)}
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
