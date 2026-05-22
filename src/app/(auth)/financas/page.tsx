"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Target, ChevronLeft, ChevronRight, X, TrendingUp, TrendingDown, Wallet, Camera, Settings } from "lucide-react";
import type { FinancialTransaction, FinancialBudget, Goal } from "@/types";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { EXPENSE_CATS, INCOME_CATS, getCatById, getSubcats, type FinCat, type CustomCat } from "@/lib/financas-categories";

// ── Currency ──────────────────────────────────────────────────────────────────

const CURRENCY_CONFIG: Record<string, { locale: string; code: string }> = {
  BRL: { locale: "pt-BR", code: "BRL" },
  USD: { locale: "en-US", code: "USD" },
  EUR: { locale: "de-DE", code: "EUR" },
  GBP: { locale: "en-GB", code: "GBP" },
  ARS: { locale: "es-AR", code: "ARS" },
  CLP: { locale: "es-CL", code: "CLP" },
  MXN: { locale: "es-MX", code: "MXN" },
};

function fmt(amount: number, currency = "BRL"): string {
  const conf = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
  try {
    return new Intl.NumberFormat(conf.locale, { style: "currency", currency: conf.code }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ── Colors ────────────────────────────────────────────────────────────────────

const H = 160;
function fc(l = 0.5, c = 0.14) { return `oklch(${l} ${c} ${H})`; }
function fl(alpha = 1) { return `oklch(.96 .04 ${H} / ${alpha})`; }
const GREEN = "oklch(.45 .14 160)";
const GREEN_L = "oklch(.95 .05 160)";
const RED = "oklch(.48 .18 15)";

// ── Month helpers ─────────────────────────────────────────────────────────────

function monthKey(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function monthLabel(key: string, lang: Lang): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR", { month: "long", year: "numeric" });
}

function groupByDate(txs: FinancialTransaction[]): { date: string; txs: FinancialTransaction[] }[] {
  const map = new Map<string, FinancialTransaction[]>();
  for (const tx of txs) {
    const g = map.get(tx.date) ?? [];
    g.push(tx);
    map.set(tx.date, g);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, txs]) => ({ date, txs }));
}

function fmtDateShort(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR", { day: "numeric", month: "short" });
}

// ── Draft type ────────────────────────────────────────────────────────────────

type TxDraft = {
  type: "receita" | "despesa";
  amount: string;
  category: string;
  subcategory: string;
  description: string;
  date: string;
};

// ── Category label helper ─────────────────────────────────────────────────────

function catLabel(c: FinCat, lang: Lang, customCat: CustomCat | null): string {
  if (c.custom) return customCat?.name ?? tFn(lang, "fin_cat_personalizada");
  return tFn(lang, `fin_cat_${c.id}`);
}

// ── Category picker (two-level) ───────────────────────────────────────────────

function CategoryPicker({
  type, category, subcategory, lang, customCat,
  onSelect, onEditCustom,
}: {
  type: "receita" | "despesa";
  category: string;
  subcategory: string;
  lang: Lang;
  customCat: CustomCat | null;
  onSelect: (cat: string, sub: string) => void;
  onEditCustom: () => void;
}) {
  const cats = type === "despesa" ? EXPENSE_CATS : INCOME_CATS;
  const cols = type === "despesa" ? "repeat(4, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))";
  const selectedCat = cats.find((c) => c.id === category);
  const subcats = category ? getSubcats(category, cats, customCat) : [];

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
        {tFn(lang, "fin_categoria")}
      </p>

      {/* Main category grid */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6 }}>
        {cats.map((c) => {
          const sel = category === c.id;
          const label = catLabel(c, lang, customCat);
          const emoji = c.custom ? (customCat?.emoji ?? c.emoji) : c.emoji;
          return (
            <div key={c.id} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => onSelect(c.id, "")}
                style={{
                  width: "100%", padding: "10px 4px", borderRadius: 12,
                  border: sel ? `2px solid oklch(.5 .14 ${c.hue})` : "2px solid oklch(.88 .02 160)",
                  background: sel ? `oklch(.95 .05 ${c.hue})` : "#fff",
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, transition: "all .12s ease",
                }}
              >
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, textAlign: "center", lineHeight: 1.2,
                  color: sel ? `oklch(.45 .12 ${c.hue})` : "oklch(.55 .03 160)",
                }}>
                  {label}
                </span>
              </button>
              {c.custom && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEditCustom(); }}
                  style={{
                    position: "absolute", top: 3, right: 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "oklch(.88 .02 160)", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Settings size={10} style={{ color: "oklch(.5 .04 160)" }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Subcategory chips */}
      {subcats.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "oklch(.65 .03 160)" }}>
            {tFn(lang, "fin_subcategoria")}
          </p>
          <div style={{ overflowX: "auto", display: "flex", gap: 6, paddingBottom: 4 }}>
            {subcats.map((sc) => {
              const selSub = subcategory === sc.label;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelect(category, sc.label)}
                  style={{
                    flexShrink: 0, padding: "6px 13px", borderRadius: 20,
                    border: selSub
                      ? `1.5px solid oklch(.5 .14 ${selectedCat?.hue ?? 160})`
                      : "1.5px solid oklch(.88 .02 160)",
                    background: selSub ? `oklch(.95 .05 ${selectedCat?.hue ?? 160})` : "#fff",
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    fontSize: 12, fontWeight: 600,
                    color: selSub ? `oklch(.45 .12 ${selectedCat?.hue ?? 160})` : "oklch(.5 .04 160)",
                    transition: "all .12s ease",
                  }}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Category Edit Modal ────────────────────────────────────────────────

function CustomCatModal({
  customCat, lang, onClose, onSaved,
}: {
  customCat: CustomCat | null;
  lang: Lang;
  onClose: () => void;
  onSaved: (updated: CustomCat) => void;
}) {
  const [name, setName] = useState(customCat?.name ?? "Personalizada");
  const [emoji, setEmoji] = useState(customCat?.emoji ?? "⭐");
  const [subcats, setSubcats] = useState<string[]>(customCat?.subcats ?? ["Personalizado"]);
  const [newSubcat, setNewSubcat] = useState("");
  const [saving, setSaving] = useState(false);

  const addSubcat = () => {
    const v = newSubcat.trim();
    if (v && !subcats.includes(v)) { setSubcats((p) => [...p, v]); }
    setNewSubcat("");
  };

  const save = async () => {
    setSaving(true);
    const updated: CustomCat = { name: name.trim() || "Personalizada", emoji: emoji || "⭐", subcats };
    const prefsRes = await fetch("/api/preferences").then((r) => r.json());
    const ctx = prefsRes.context ?? {};
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { ...ctx, custom_fin_cat: updated } }),
    });
    setSaving(false);
    onSaved(updated);
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    borderRadius: 10, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "oklch(.2 .02 160)" }}>
              {tFn(lang, "fin_personalizada_editar")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "oklch(.93 .02 160)", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "oklch(.45 .06 160)" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Emoji + Name */}
          <div style={{ display: "flex", gap: 10 }}>
            <div>
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(.55 .04 160)" }}>
                Emoji
              </p>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                style={{ ...inputStyle, width: 56, textAlign: "center", fontSize: 20, padding: "8px 6px" }}
                maxLength={4}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(.55 .04 160)" }}>
                {tFn(lang, "fin_personalizada_nome")}
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
              />
            </div>
          </div>

          {/* Subcats list */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_personalizada_subcats")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subcats.map((sc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "oklch(.3 .03 160)", padding: "8px 12px", borderRadius: 10, background: "oklch(.96 .02 160)" }}>
                    {sc}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubcats((p) => p.filter((_, j) => j !== i))}
                    style={{ border: 0, background: "none", cursor: "pointer", padding: 6, color: "oklch(.65 .08 15)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new subcat */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={newSubcat}
                onChange={(e) => setNewSubcat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcat(); } }}
                placeholder={tFn(lang, "fin_personalizada_adicionar")}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
              />
              <button type="button" onClick={addSubcat} style={{
                border: 0, background: fl(), borderRadius: 10, padding: "0 14px",
                cursor: "pointer", fontSize: 18, color: fc(), fontFamily: "inherit", fontWeight: 700,
              }}>
                +
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          marginTop: 20, width: "100%", padding: "14px 20px", borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "oklch(.88 .02 160)" : fc(),
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: saving ? "oklch(.6 .02 160)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "fin_personalizada_salvar")}
        </button>
      </div>
    </>
  );
}

// ── Add type choice sheet ─────────────────────────────────────────────────────

function AddTypeSheet({
  onManual, onPhoto, onClose, lang,
}: {
  onManual: () => void;
  onPhoto: () => void;
  onClose: () => void;
  lang: Lang;
}) {
  const opts = [
    {
      icon: <Pencil size={22} style={{ color: fc() }} />,
      title: tFn(lang, "fin_add_manual"),
      desc: tFn(lang, "fin_add_manual_desc"),
      action: onManual,
    },
    {
      icon: <Camera size={22} style={{ color: fc() }} />,
      title: tFn(lang, "fin_add_foto"),
      desc: tFn(lang, "fin_add_foto_desc"),
      action: onPhoto,
    },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .35)", backdropFilter: "blur(4px)" }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 22px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opts.map((o) => (
            <button
              key={o.title}
              type="button"
              onClick={() => { onClose(); o.action(); }}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "18px 18px", borderRadius: 18,
                border: "1.5px solid oklch(.88 .02 160)",
                background: "#fff", cursor: "pointer", textAlign: "left",
                transition: "background .12s ease",
              }}
            >
              <div style={{
                width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                background: fl(), display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {o.icon}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "oklch(.2 .02 160)" }}>{o.title}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "oklch(.6 .03 160)", lineHeight: 1.4 }}>{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Add/Edit Transaction Modal ────────────────────────────────────────────────

function TransactionModal({
  initial, prefill, onClose, onSaved, lang, currency, customCat, onCustomCatUpdated,
}: {
  initial?: FinancialTransaction | null;
  prefill?: TxDraft;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
  currency: string;
  customCat: CustomCat | null;
  onCustomCatUpdated: (c: CustomCat) => void;
}) {
  const [type, setType]         = useState<"receita" | "despesa">(initial?.type ?? prefill?.type ?? "despesa");
  const [amount, setAmount]     = useState(initial ? String(initial.amount) : prefill?.amount ?? "");
  const [category, setCat]      = useState<string>(initial?.category ?? prefill?.category ?? "");
  const [subcategory, setSubcat]= useState<string>(initial?.subcategory ?? prefill?.subcategory ?? "");
  const [desc, setDesc]         = useState(initial?.description ?? prefill?.description ?? "");
  const [date, setDate]         = useState(initial?.date ?? prefill?.date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving]     = useState(false);
  const [showCustomEdit, setShowCustomEdit] = useState(false);

  const cats = type === "despesa" ? EXPENSE_CATS : INCOME_CATS;
  const subcatsForCat = category ? getSubcats(category, cats, customCat) : [];
  const canSave = amount.trim() !== "" && Number(amount) > 0 && category.length > 0
    && (subcatsForCat.length === 0 || subcategory.length > 0);

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

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "92dvh", overflowY: "auto", overflowX: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>
              {tFn(lang, initial ? "fin_editar_tx" : "fin_nova_tx")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "oklch(.93 .02 160)", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "oklch(.45 .06 160)" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Type toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["despesa", "receita"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setType(t); setCat(""); setSubcat(""); }} style={{
                flex: 1, padding: "13px 10px", borderRadius: 14, border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                background: type === t ? (t === "despesa" ? RED : GREEN) : "oklch(.93 .02 160)",
                color: type === t ? "#fff" : "oklch(.45 .06 160)",
                transition: "all .15s ease",
              }}>
                {t === "despesa" ? `↓ ${tFn(lang, "fin_despesa_label")}` : `↑ ${tFn(lang, "fin_receita_label")}`}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_valor")}
            </p>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700 }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          {/* Category + subcategory picker */}
          <CategoryPicker
            type={type}
            category={category}
            subcategory={subcategory}
            lang={lang}
            customCat={customCat}
            onSelect={(cat, sub) => { setCat(cat); setSubcat(sub); }}
            onEditCustom={() => setShowCustomEdit(true)}
          />

          {/* Description */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_descricao")}
            </p>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={tFn(lang, "fin_descricao_ph")}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          {/* Date */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_data")}
            </p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>
        </div>

        <button type="button" onClick={save} disabled={!canSave || saving} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: (!canSave || saving) ? "not-allowed" : "pointer",
          background: (!canSave || saving) ? "oklch(.88 .02 160)" : fc(),
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (!canSave || saving) ? "oklch(.6 .02 160)" : "#fff",
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

// ── Budget Modal ───────────────────────────────────────────────────────────────

function BudgetModal({
  budgets, month, onClose, onSaved, lang, currency, customCat,
}: {
  budgets: FinancialBudget[];
  month: string;
  onClose: () => void;
  onSaved: () => void;
  lang: Lang;
  currency: string;
  customCat: CustomCat | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const b of budgets) init[b.category] = String(b.monthly_limit);
    return init;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const promises = EXPENSE_CATS
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

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "oklch(.1 .02 160 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 70,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 160 / .15)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(.85 .02 160)", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 800, color: "oklch(.2 .02 160)" }}>
          {tFn(lang, "fin_orcamento_mensal")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "oklch(.55 .04 160)" }}>
          {tFn(lang, "fin_definir_limite")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EXPENSE_CATS.map((c) => {
            const label = catLabel(c, lang, customCat);
            const emoji = c.custom ? (customCat?.emoji ?? c.emoji) : c.emoji;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: `oklch(.94 .04 ${c.hue})`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {emoji}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "oklch(.3 .03 160)" }}>
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
                  style={{
                    width: 110, padding: "8px 10px", borderRadius: 10,
                    border: "1.5px solid oklch(.82 .03 160)",
                    background: "oklch(.98 .005 160)", fontFamily: "inherit",
                    fontSize: 13, fontWeight: 700, color: "oklch(.2 .02 160)", outline: "none",
                    textAlign: "right",
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
                  onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
                />
              </div>
            );
          })}
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          marginTop: 24, width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "oklch(.88 .02 160)" : fc(),
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: saving ? "oklch(.6 .02 160)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
        </button>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancasPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const [currency, setCurrency] = useState("BRL");
  const [customCat, setCustomCat] = useState<CustomCat | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddType, setShowAddType] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [editTx, setEditTx] = useState<FinancialTransaction | null>(null);

  const currentMonth = monthKey(monthOffset);

  const load = useCallback(async () => {
    setLoading(true);
    const [prefsRes, txRes, budgetRes, goalsRes] = await Promise.all([
      fetch("/api/preferences").then((r) => r.json()),
      fetch(`/api/financas/transactions?month=${currentMonth}`).then((r) => r.json()),
      fetch(`/api/financas/budgets?month=${currentMonth}`).then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
    ]);
    if (prefsRes.context?.currency) setCurrency(prefsRes.context.currency);
    if (prefsRes.context?.custom_fin_cat) setCustomCat(prefsRes.context.custom_fin_cat);
    if (Array.isArray(txRes)) setTransactions(txRes);
    if (Array.isArray(budgetRes)) setBudgets(budgetRes);
    if (Array.isArray(goalsRes)) setGoals(goalsRes.filter((g: Goal) => g.area === "financas" && g.status === "ativa"));
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);

  const deleteTx = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/financas/transactions/${id}`, { method: "DELETE" });
  };

  // ── Computed summaries ─────────────────────────────────────────────────────
  const totalReceitas = transactions.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
  const totalDespesas = transactions.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
  const saldo = totalReceitas - totalDespesas;

  const spendByCategory = EXPENSE_CATS.map((c) => ({
    ...c,
    total: transactions.filter((t) => t.type === "despesa" && t.category === c.id).reduce((s, t) => s + t.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const grouped = groupByDate(transactions);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${fc()}`, borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 110 }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${fc(.44, .16)}, ${fc(.38, .14)})`,
        padding: "52px 20px 28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "oklch(1 0 0 / .07)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "oklch(1 0 0 / .05)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Month navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button type="button" onClick={() => setMonthOffset((p) => p - 1)} style={{
              width: 32, height: 32, borderRadius: "50%", border: 0, cursor: "pointer",
              background: "oklch(1 0 0 / .15)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ChevronLeft size={16} color="#fff" />
            </button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>
              {monthLabel(currentMonth, lang)}
            </span>
            <button type="button" onClick={() => setMonthOffset((p) => p + 1)} disabled={monthOffset >= 0} style={{
              width: 32, height: 32, borderRadius: "50%", border: 0, cursor: monthOffset >= 0 ? "not-allowed" : "pointer",
              background: monthOffset >= 0 ? "oklch(1 0 0 / .07)" : "oklch(1 0 0 / .15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: monthOffset >= 0 ? 0.4 : 1,
            }}>
              <ChevronRight size={16} color="#fff" />
            </button>
          </div>

          {/* Balance */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "oklch(1 0 0 / .7)", fontWeight: 500 }}>
              {tFn(lang, "fin_saldo")}
            </p>
            <p style={{
              margin: 0, fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-1px",
              textShadow: "0 2px 8px oklch(.3 .14 160 / .3)",
            }}>
              {fmt(saldo, currency)}
            </p>
          </div>

          {/* Receitas / Despesas pills */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "oklch(1 0 0 / .15)", borderRadius: 14, padding: "12px 14px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingUp size={14} color="oklch(.85 .1 160)" />
                <span style={{ fontSize: 11, color: "oklch(1 0 0 / .75)", fontWeight: 600 }}>{tFn(lang, "fin_receitas")}</span>
              </div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmt(totalReceitas, currency)}</p>
            </div>
            <div style={{ flex: 1, background: "oklch(1 0 0 / .15)", borderRadius: 14, padding: "12px 14px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <TrendingDown size={14} color="oklch(.85 .1 15)" />
                <span style={{ fontSize: 11, color: "oklch(1 0 0 / .75)", fontWeight: 600 }}>{tFn(lang, "fin_despesas")}</span>
              </div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>{fmt(totalDespesas, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Spending by category ── */}
        {spendByCategory.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_categorias_despesas")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {spendByCategory.map((c) => {
                const pct = totalDespesas > 0 ? (c.total / totalDespesas) * 100 : 0;
                const label = catLabel(c, lang, customCat);
                const emoji = c.custom ? (customCat?.emoji ?? c.emoji) : c.emoji;
                return (
                  <div key={c.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "oklch(.35 .03 160)" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>{fmt(c.total, currency)}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 9999, background: "oklch(.93 .01 160)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 9999,
                        background: `oklch(.5 .14 ${c.hue})`,
                        width: `${pct}%`, transition: "width .5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Budget status ── */}
        {budgets.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", overflow: "hidden" }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${fc(.5, .14)}, ${fc(.45, .12)})` }} />
            <div style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                  {tFn(lang, "fin_orcamento")}
                </p>
                <button type="button" onClick={() => setShowBudget(true)} style={{
                  border: 0, background: fl(), borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, color: fc(), fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Pencil size={11} /> {tFn(lang, "fin_editar_orcamento")}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {budgets.map((b) => {
                  const conf = getCatById(b.category, "despesa");
                  const label = catLabel(conf, lang, customCat);
                  const emoji = conf.custom ? (customCat?.emoji ?? conf.emoji) : conf.emoji;
                  const spent = transactions.filter((t) => t.type === "despesa" && t.category === b.category).reduce((s, t) => s + t.amount, 0);
                  const pct = Math.min((spent / b.monthly_limit) * 100, 100);
                  const over = spent > b.monthly_limit;
                  return (
                    <div key={b.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 15 }}>{emoji}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "oklch(.35 .03 160)" }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: over ? RED : "oklch(.5 .04 160)" }}>
                          {fmt(spent, currency)} / {fmt(b.monthly_limit, currency)}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 9999, background: "oklch(.93 .01 160)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 9999,
                          background: over ? RED : pct > 80 ? "oklch(.5 .16 50)" : GREEN,
                          width: `${pct}%`, transition: "width .5s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Transactions ── */}
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", overflow: "hidden" }}>
          <div style={{ height: 4, background: `linear-gradient(90deg, ${fc(.5, .14)}, ${fc(.42, .10)})` }} />
          <div style={{ padding: "14px 18px 6px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
                {tFn(lang, "fin_transacoes")}
              </p>
              {budgets.length === 0 && (
                <button type="button" onClick={() => setShowBudget(true)} style={{
                  border: 0, background: fl(), borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, color: fc(), fontFamily: "inherit",
                }}>
                  {tFn(lang, "fin_definir_orcamento_btn")}
                </button>
              )}
            </div>

            {grouped.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0 24px" }}>
                <Wallet size={36} style={{ color: "oklch(.82 .04 160)", marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 13, color: "oklch(.55 .04 160)", fontStyle: "italic" }}>
                  {tFn(lang, "fin_sem_transacoes")}
                </p>
              </div>
            ) : (
              grouped.map(({ date, txs }) => (
                <div key={date} style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.65 .03 160)" }}>
                    {fmtDateShort(date, lang)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {txs.map((tx) => {
                      const conf = getCatById(tx.category, tx.type);
                      const isIncome = tx.type === "receita";
                      const catName = catLabel(conf, lang, customCat);
                      const emoji = conf.custom ? (customCat?.emoji ?? conf.emoji) : conf.emoji;
                      return (
                        <div key={tx.id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                          borderRadius: 13, background: "oklch(.985 .003 160)",
                          border: "1.5px solid oklch(.92 .01 160)",
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                            background: isIncome ? GREEN_L : `oklch(.95 .04 ${conf.hue})`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                          }}>
                            {emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "oklch(.25 .02 160)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.description || tx.subcategory || catName}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: "oklch(.6 .03 160)" }}>
                              {catName}{tx.subcategory ? ` › ${tx.subcategory}` : ""}
                            </p>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: isIncome ? GREEN : RED, flexShrink: 0 }}>
                            {isIncome ? "+" : "-"}{fmt(tx.amount, currency)}
                          </span>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button type="button" onClick={() => setEditTx(tx)} style={{ border: 0, background: "none", cursor: "pointer", padding: 4, color: "oklch(.7 .03 160)" }}>
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => deleteTx(tx.id)} style={{ border: 0, background: "none", cursor: "pointer", padding: 4, color: "oklch(.65 .08 15)" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ height: 1, background: "oklch(.92 .01 160)", marginTop: 10 }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Financial goals ── */}
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 2px 16px oklch(.2 .04 160 / .08)", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_metas_fin")}
            </p>
            <button type="button" onClick={() => router.push("/metas/nova?area=financas")} style={{
              border: 0, background: fl(), borderRadius: 8, padding: "5px 10px", cursor: "pointer",
              fontSize: 11, fontWeight: 700, color: fc(), fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Plus size={11} /> {tFn(lang, "fin_criar_meta_fin")}
            </button>
          </div>

          {goals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
              <Target size={30} style={{ color: "oklch(.82 .04 160)", marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.6 .03 160)", fontStyle: "italic" }}>
                {tFn(lang, "fin_sem_metas_fin")}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {goals.map((g) => {
                const stages = (g as Goal & { goal_stages?: { status: string }[] }).goal_stages ?? [];
                const done = stages.filter((s) => s.status === "concluida").length;
                const pct = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
                return (
                  <button key={g.id} type="button" onClick={() => router.push(`/metas/${g.id}`)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                    borderRadius: 13, border: "1.5px solid oklch(.88 .02 160)",
                    background: "#fff", cursor: "pointer", textAlign: "left",
                    width: "100%",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: fl(), display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Target size={16} style={{ color: fc() }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "oklch(.25 .02 160)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.title}
                      </p>
                      <div style={{ height: 4, borderRadius: 9999, background: "oklch(.92 .02 160)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 9999, background: fc(), width: `${pct}%`, transition: "width .5s ease" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: fc(), flexShrink: 0 }}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── FAB ── */}
      <button
        type="button"
        onClick={() => setShowAddType(true)}
        style={{
          position: "fixed", bottom: 88, right: 20, zIndex: 40,
          width: 56, height: 56, borderRadius: "50%", border: 0, cursor: "pointer",
          background: fc(),
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px oklch(.5 .14 160 / .45)",
          transition: "transform .15s ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        <Plus size={26} color="#fff" />
      </button>

      {/* ── Add type sheet ── */}
      {showAddType && (
        <AddTypeSheet
          lang={lang}
          onManual={() => setShowAdd(true)}
          onPhoto={() => router.push("/financas/registrar")}
          onClose={() => setShowAddType(false)}
        />
      )}

      {/* ── Modals ── */}
      {(showAdd || editTx) && (
        <TransactionModal
          initial={editTx}
          onClose={() => { setShowAdd(false); setEditTx(null); }}
          onSaved={load}
          lang={lang}
          currency={currency}
          customCat={customCat}
          onCustomCatUpdated={setCustomCat}
        />
      )}
      {showBudget && (
        <BudgetModal
          budgets={budgets}
          month={currentMonth}
          onClose={() => setShowBudget(false)}
          onSaved={load}
          lang={lang}
          currency={currency}
          customCat={customCat}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
