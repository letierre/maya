"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Repeat } from "lucide-react";
import type { FinancialBudget, FinancialRecurringBudget } from "@/types";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { mergeCats, type FinCat, type CustomCat, type UserCategory, type SubcatOverrides } from "@/lib/financas-categories";
import { addMonths, monthsBetween, monthInRange } from "@/lib/financas-budget";

type RecurMode = "once" | "months" | "forever";
type RecurScope = "this_month" | "future";

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

function formatTotal(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "pt-BR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale).format(amount);
  }
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

  // Segmento recorrente ativo no mês que está sendo editado (com segmentos,
  // pode haver vários por chave; só o ativo importa aqui).
  const activeSegment = (category: string, subcategory: string): FinancialRecurringBudget | undefined =>
    recurringBudgets.find((r) =>
      r.category === category && r.subcategory === subcategory && monthInRange(r.start_month, month, r.end_month)
    );

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
  const [prompting, setPrompting] = useState(false);

  // Recorrência por linha de orçamento. Key = `${cat.id}` (categoria toda) ou
  // `${cat.id}::${sub}` (subcategoria/outros). Inicializa a partir do segmento
  // ativo no mês atual (não do último template da lista).
  const [recur, setRecur] = useState<Record<string, { mode: RecurMode; count: number }>>(() => {
    const init: Record<string, { mode: RecurMode; count: number }> = {};
    for (const c of cats) {
      const keys = [c.id, ...c.subcats.map((sc) => `${c.id}::${sc.label}`), `${c.id}::__outros__`];
      for (const key of keys) {
        const sub = key === c.id ? "" : key.slice(c.id.length + 2);
        const t = activeSegment(c.id, sub);
        if (!t) continue;
        init[key] = t.end_month === null
          ? { mode: "forever", count: 0 }
          : { mode: "months", count: monthsBetween(t.start_month, t.end_month) };
      }
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

  // Total planejado exibido no rodapé: soma das subcategorias (quando há) ou do valor da categoria.
  const plannedTotal = cats.reduce(
    (sum, c) => (hasSubBudget(c) ? sum + subTotal(c) : sum + (Number(values[c.id]) || 0)),
    0,
  );

  // Linhas recorrentes cujo VALOR foi alterado (para decidir se o prompt aparece).
  const changedLines = (): { category: string; subcategory: string }[] => {
    const out: { category: string; subcategory: string }[] = [];
    for (const c of cats) {
      const subVals = subcatKeys(c).filter((k) => values[k] && Number(values[k]) > 0);
      const catVal = values[c.id];
      const hasCatVal = !!catVal && Number(catVal) > 0;
      const newSubs = subVals.length > 0
        ? subVals.map((k) => k.slice(c.id.length + 2))
        : (hasCatVal ? [""] : []);
      for (const sub of newSubs) {
        const key = sub === "" ? c.id : `${c.id}::${sub}`;
        const rec = recur[key] ?? { mode: "once" as RecurMode, count: 3 };
        if (rec.mode === "once") continue;
        const active = activeSegment(c.id, sub);
        if (!active) continue;
        const val = sub === "" ? Number(catVal) : Number(values[`${c.id}::${sub}`]);
        if (Number(active.monthly_limit) !== val) out.push({ category: c.id, subcategory: sub });
      }
    }
    return out;
  };

  const handleSave = () => {
    setError("");
    if (changedLines().length > 0) {
      setPrompting(true);
      return;
    }
    void doSave("future");
  };

  const chooseScope = (scope: RecurScope) => {
    setPrompting(false);
    void doSave(scope);
  };

  // Monta o plano de operações (linhas explícitas + templates de recorrência).
  const buildPlan = (scope: RecurScope) => {
    const postOps: Promise<{ ok: boolean; error?: string }>[] = [];
    const deleteOps: { category: string; subcategory: string }[] = [];
    const recurOps: Promise<{ ok: boolean; error?: string }>[] = [];
    const recurDeleteOps: { category: string; subcategory: string }[] = [];

    const pushRecur = (category: string, subcategory: string, monthlyLimit: number, startMonth: string, endMonth: string | null) => {
      recurOps.push(
        fetch("/api/financas/budgets/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, subcategory, monthly_limit: monthlyLimit, start_month: startMonth, end_month: endMonth }),
        }).then(async (r) => {
          if (r.ok) return { ok: true };
          const body = await r.json().catch(() => null);
          return { ok: false, error: body?.error ?? `HTTP ${r.status}` };
        })
      );
    };

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

        const key = sub === "" ? c.id : `${c.id}::${sub}`;
        const rec = recur[key] ?? { mode: "once" as RecurMode, count: 3 };
        const active = activeSegment(c.id, sub);

        if (rec.mode === "once") {
          if (active) {
            // Parar a recorrência ("1×"): fecha a série no mês atual, preservando o histórico.
            pushRecur(c.id, sub, Number(active.monthly_limit), active.start_month, month);
          }
        } else {
          const targetEnd = rec.mode === "forever" ? null : addMonths(month, rec.count - 1);
          const valueChanged = active !== undefined && Number(active.monthly_limit) !== val;

          if (!active) {
            pushRecur(c.id, sub, val, month, targetEnd);
          } else if (!valueChanged) {
            // Mesmo valor → muda só a duração (mantém o start original do segmento).
            const startMonth = active.start_month;
            const endMonth = rec.mode === "forever" ? null : addMonths(startMonth, rec.count - 1);
            pushRecur(c.id, sub, Number(active.monthly_limit), startMonth, endMonth);
          } else if (scope === "this_month") {
            // Valor novo só neste mês: a linha explícita já cobre o mês atual; o
            // template segue com o valor/duração antigos (sem operação aqui).
          } else {
            // "future": divide a série — fecha o trecho antigo no mês anterior e
            // abre um novo segmento a partir do mês atual com o valor novo.
            if (active.start_month < month) {
              pushRecur(c.id, sub, Number(active.monthly_limit), active.start_month, addMonths(month, -1));
            }
            pushRecur(c.id, sub, val, month, targetEnd);
          }
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

    return { postOps, deleteOps, recurOps, recurDeleteOps };
  };

  const executePlan = async (plan: {
    postOps: Promise<{ ok: boolean; error?: string }>[];
    deleteOps: { category: string; subcategory: string }[];
    recurOps: Promise<{ ok: boolean; error?: string }>[];
    recurDeleteOps: { category: string; subcategory: string }[];
  }) => {
    // 1) Grava as linhas explícitas; só apaga o que saiu se todos os POST derem certo.
    const postResults = await Promise.all(plan.postOps);
    const firstFail = postResults.find((r) => !r.ok);
    if (firstFail) {
      setSaving(false);
      setError(`Não foi possível salvar: ${firstFail.error ?? "erro desconhecido"}`);
      return;
    }

    await Promise.all(
      plan.deleteOps.map(({ category, subcategory }) =>
        fetch("/api/financas/budgets", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, subcategory, month }),
        })
      )
    );

    // 2) Reconcilia os templates de recorrência (idempotente).
    const recurResults = await Promise.all(plan.recurOps);
    const recurFail = recurResults.find((r) => !r.ok);
    if (recurFail) {
      setSaving(false);
      setError(`Orçamento salvo, mas a recorrência falhou: ${recurFail.error ?? "erro desconhecido"}`);
      return;
    }
    await Promise.all(
      plan.recurDeleteOps.map(({ category, subcategory }) =>
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

  const doSave = async (scope: RecurScope) => {
    setSaving(true);
    setError("");
    await executePlan(buildPlan(scope));
  };

  const inputS: React.CSSProperties = {
    width: 110, padding: "8px 10px", borderRadius: 10,
    border: "1px solid rgba(167,139,250,0.2)",
    background: "#0B0B10", fontFamily: "inherit",
    fontSize: 13, fontWeight: 700, color: "#e0d6ff", outline: "none",
    textAlign: "right",
  };

  // Controle de recorrência: "1×" (este mês), "N×" (por N meses), "∞" (sempre).
  const recurControl = (key: string) => {
    const r = recur[key] ?? { mode: "once" as RecurMode, count: 3 };
    const active = r.mode !== "once";

    const seg = (mode: RecurMode, label: string, hint: string) => {
      const on = r.mode === mode;
      return (
        <button
          key={mode}
          type="button"
          title={hint}
          onClick={() => setRecur((p) => ({ ...p, [key]: { mode, count: p[key]?.count ?? 3 } }))}
          style={{
            padding: "8px 12px", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: mode === "forever" ? 18 : 12.5, fontWeight: 700, lineHeight: 1,
            background: on ? "rgba(124,92,255,0.24)" : "transparent",
            color: on ? "#A78BFA" : "#9e96b5",
            transition: "all .15s ease",
          }}
        >
          {label}
        </button>
      );
    };

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Repeat size={13} style={{ color: active ? "#A78BFA" : "#9e96b5" }} />
        <div style={{
          display: "flex", alignItems: "center", background: "#0B0B10",
          border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, overflow: "hidden",
        }}>
          {seg("once", "1×", "Só este mês")}
          {seg("months", "N×", "Repetir por N meses")}
          {seg("forever", "∞", "Sempre")}
        </div>
        {r.mode === "months" && (
          <div title="Número de meses" style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#0B0B10", border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 10, padding: "0 9px",
          }}>
            <input
              type="number"
              min={2}
              max={120}
              value={r.count}
              onChange={(e) => setRecur((p) => ({ ...p, [key]: { mode: "months", count: Math.max(2, Number(e.target.value) || 2) } }))}
              style={{
                width: 28, padding: "8px 0", border: 0, outline: "none",
                background: "transparent", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 700, color: "#e0d6ff", textAlign: "center",
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9e96b5" }}>m</span>
          </div>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 2px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#9e96b5" }}>
              Total planejado
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#e0d6ff" }}>
              {formatTotal(plannedTotal, currency)}
            </span>
          </div>
          {error && (
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, color: "#FF5C5C", textAlign: "center" }}>
              {error}
            </p>
          )}
          <button type="button" onClick={handleSave} disabled={saving} style={{
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

      {prompting && (
        <>
          <div onClick={() => setPrompting(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{
              width: "100%", maxWidth: 340, background: "#151520", borderRadius: 20, padding: 22,
              border: "1px solid rgba(167,139,250,0.2)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>
                Valor recorrente alterado
              </h3>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "#9e96b5", lineHeight: 1.5 }}>
                Você mudou o valor de um orçamento que se repete. O novo valor vale para...
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" onClick={() => chooseScope("this_month")} style={{
                  padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer",
                  background: "transparent", color: "#e0d6ff", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                }}>
                  Este mês apenas
                </button>
                <button type="button" onClick={() => chooseScope("future")} style={{
                  padding: "12px 14px", borderRadius: 12, border: 0, cursor: "pointer",
                  background: "#7C5CFF", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                }}>
                  Este mês em diante
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
