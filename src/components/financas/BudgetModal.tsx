"use client";

import { useState } from "react";
import type { FinancialBudget } from "@/types";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { mergeCats, type FinCat, type CustomCat, type UserCategory } from "@/lib/financas-categories";

function catLabel(c: FinCat, lang: Lang, customCat: CustomCat | null, userCategories: UserCategory[]): string {
  if (c.custom) {
    if (c.id.startsWith("user_")) {
      return userCategories.find((u) => `user_${u.id}` === c.id)?.name ?? tFn(lang, "fin_cat_outros");
    }
    return customCat?.name ?? tFn(lang, "fin_cat_personalizada");
  }
  return tFn(lang, `fin_cat_${c.id}`);
}

export function BudgetModal({
  budgets, month, onClose, onSaved, lang, currency, customCat, userCategories, hiddenCatIds,
}: {
  budgets: FinancialBudget[];
  month: string;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
  currency: string;
  customCat: CustomCat | null;
  userCategories: UserCategory[];
  hiddenCatIds: string[];
}) {
  const cats = mergeCats("despesa", hiddenCatIds, userCategories, customCat);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const b of budgets) init[b.category] = String(b.monthly_limit);
    return init;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const promises = cats
      .filter((c) => values[c.id] && Number(values[c.id]) > 0)
      .map((c) =>
        fetch("/api/financas/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: c.id, monthly_limit: Number(values[c.id]), month }),
        })
      );
    await Promise.all(promises);
    setSaving(false);
    onSaved();
    onClose();
  };

  const inputS: React.CSSProperties = {
    width: 110, padding: "8px 10px", borderRadius: 10,
    border: "1px solid rgba(167,139,250,0.2)",
    background: "#0B0B10", fontFamily: "inherit",
    fontSize: 13, fontWeight: 700, color: "#e0d6ff", outline: "none",
    textAlign: "right",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "overlayIn .2s ease" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
        border: "1px solid rgba(167,139,250,0.15)",
        animation: "sheetUp .32s cubic-bezier(.16,1,.3,1)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "#e0d6ff" }}>
          {tFn(lang, "fin_orcamento_mensal")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9e96b5" }}>
          {tFn(lang, "fin_definir_limite")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cats.map((c) => {
            const label = catLabel(c, lang, customCat, userCategories);
            const emoji = c.custom && !c.id.startsWith("user_") ? (customCat?.emoji ?? c.emoji) : c.emoji;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: "rgba(124,92,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {emoji}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
                  {label}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="10"
                  value={values[c.id] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder="—"
                  style={inputS}
                />
              </div>
            );
          })}
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "rgba(124,92,255,0.2)" : "#7C5CFF",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: saving ? "rgba(167,139,250,0.5)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
        </button>
      </div>
    </>
  );
}
