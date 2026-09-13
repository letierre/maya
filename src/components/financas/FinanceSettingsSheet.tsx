"use client";

import { useState } from "react";
import { X, ChevronLeft, Coins, Tags } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";

const SURFACE = "#151520";
const CARD = "#1a1530";
const BORDER = "rgba(167,139,250,0.15)";
const ACCENT = "#7C5CFF";
const TEXT = "#e0d6ff";
const TEXT_SEC = "#9e96b5";

const CURRENCIES = [
  { code: "BRL", labelKey: "fin_moeda_brl" },
  { code: "USD", labelKey: "fin_moeda_usd" },
  { code: "EUR", labelKey: "fin_moeda_eur" },
  { code: "GBP", labelKey: "fin_moeda_gbp" },
  { code: "ARS", labelKey: "fin_moeda_ars" },
  { code: "CLP", labelKey: "fin_moeda_clp" },
  { code: "MXN", labelKey: "fin_moeda_mxn" },
];

export function FinanceSettingsSheet({
  currency,
  lang,
  onSelectCurrency,
  onOpenCategories,
  onClose,
}: {
  currency: string;
  lang: Lang;
  onSelectCurrency: (code: string) => void;
  onOpenCategories: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"hub" | "currency">("hub");
  const current = CURRENCIES.find((c) => c.code === currency);

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 12px",
    borderRadius: 14, background: CARD, border: `1px solid ${BORDER}`,
    cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
        borderRadius: "24px 24px 0 0", background: SURFACE,
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
        border: `1px solid ${BORDER}`,
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 16px" }} />

        {view === "hub" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>{tFn(lang, "fin_configuracoes")}</h2>
              <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
                <X size={18} style={{ color: TEXT_SEC }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Moeda */}
              <button type="button" onClick={() => setView("currency")} style={rowStyle}>
                <span style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: "rgba(124,92,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Coins size={18} style={{ color: ACCENT }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: TEXT }}>{tFn(lang, "fin_moeda")}</span>
                  <span style={{ display: "block", fontSize: 12, color: TEXT_SEC, marginTop: 1 }}>
                    {current ? tFn(lang, current.labelKey) : tFn(lang, "fin_moeda_brl")}
                  </span>
                </div>
                <span style={{ color: TEXT_SEC, fontSize: 18 }}>›</span>
              </button>

              {/* Categorias */}
              <button type="button" onClick={onOpenCategories} style={rowStyle}>
                <span style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: "rgba(124,92,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Tags size={18} style={{ color: ACCENT }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: TEXT }}>{tFn(lang, "fin_categorias")}</span>
                  <span style={{ display: "block", fontSize: 12, color: TEXT_SEC, marginTop: 1 }}>{tFn(lang, "fin_criar_editar_ocultar")}</span>
                </div>
                <span style={{ color: TEXT_SEC, fontSize: 18 }}>›</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={() => setView("hub")} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
                <ChevronLeft size={18} style={{ color: TEXT_SEC }} />
              </button>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT, flex: 1 }}>{tFn(lang, "fin_moeda")}</h2>
              <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
                <X size={18} style={{ color: TEXT_SEC }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CURRENCIES.map((c) => {
                const selected = currency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { onSelectCurrency(c.code); onClose(); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 12px", borderRadius: 14, cursor: "pointer",
                      border: selected ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                      background: selected ? "rgba(124,92,255,0.12)" : CARD,
                      fontFamily: "inherit", width: "100%",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: selected ? ACCENT : TEXT }}>
                      {tFn(lang, c.labelKey)}
                    </span>
                    {selected && <span style={{ color: ACCENT, fontSize: 13, fontWeight: 800 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
