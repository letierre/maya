"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Repeat } from "lucide-react";
import type { FinancialBudget, FinancialRecurringBudget } from "@/types";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { mergeCats, type FinCat, type CustomCat, type UserCategory, type SubcatOverrides } from "@/lib/financas-categories";
import { addMonths, monthsBetween } from "@/lib/financas-budget";

type RecurMode = "once" | "months" | "forever";

function catLabel(c: FinCat, lang: Lang, customCat: CustomCat | null, userCategories: UserCategory[]): string {
  if (c.custom) {
    if (c.id.startsWith("user_")) {
      return userCategories.find((u) => `user_${u.id}` === c.id)?.name ?? tFn(lang, "fin_cat_outros");
    }
    return customCat?.name ?? tFn(lang, "fin_cat_personalizada");
  }
  return tFn(lang, `fin_cat_${c.id}`);
}

const CURRENCY_LOCALE: Record<string, string> = {
  CLP: "es-CL", ARS: "es-AR", BRL: "pt-BR", MXN: "es-MX",
  USD: "en-US", EUR: "de-DE", GBP: "en-GB", COP: "es-CO",
};

// Guarda só os dígitos; formata com separador de milhar conforme a moeda.
function formatMoney(raw: string, currency: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (Number.isNaN(n)) return "";
  const locale = CURRENCY_LOCALE[currency] ?? "pt-BR";
  return new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(n);
}

function parseMoney(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

export function BudgetModal({
  budgets, month, onClose, onSaved, lang, currency, customCat, userCategories, hiddenCatIds, subcatOverrides, recurringBudgets,
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
  subcatOverrides?: SubcatOverrides;
  recurringBudgets: FinancialRecurringBudget[];
}) {
  const cats = mergeCats("despesa", hiddenCatIds, userCategories, customCat, subcatOverrides);

  // Chaves dos valores:
  //   "categoria"            → orçamento da categoria toda
  //   "categoria::sub"       → orçamento da subcategoria
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const b of budgets) {
      const key = b.subcategory ? `${b.category}::${b.subcategory}` : b.category;
      init[key] = String(b.monthly_limit);
    }
    return init;
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const b of budgets) {
      if (b.subcategory) init[b.category] = true;
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Recorrência por linha de orçamento. Key = `${cat.id}` (categoria toda) ou
  // `${cat.id}::${sub}` (subcategoria/outros). Inicializa a partir dos templates.
  const [recur, setRecur] = useState<Record<string, { mode: RecurMode; count: number }>>(() => {
    const init: Record<string, { mode: RecurMode; count: number }> = {};
    for (const t of recurringBudgets) {
      const key = t.subcategory === "" ? t.category : `${t.category}::${t.subcategory}`;
      if (t.end_month === null) init[key] = { mode: "forever", count: 0 };
      else init[key] = { mode: "months", count: monthsBetween(t.start_month, t.end_month) };
    }
    return init;
  });

  const subcatKeys = (c: FinCat) => [
    ...c.subcats.map((sc) => `${c.id}::${sc.label}`),
    `${c.id}::__outros__`,
  ];
  const hasSubBudget = (c: FinCat) =>
    subcatKeys(c).some((k) => values[k] && Number(values[k]) > 0);
  const subTotal = (c: FinCat) =>
    subcatKeys(c).reduce((s, k) => s + (Number(values[k]) || 0), 0);

  const save = async () => {
    setSaving(true);
    setError("");

    const postOps: Promise<{ ok: boolean; error?: string }>[] = [];
    const deleteOps: { category: string; subcategory: string }[] = [];
    const recurOps: Promise<{ ok: boolean; error?: string }>[] = [];
    const recurDeleteOps: { category: string; subcategory: string }[] = [];

    for (const c of cats) {
      const subVals = subcatKeys(c).filter((k) => values[k] && Number(values[k]) > 0);
      const catVal = values[c.id];
      const hasCatVal = !!catVal && Number(catVal) > 0;

      // Novo estado da categoria: lista de subcategorias, ou [""] (categoria toda), ou [] (limpa).
      const newSubs = subVals.length > 0
        ? subVals.map((k) => k.slice(c.id.length + 2))
        : (hasCatVal ? [""] : []);

      const oldSubs = budgets
        .filter((b) => b.category === c.id)
        .map((b) => b.subcategory ?? "");

      // Upsert das linhas novas (não-destrutivo)
      for (const sub of newSubs) {
        const val = sub === "" ? Number(catVal) : Number(values[`${c.id}::${sub}`]);
        postOps.push(
          fetch("/api/financas/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: c.id, subcategory: sub, monthly_limit: val, month }),
          }).then(async (r) => {
            if (r.ok) return { ok: true };
            const body = await r.json().catch(() => null);
            return { ok: false, error: body?.error ?? `HTTP ${r.status}` };
          })
        );

        // Recorrência da linha (template). Preserva o start_month original se já existir.
        const key = sub === "" ? c.id : `${c.id}::${sub}`;
        const rec = recur[key] ?? { mode: "once" as RecurMode, count: 3 };
        const existing = recurringBudgets.find((r) => r.category === c.id && r.subcategory === sub);
        if (rec.mode !== "once") {
          const startMonth = existing?.start_month ?? month;
          const endMonth = rec.mode === "forever" ? null : addMonths(startMonth, rec.count - 1);
          recurOps.push(
            fetch("/api/financas/budgets/recurring", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ category: c.id, subcategory: sub, monthly_limit: val, start_month: startMonth, end_month: endMonth }),
            }).then(async (r) => {
              if (r.ok) return { ok: true };
              const body = await r.json().catch(() => null);
              return { ok: false, error: body?.error ?? `HTTP ${r.status}` };
            })
          );
        } else if (existing) {
          recurDeleteOps.push({ category: c.id, subcategory: sub });
        }
      }

      // Linhas antigas que não estão mais no novo estado → apagar explícita + template
      for (const sub of oldSubs) {
        if (!newSubs.includes(sub)) {
          deleteOps.push({ category: c.id, subcategory: sub });
          if (recurringBudgets.some((r) => r.category === c.id && r.subcategory === sub)) {
            recurDeleteOps.push({ category: c.id, subcategory: sub });
          }
        }
      }
    }

    // 1) Grava as linhas explícitas; só apaga o que saiu se todos os POST derem certo.
    const postResults = await Promise.all(postOps);
    const firstFail = postResults.find((r) => !r.ok);
    if (firstFail) {
      setSaving(false);
      setError(`Não foi possível salvar: ${firstFail.error ?? "erro desconhecido"}`);
      return;
    }

    await Promise.all(
      deleteOps.map(({ category, subcategory }) =>
        fetch("/api/financas/budgets", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, subcategory, month }),
        })
      )
    );

    // 2) Reconcilia os templates de recorrência (idempotente).
    const recurResults = await Promise.all(recurOps);
    const recurFail = recurResults.find((r) => !r.ok);
    if (recurFail) {
      setSaving(false);
      setError(`Orçamento salvo, mas a recorrência falhou: ${recurFail.error ?? "erro desconhecido"}`);
      return;
    }
    await Promise.all(
      recurDeleteOps.map(({ category, subcategory }) =>
        fetch("/api/financas/budgets/recurring", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, subcategory }),
        })
      )
    );

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

  const recurSelectS: React.CSSProperties = {
    width: 46, padding: "6px 2px", borderRadius: 8,
    border: "1px solid rgba(167,139,250,0.2)",
    background: "#0B0B10", fontFamily: "inherit",
    fontSize: 11, fontWeight: 700, color: "#A78BFA", outline: "none",
  };

  const recurMonthsS: React.CSSProperties = {
    width: 40, padding: "6px 2px", borderRadius: 8,
    border: "1px solid rgba(167,139,250,0.2)",
    background: "#0B0B10", fontFamily: "inherit",
    fontSize: 11, fontWeight: 700, color: "#e0d6ff", outline: "none",
    textAlign: "center",
  };

  // Controle de recorrência: "1×" (este mês), "N×" (por N meses), "∞" (sempre).
  const recurControl = (key: string) => {
    const r = recur[key] ?? { mode: "once" as RecurMode, count: 3 };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} title="Repetir nos próximos meses">
        <Repeat size={11} style={{ color: r.mode === "once" ? "#9e96b5" : "#A78BFA" }} />
        <select
          value={r.mode}
          onChange={(e) => setRecur((p) => ({ ...p, [key]: { mode: e.target.value as RecurMode, count: p[key]?.count ?? 3 } }))}
          style={recurSelectS}
        >
          <option value="once">1×</option>
          <option value="months">N×</option>
          <option value="forever">∞</option>
        </select>
        {r.mode === "months" && (
          <input
            type="number"
            min={2}
            max={120}
            value={r.count}
            onChange={(e) => setRecur((p) => ({ ...p, [key]: { mode: "months", count: Math.max(2, Number(e.target.value) || 2) } }))}
            style={recurMonthsS}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", animation: "overlayIn .2s ease" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px 0",
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
            const isOpen = !!expanded[c.id];
            const subMode = hasSubBudget(c);
            const catHasVal = !!values[c.id] && Number(values[c.id]) > 0;
            return (
              <div key={c.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                  {c.subcats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [c.id]: !isOpen }))}
                      style={{
                        border: 0, background: "transparent", cursor: "pointer", padding: 4,
                        color: "#9e96b5", display: "flex", alignItems: "center", gap: 2,
                        fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      }}
                    >
                      {tFn(lang, "fin_subcategoria")}
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                  {subMode ? (
                    <span style={{ ...inputS, display: "flex", alignItems: "center", justifyContent: "flex-end", border: "1px solid rgba(124,92,255,0.35)", color: "#A78BFA", opacity: 0.95, width: 110, boxSizing: "border-box" }}>
                      {formatMoney(String(subTotal(c)), currency)}
                    </span>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoney(values[c.id], currency)}
                      onChange={(e) => setValues((p) => ({ ...p, [c.id]: parseMoney(e.target.value) }))}
                      placeholder="—"
                      style={inputS}
                    />
                  )}
                </div>

                {!subMode && catHasVal && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    {recurControl(c.id)}
                  </div>
                )}

                {isOpen && c.subcats.length > 0 && (
                  <div style={{ marginTop: 6, marginLeft: 50, display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.subcats.map((sc) => {
                      const key = `${c.id}::${sc.label}`;
                      return (
                        <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#9e96b5" }}>
                            {sc.label}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatMoney(values[key], currency)}
                            onChange={(e) => setValues((p) => ({ ...p, [key]: parseMoney(e.target.value) }))}
                            placeholder="—"
                            style={inputS}
                          />
                          {!!values[key] && Number(values[key]) > 0 && recurControl(key)}
                        </div>
                      );
                    })}
                    {/* "Outros" — catch-all próprio de cada categoria (restante sem subcategoria específica) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid rgba(167,139,250,0.12)" }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#A78BFA" }}>
                        {tFn(lang, "fin_cat_outros")}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatMoney(values[`${c.id}::__outros__`], currency)}
                        onChange={(e) => setValues((p) => ({ ...p, [`${c.id}::__outros__`]: parseMoney(e.target.value) }))}
                        placeholder="—"
                        style={inputS}
                      />
                      {!!values[`${c.id}::__outros__`] && Number(values[`${c.id}::__outros__`]) > 0 && recurControl(`${c.id}::__outros__`)}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: "#9e96b5" }}>
                      {subMode
                        ? "Total da categoria = soma das subcategorias + outros"
                        : "Preencha subcategorias para planejar por item (o total vira a soma)"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          position: "sticky", bottom: 0, background: "#151520",
          paddingTop: 12, paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          borderTop: "1px solid rgba(167,139,250,0.15)",
        }}>
          {error && (
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, color: "#FF5C5C", textAlign: "center" }}>
              {error}
            </p>
          )}
          <button type="button" onClick={save} disabled={saving} style={{
            width: "100%", padding: "15px 20px", borderRadius: 14, border: 0,
            cursor: saving ? "not-allowed" : "pointer",
            background: saving ? "rgba(124,92,255,0.2)" : "#7C5CFF",
            fontFamily: "inherit", fontSize: 15, fontWeight: 700,
            color: saving ? "rgba(167,139,250,0.5)" : "#fff",
          }}>
            {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
          </button>
        </div>
      </div>
    </>
  );
}
