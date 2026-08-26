"use client";

import { useState } from "react";
import { X, TrendingDown, TrendingUp } from "lucide-react";
import type { FinancialTransaction } from "@/types";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import type { CustomCat } from "@/lib/financas-categories";
import { mergeCats, type UserCategory } from "@/lib/financas-categories";
import { CategoryPicker } from "./CategoryPicker";
import { CustomCatModal } from "./CustomCatModal";

type TxDraft = {
  type: "receita" | "despesa";
  amount: string;
  category: string;
  subcategory: string;
  description: string;
  date: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", fontFamily: "inherit",
  fontSize: 14, color: "#e0d6ff", outline: "none",
};

export function TransactionModal({
  initial, prefill, onClose, onSaved, lang, currency, customCat, onCustomCatUpdated,
  userCategories, hiddenCatIds, onManageCategories,
}: {
  initial?: FinancialTransaction | null;
  prefill?: TxDraft;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
  currency: string;
  customCat: CustomCat | null;
  onCustomCatUpdated: (c: CustomCat) => void;
  userCategories: UserCategory[];
  hiddenCatIds: string[];
  onManageCategories: () => void;
}) {
  const [type, setType]         = useState<"receita" | "despesa">(initial?.type ?? prefill?.type ?? "despesa");
  const [amount, setAmount]     = useState(initial ? String(initial.amount) : prefill?.amount ?? "");
  const [amountFocused, setAmountFocused] = useState(false);
  const [category, setCat]      = useState<string>(initial?.category ?? prefill?.category ?? "");
  const [subcategory, setSubcat]= useState<string>(initial?.subcategory ?? prefill?.subcategory ?? "");
  const [desc, setDesc]         = useState(initial?.description ?? prefill?.description ?? "");
  const [date, setDate]         = useState(initial?.date ?? prefill?.date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving]     = useState(false);
  const [showCustomEdit, setShowCustomEdit] = useState(false);

  const cats = mergeCats(type, hiddenCatIds, userCategories, customCat);
  const subcatsForCat = category ? (cats.find((c) => c.id === category)?.subcats ?? []) : [];
  const canSave = amount.trim() !== "" && Number(amount) > 0 && category.length > 0
    && (subcatsForCat.length === 0 || subcategory.length > 0);

  const typeColor = type === "despesa" ? "#FF5C5C" : "#22c55e";
  const typeSoft = type === "despesa" ? "rgba(255,92,92,0.12)" : "rgba(34,197,94,0.12)";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const payload = { type, amount: Number(amount), category, subcategory: subcategory || null, description: desc || null, date };
    if (initial) {
      await fetch(`/api/financas/transactions/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/financas/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "overlayIn .2s ease" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "92dvh", overflowY: "auto", overflowX: "hidden",
        border: "1px solid rgba(167,139,250,0.15)",
        animation: "sheetUp .32s cubic-bezier(.16,1,.3,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#e0d6ff" }}>
              {tFn(lang, initial ? "fin_editar_tx" : "fin_nova_tx")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "#9e96b5" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Type toggle */}
          <div style={{ display: "flex", gap: 8, padding: 4, background: "#0B0B10", borderRadius: 16 }}>
            {(["despesa", "receita"] as const).map((t) => {
              const active = type === t;
              const c = t === "despesa" ? "#FF5C5C" : "#22c55e";
              return (
                <button key={t} type="button" onClick={() => { setType(t); setCat(""); setSubcat(""); }} style={{
                  flex: 1, padding: "12px 10px", borderRadius: 12, border: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: active ? c : "transparent",
                  color: active ? "#fff" : "#9e96b5",
                  boxShadow: active ? `0 4px 14px ${c}55` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "all .2s cubic-bezier(.16,1,.3,1)",
                }}>
                  {t === "despesa" ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                  {tFn(lang, t === "despesa" ? "fin_despesa_label" : "fin_receita_label")}
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#9e96b5" }}>
              {tFn(lang, "fin_valor")}
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              borderRadius: 12, border: `1px solid ${amountFocused ? typeColor : "rgba(167,139,250,0.2)"}`,
              background: "#0B0B10", paddingRight: 14,
              boxShadow: amountFocused ? `0 0 0 3px ${typeSoft}` : "none",
              transition: "border-color .15s ease, box-shadow .15s ease",
            }}>
              <span style={{
                padding: "12px 0 12px 14px", fontSize: 22, fontWeight: 700,
                color: amount ? typeColor : "#9e96b5", fontFamily: "inherit",
                whiteSpace: "nowrap", transition: "color .15s ease",
              }}>
                {(() => {
                  // Show currency symbol based on locale
                  const symbols: Record<string, string> = {
                    BRL: "R$", USD: "$", EUR: "€", GBP: "£",
                    ARS: "$", CLP: "$", MXN: "$",
                  };
                  return symbols[currency] ?? currency + " ";
                })()}
              </span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                placeholder="0,00"
                style={{
                  flex: 1, padding: "12px 0", border: "none", background: "transparent",
                  fontFamily: "inherit", fontSize: 22, fontWeight: 700, color: "#e0d6ff",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Category + subcategory picker */}
          <CategoryPicker
            type={type}
            category={category}
            subcategory={subcategory}
            lang={lang}
            customCat={customCat}
            userCategories={userCategories}
            hiddenCatIds={hiddenCatIds}
            onSelect={(cat, sub) => { setCat(cat); setSubcat(sub); }}
            onManage={onManageCategories}
          />

          {/* Description */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#9e96b5" }}>
              {tFn(lang, "fin_descricao")}
            </p>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={tFn(lang, type === "despesa" ? "fin_descricao_ph" : "fin_descricao_ph_receita")}
              style={inputStyle}
            />
          </div>

          {/* Date */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#9e96b5" }}>
              {tFn(lang, "fin_data")}
            </p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <button type="button" onClick={save} disabled={!canSave || saving} style={{
          marginTop: 24, width: "100%", padding: "16px 20px", borderRadius: 14, border: 0,
          cursor: (!canSave || saving) ? "not-allowed" : "pointer",
          background: (!canSave || saving) ? "rgba(124,92,255,0.2)" : "linear-gradient(135deg, #7C5CFF, #A78BFA)",
          boxShadow: (!canSave || saving) ? "none" : "0 6px 20px rgba(124,92,255,0.35)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (!canSave || saving) ? "rgba(167,139,250,0.5)" : "#fff",
          transition: "all .15s ease",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
        </button>
      </div>

      {showCustomEdit && (
        <CustomCatModal
          customCat={customCat}
          lang={lang}
          onClose={() => setShowCustomEdit(false)}
          onSaved={(updated) => { onCustomCatUpdated(updated); }}
        />
      )}
    </>
  );
}
