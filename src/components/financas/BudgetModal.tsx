"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FinancialBudget } from "@/types";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { mergeCats, type FinCat, type CustomCat, type UserCategory, type SubcatOverrides } from "@/lib/financas-categories";

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
  budgets, month, onClose, onSaved, lang, currency, customCat, userCategories, hiddenCatIds, subcatOverrides,
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
      }

      // Linhas antigas que não estão mais no novo estado → apagar depois
      for (const sub of oldSubs) {
        if (!newSubs.includes(sub)) deleteOps.push({ category: c.id, subcategory: sub });
      }
    }

    // 1) Grava tudo primeiro; só apaga o que saiu se todos os POST derem certo.
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
            const isOpen = !!expanded[c.id];
            const subMode = hasSubBudget(c);
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
                      {subTotal(c).toLocaleString()}
                    </span>
                  ) : (
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
                  )}
                </div>

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
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="10"
                            value={values[key] ?? ""}
                            onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder="—"
                            style={inputS}
                          />
                        </div>
                      );
                    })}
                    {/* "Outros" — catch-all próprio de cada categoria (restante sem subcategoria específica) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid rgba(167,139,250,0.12)" }}>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#A78BFA" }}>
                        {tFn(lang, "fin_cat_outros")}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="10"
                        value={values[`${c.id}::__outros__`] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [`${c.id}::__outros__`]: e.target.value }))}
                        placeholder="—"
                        style={inputS}
                      />
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

        {error && (
          <p style={{ margin: "16px 0 0", fontSize: 12, fontWeight: 600, color: "#FF5C5C", textAlign: "center" }}>
            {error}
          </p>
        )}
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
