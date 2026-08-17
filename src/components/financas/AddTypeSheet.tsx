"use client";

import { Pencil, Camera, Wallet } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";

export function AddTypeSheet({
  onManual, onPhoto, onBudget, onClose, lang,
}: {
  onManual: () => void;
  onPhoto: () => void;
  onBudget: () => void;
  onClose: () => void;
  lang: Lang;
}) {
  const opts = [
    {
      icon: <Pencil size={22} style={{ color: "#7C5CFF" }} />,
      title: tFn(lang, "fin_add_manual"),
      desc: tFn(lang, "fin_add_manual_desc"),
      action: onManual,
    },
    {
      icon: <Camera size={22} style={{ color: "#7C5CFF" }} />,
      title: tFn(lang, "fin_add_foto"),
      desc: tFn(lang, "fin_add_foto_desc"),
      action: onPhoto,
    },
    {
      icon: <Wallet size={22} style={{ color: "#7C5CFF" }} />,
      title: tFn(lang, "fin_add_budget"),
      desc: tFn(lang, "fin_add_budget_desc"),
      action: onBudget,
    },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 80,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        border: "1px solid rgba(167,139,250,0.15)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 22px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opts.map((o) => (
            <button
              key={o.title}
              type="button"
              onClick={() => { onClose(); o.action(); }}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "18px 18px", borderRadius: 18,
                border: "1px solid rgba(167,139,250,0.15)",
                background: "#0B0B10", cursor: "pointer", textAlign: "left",
                transition: "background .12s ease",
              }}
            >
              <div style={{
                width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                background: "rgba(124,92,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {o.icon}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#e0d6ff" }}>{o.title}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9e96b5", lineHeight: 1.4 }}>{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
