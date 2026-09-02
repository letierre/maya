"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Target, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Settings, Repeat } from "lucide-react";
import type { FinancialTransaction, FinancialBudget, FinancialRecurringBudget, Goal } from "@/types";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { mergeCats, resolveCat, type FinCat, type CustomCat, type UserCategory, type SubcatOverrides } from "@/lib/financas-categories";
import { GoalCreateSheet } from "@/components/GoalCreateSheet";
import { TransactionModal } from "@/components/financas/TransactionModal";
import { BudgetModal } from "@/components/financas/BudgetModal";
import { AddTypeSheet } from "@/components/financas/AddTypeSheet";
import { CategoryManager } from "@/components/financas/CategoryManager";
import { FinanceSettingsSheet } from "@/components/financas/FinanceSettingsSheet";

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

// ── Category label helper ─────────────────────────────────────────────────────

function catLabel(c: FinCat, lang: Lang, customCat: CustomCat | null, userCategories: UserCategory[]): string {
  if (c.custom) {
    if (c.id.startsWith("user_")) {
      return userCategories.find((u) => `user_${u.id}` === c.id)?.name ?? tFn(lang, "fin_cat_outros");
    }
    return customCat?.name ?? tFn(lang, "fin_cat_personalizada");
  }
  return tFn(lang, `fin_cat_${c.id}`);
}

function catEmoji(c: FinCat, customCat: CustomCat | null): string {
  if (c.custom && !c.id.startsWith("user_")) return customCat?.emoji ?? c.emoji;
  return c.emoji;
}

type BudgetRow = {
  key: string;
  emoji: string;
  label: string;
  spent: number;
  limit: number | null; // null → linha "Outros" derivada (gasto residual, sem orçamento)
  pct: number;
  over: boolean;
  recurring?: boolean;
};

// Monta as linhas de orçamento para exibição, incluindo uma linha derivada "Outros"
// para categorias que usam orçamento por subcategoria (gasto que não bate com nenhuma
// subcategoria orçada). Categoria-level e subcategoria são mutuamente exclusivos no save.
function buildBudgetRows(
  budgets: FinancialBudget[],
  transactions: FinancialTransaction[],
  userCategories: UserCategory[],
  customCat: CustomCat | null,
  lang: Lang,
): BudgetRow[] {
  const rows: BudgetRow[] = [];
  const outrosLabel = tFn(lang, "fin_cat_outros");

  // Categorias orçadas por subcategoria (subcategoria !== "")
  const subBudgetedCats = new Set(budgets.filter((b) => b.subcategory).map((b) => b.category));

  // Gasto residual por categoria: não bate com nenhuma subcategoria específica orçada.
  // É o que alimenta a linha "Outros" (explícita ou derivada).
  const residualByCat = new Map<string, number>();
  for (const catId of subBudgetedCats) {
    const budgetedLabels = new Set(
      budgets
        .filter((b) => b.category === catId && b.subcategory && b.subcategory !== "__outros__")
        .map((b) => b.subcategory as string),
    );
    const residual = transactions
      .filter((t) => t.type === "despesa" && t.category === catId && !budgetedLabels.has(t.subcategory ?? ""))
      .reduce((s, t) => s + t.amount, 0);
    residualByCat.set(catId, residual);
  }

  for (const b of budgets) {
    const conf = resolveCat(b.category, "despesa", userCategories);
    const emoji = catEmoji(conf, customCat);
    const baseLabel = catLabel(conf, lang, customCat, userCategories);

    if (b.subcategory === "__outros__") {
      const spent = residualByCat.get(b.category) ?? 0;
      const pct = Math.min((spent / b.monthly_limit) * 100, 100);
      rows.push({ key: b.id, emoji, label: `${baseLabel} › ${outrosLabel}`, spent, limit: b.monthly_limit, pct, over: spent > b.monthly_limit, recurring: !!b.recurring });
    } else if (b.subcategory) {
      const spent = transactions
        .filter((t) => t.type === "despesa" && t.category === b.category && t.subcategory === b.subcategory)
        .reduce((s, t) => s + t.amount, 0);
      const pct = Math.min((spent / b.monthly_limit) * 100, 100);
      rows.push({ key: b.id, emoji, label: `${baseLabel} › ${b.subcategory}`, spent, limit: b.monthly_limit, pct, over: spent > b.monthly_limit, recurring: !!b.recurring });
    } else {
      const spent = transactions
        .filter((t) => t.type === "despesa" && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0);
      const pct = Math.min((spent / b.monthly_limit) * 100, 100);
      rows.push({ key: b.id, emoji, label: baseLabel, spent, limit: b.monthly_limit, pct, over: spent > b.monthly_limit, recurring: !!b.recurring });
    }
  }

  // "Outros" derivado (sem orçamento) só quando há gasto residual e a categoria
  // NÃO tem um orçamento "Outros" explícito.
  for (const catId of subBudgetedCats) {
    const hasOutrosBudget = budgets.some((b) => b.category === catId && b.subcategory === "__outros__");
    if (hasOutrosBudget) continue;
    const residual = residualByCat.get(catId) ?? 0;
    if (residual <= 0) continue;
    const conf = resolveCat(catId, "despesa", userCategories);
    const emoji = catEmoji(conf, customCat);
    const baseLabel = catLabel(conf, lang, customCat, userCategories);
    rows.push({ key: `${catId}::__outros__`, emoji, label: `${baseLabel} › ${outrosLabel}`, spent: residual, limit: null, pct: 0, over: true });
  }

  return rows;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG = "#0B0B10";
const SURFACE = "#151520";
const CARD = "#1a1530";
const BORDER = "rgba(167,139,250,0.15)";
const BORDER_ACTIVE = "rgba(167,139,250,0.3)";
const TEXT = "#e0d6ff";
const TEXT_SEC = "#9e96b5";
const ACCENT = "#7C5CFF";
const ACCENT_SOFT = "rgba(124,92,255,0.08)";
const RED = "#FF5C5C";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "overview" | "transactions" | "budget";

// ── Styles ────────────────────────────────────────────────────────────────────

const tabBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: "10px 0", border: 0, cursor: "pointer",
  background: "transparent", fontFamily: "inherit",
  fontSize: 13, fontWeight: 700,
  color: active ? TEXT : TEXT_SEC,
  borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
  transition: "all .15s ease",
});

const cardStyle: React.CSSProperties = {
  background: SURFACE, borderRadius: 18,
  border: `1px solid ${BORDER}`,
  overflow: "hidden",
};

const sectionTitle: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
  textTransform: "uppercase", color: TEXT_SEC,
};

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
        <div style={{
          width: "100%", maxWidth: 320, background: SURFACE, borderRadius: 20, padding: 24,
          border: `1px solid ${BORDER}`,
        }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: TEXT }}>Excluir transação?</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SEC }}>Esta ação não pode ser desfeita.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onCancel} style={{
              flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`,
              background: "transparent", color: TEXT_SEC, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} style={{
              flex: 1, padding: 12, borderRadius: 12, border: 0,
              background: RED, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              Excluir
            </button>
          </div>
        </div>
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
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [hiddenCatIds, setHiddenCatIds] = useState<string[]>([]);
  const [subcatOverrides, setSubcatOverrides] = useState<SubcatOverrides>({ hidden: {}, custom: {} });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [recurringBudgets, setRecurringBudgets] = useState<FinancialRecurringBudget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [showAddType, setShowAddType] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showGoalCreate, setShowGoalCreate] = useState(false);
  const [editTx, setEditTx] = useState<FinancialTransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedTxs, setExpandedTxs] = useState(false);
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  const currentMonth = monthKey(monthOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefsRes, txRes, budgetRes, goalsRes, catsRes, recurRes] = await Promise.all([
        fetch("/api/preferences").then((r) => r.json()),
        fetch(`/api/financas/transactions?month=${currentMonth}`).then((r) => r.json()),
        fetch(`/api/financas/budgets?month=${currentMonth}`).then((r) => r.json()),
        fetch("/api/goals").then((r) => r.json()),
        fetch("/api/financas/categories").then((r) => r.json()).catch(() => ({ categories: [], hiddenFinCats: [], hiddenFinSubcats: {}, customFinSubcats: {} })),
        fetch("/api/financas/budgets/recurring").then((r) => r.json()).catch(() => []),
      ]);
      if (prefsRes.context?.currency) setCurrency(prefsRes.context.currency);
      if (prefsRes.context?.custom_fin_cat) setCustomCat(prefsRes.context.custom_fin_cat);
      if (Array.isArray(txRes)) setTransactions(txRes);
      if (Array.isArray(budgetRes)) setBudgets(budgetRes);
      if (Array.isArray(recurRes)) setRecurringBudgets(recurRes);
      if (Array.isArray(goalsRes)) {
        setGoals(goalsRes.filter((g: Goal) => g.area === "financas" && (!g.source || g.source === "financas") && g.status === "ativa"));
      }
      if (catsRes?.categories) setUserCategories(catsRes.categories);
      if (catsRes?.hiddenFinCats) setHiddenCatIds(catsRes.hiddenFinCats);
      setSubcatOverrides({
        hidden: catsRes?.hiddenFinSubcats ?? {},
        custom: catsRes?.customFinSubcats ?? {},
      });
    } catch {
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);

  const deleteTx = async (id: string) => {
    try {
      const res = await fetch(`/api/financas/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transação excluída");
    } catch {
      toast.error("Erro ao excluir transação");
    }
    setDeleteId(null);
  };

  const selectCurrency = async (code: string) => {
    setCurrency(code);
    try {
      const prefsRes = await fetch("/api/preferences").then((r) => r.json());
      const ctx = prefsRes.context ?? {};
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { ...ctx, currency: code } }),
      });
      toast.success("Moeda atualizada");
    } catch {
      toast.error("Erro ao salvar moeda");
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalReceitas = transactions.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
  const totalDespesas = transactions.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
  const saldo = totalReceitas - totalDespesas;

  const spendByCategory = mergeCats("despesa", hiddenCatIds, userCategories, customCat, subcatOverrides)
    .map((c) => ({
      ...c,
      total: transactions.filter((t) => t.type === "despesa" && t.category === c.id).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Orçamentos visíveis (respeita categorias ocultas)
  const visibleBudgets = budgets.filter((b) => !hiddenCatIds.includes(b.category));

  const grouped = groupByDate(transactions);
  const visibleGrouped = expandedTxs ? grouped : grouped.slice(0, 5);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${ACCENT}`, borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, paddingBottom: 110 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ── Header ── */}
      <div style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% 0%, rgba(167,139,250,0.35) 0%, transparent 60%),
          linear-gradient(170deg, #1a1040 0%, #1a1530 40%, ${BG} 100%)
        `,
        padding: "44px 20px 28px", position: "relative", overflow: "hidden",
      }}>
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: -60, right: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,92,255,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "30%", right: "10%", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
        <div style={{ position: "absolute", top: "60%", left: "15%", width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Month navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button type="button" onClick={() => setMonthOffset((p) => p - 1)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}>
              <ChevronLeft size={17} color="#fff" />
            </button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 700, color: "#fff", textTransform: "capitalize", letterSpacing: "-0.01em" }}>
              {monthLabel(currentMonth, lang)}
            </span>
            <button type="button" onClick={() => setMonthOffset((p) => p + 1)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              background: "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}>
              <ChevronRight size={17} color="#fff" />
            </button>
            <button type="button" onClick={() => setShowSettings(true)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(10px)",
            }} title="Configurações">
              <Settings size={16} color="#fff" />
            </button>
          </div>

          {/* Balance */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>
              {tFn(lang, "fin_saldo")}
            </p>
            <p style={{
              margin: 0, fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: "-1.5px",
              textShadow: "0 2px 20px rgba(124,92,255,0.3)",
            }}>
              {fmt(saldo, currency)}
            </p>
          </div>

          {/* Receitas / Despesas pills */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 16,
              padding: "12px 14px", border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 10,
                  background: "rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrendingUp size={14} color="#4ade80" />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{tFn(lang, "fin_receitas")}</span>
              </div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>{fmt(totalReceitas, currency)}</p>
            </div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 16,
              padding: "12px 14px", border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 10,
                  background: "rgba(255,92,92,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrendingDown size={14} color="#f87171" />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{tFn(lang, "fin_despesas")}</span>
              </div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>{fmt(totalDespesas, currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", padding: "0 16px", background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <button type="button" onClick={() => setTab("overview")} style={tabBtn(tab === "overview")}>
          {tFn(lang, "fin_tab_overview")}
        </button>
        <button type="button" onClick={() => setTab("transactions")} style={tabBtn(tab === "transactions")}>
          {tFn(lang, "fin_transacoes")}
        </button>
        <button type="button" onClick={() => setTab("budget")} style={tabBtn(tab === "budget")}>
          {tFn(lang, "fin_orcamento")}
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ═══ TAB: VISÃO GERAL ═══ */}
        {tab === "overview" && (
          <>
            {/* Spending by category */}
            {spendByCategory.length > 0 && (
              <div style={cardStyle}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #5B3FCF)` }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={sectionTitle}>{tFn(lang, "fin_categorias_despesas")}</p>
                    <button type="button" onClick={() => setShowCategoryManager(true)} style={{
                      border: 0, background: "transparent", cursor: "pointer", padding: 4,
                      color: ACCENT, display: "flex", alignItems: "center", gap: 4,
                      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                    }}>
                      <Settings size={12} /> Gerenciar
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {spendByCategory.slice(0, 5).map((c) => {
                      const pct = totalDespesas > 0 ? (c.total / totalDespesas) * 100 : 0;
                      const label = catLabel(c, lang, customCat, userCategories);
                      const emoji = catEmoji(c, customCat);
                      return (
                        <div key={c.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 15 }}>{emoji}</span>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: TEXT }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: RED }}>{fmt(c.total, currency)}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 9999,
                              background: ACCENT,
                              width: `${Math.max(pct, 2)}%`, transition: "width .5s ease",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Budget summary */}
            {visibleBudgets.length > 0 && (() => {
              const allItems = buildBudgetRows(visibleBudgets, transactions, userCategories, customCat, lang);

              const visibleItems = budgetExpanded ? allItems : allItems.slice(0, 3);
              const hasMore = allItems.length > 3;

              const totalLimit = allItems.reduce((s, i) => s + (i.limit ?? 0), 0);
              const totalSpent = allItems.reduce((s, i) => s + i.spent, 0);
              const totalPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
              const totalOver = totalSpent > totalLimit;

              return (
              <div style={cardStyle}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #5B3FCF)` }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={sectionTitle}>{tFn(lang, "fin_orcamento")}</p>
                    <button type="button" onClick={() => { setTab("budget"); }} style={{
                      border: 0, background: "transparent", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: ACCENT, fontFamily: "inherit",
                    }}>
                      Editar →
                    </button>
                  </div>

                  {visibleItems.map(({ key, spent, pct, over, label, emoji, limit, recurring }) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15 }}>{emoji}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: TEXT }}>{label}{recurring && <Repeat size={11} style={{ color: ACCENT, verticalAlign: -1, marginLeft: 5 }} />}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: over ? RED : TEXT_SEC }}>
                          {fmt(spent, currency)}
                          {limit !== null && <span style={{ fontWeight: 500, color: TEXT_SEC }}> / {fmt(limit, currency)}</span>}
                        </span>
                      </div>
                      <div style={{ height: 5, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 9999,
                          background: over ? RED : pct > 80 ? AMBER : GREEN,
                          width: `${limit !== null ? pct : 100}%`, transition: "width .5s ease",
                        }} />
                      </div>
                    </div>
                  ))}

                  {/* Expand/collapse toggle */}
                  {hasMore && (
                    <button type="button" onClick={() => setBudgetExpanded(!budgetExpanded)} style={{
                      border: 0, background: "transparent", cursor: "pointer",
                      padding: "4px 0 10px", width: "100%",
                      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                      color: ACCENT, textAlign: "center",
                    }}>
                      {budgetExpanded ? "↑ Mostrar menos" : `↓ Mostrar todos (${allItems.length})`}
                    </button>
                  )}

                  {/* Total row */}
                  <div style={{
                    paddingTop: 10,
                    borderTop: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>Total</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: totalOver ? RED : TEXT }}>
                        {fmt(totalSpent, currency)}
                        <span style={{ fontWeight: 500, color: TEXT_SEC }}> / {fmt(totalLimit, currency)}</span>
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 9999,
                        background: totalOver ? RED : totalPct > 80 ? AMBER : GREEN,
                        width: `${totalPct}%`, transition: "width .5s ease",
                      }} />
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: totalOver ? RED : TEXT_SEC, textAlign: "right" }}>
                      {Math.round(totalPct)}% do orçamento total
                    </p>
                  </div>

                  {/* Projeção: receitas do mês − orçamento planejado */}
                  <div style={{
                    marginTop: 12, padding: "12px 14px", borderRadius: 12,
                    background: "rgba(124,92,255,0.06)", border: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: TEXT_SEC }}>
                        Sobra projetada
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: (totalReceitas - totalLimit) >= 0 ? GREEN : RED }}>
                        {fmt(totalReceitas - totalLimit, currency)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT_SEC }}>
                      <span>Receitas {fmt(totalReceitas, currency)}</span>
                      <span>− Orçamento {fmt(totalLimit, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Financial goals */}
            <div style={cardStyle}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #5B3FCF)` }} />
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: goals.length > 0 ? 12 : 0 }}>
                  <p style={sectionTitle}>{tFn(lang, "fin_metas_fin")}</p>
                  <button type="button" onClick={() => setShowGoalCreate(true)} style={{
                    border: 0, background: ACCENT_SOFT, borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Plus size={11} /> {tFn(lang, "fin_criar_meta_fin")}
                  </button>
                </div>

                {goals.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
                    <Target size={28} style={{ color: TEXT_SEC, marginBottom: 8, opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, fontStyle: "italic" }}>
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
                        <button key={g.id} type="button" onClick={() => router.push("/agenda")} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "11px 12px",
                          borderRadius: 13, border: `1px solid ${BORDER}`,
                          background: CARD, cursor: "pointer", textAlign: "left",
                          width: "100%", fontFamily: "inherit",
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                            background: ACCENT_SOFT, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Target size={16} style={{ color: ACCENT }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.title}
                            </p>
                            <div style={{ height: 3, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 9999, background: ACCENT, width: `${pct}%`, transition: "width .5s ease" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{pct}%</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Empty state — no transactions & no budgets */}
            {transactions.length === 0 && budgets.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Wallet size={40} style={{ color: TEXT_SEC, marginBottom: 10, opacity: 0.4 }} />
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: TEXT }}>
                  {tFn(lang, "fin_sem_transacoes")}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
                  Toque em + para começar a registrar
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══ TAB: TRANSAÇÕES ═══ */}
        {tab === "transactions" && (
          <div style={cardStyle}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #5B3FCF)` }} />
            <div style={{ padding: "14px 16px" }}>
              {grouped.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0" }}>
                  <Wallet size={36} style={{ color: TEXT_SEC, marginBottom: 10, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, fontStyle: "italic" }}>
                    {tFn(lang, "fin_sem_transacoes")}
                  </p>
                </div>
              ) : (
                <>
                  {visibleGrouped.map(({ date, txs }) => (
                    <div key={date} style={{ marginBottom: 12 }}>
                      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: TEXT_SEC }}>
                        {fmtDateShort(date, lang)}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {txs.map((tx) => {
                          const conf = resolveCat(tx.category, tx.type, userCategories);
                          const isIncome = tx.type === "receita";
                          const catName = catLabel(conf, lang, customCat, userCategories);
                          const emoji = catEmoji(conf, customCat);
                          return (
                            <div key={tx.id} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                              borderRadius: 13, background: CARD,
                              border: `1px solid ${BORDER}`,
                            }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                                background: isIncome ? "rgba(34,197,94,0.08)" : ACCENT_SOFT,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
                              }}>
                                {emoji}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {tx.description || tx.subcategory || catName}
                                </p>
                                <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>
                                  {catName}{tx.subcategory ? ` › ${tx.subcategory}` : ""}
                                </p>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: isIncome ? GREEN : RED, flexShrink: 0 }}>
                                {isIncome ? "+" : "-"}{fmt(tx.amount, currency)}
                              </span>
                              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                                <button type="button" onClick={() => setEditTx(tx)} style={{ border: 0, background: "none", cursor: "pointer", padding: 6, color: TEXT_SEC }}>
                                  <Pencil size={13} />
                                </button>
                                <button type="button" onClick={() => setDeleteId(tx.id)} style={{ border: 0, background: "none", cursor: "pointer", padding: 6, color: RED }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ height: 1, background: BORDER, marginTop: 10 }} />
                    </div>
                  ))}

                  {grouped.length > 5 && (
                    <button type="button" onClick={() => setExpandedTxs(!expandedTxs)} style={{
                      width: "100%", padding: "10px 0", borderRadius: 12, border: 0, cursor: "pointer",
                      background: "transparent", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 600, color: ACCENT,
                    }}>
                      {expandedTxs ? "Mostrar menos ↑" : `Ver mais ${grouped.length - 5} dias ↓`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB: ORÇAMENTO ═══ */}
        {tab === "budget" && (
          <div style={cardStyle}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, #5B3FCF)` }} />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={sectionTitle}>{tFn(lang, "fin_orcamento_mensal")}</p>
                <button type="button" onClick={() => setShowBudget(true)} style={{
                  border: 0, background: ACCENT_SOFT, borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Pencil size={11} /> {tFn(lang, "fin_editar_orcamento")}
                </button>
              </div>

              {visibleBudgets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <Wallet size={32} style={{ color: TEXT_SEC, marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT_SEC }}>
                    Nenhum orçamento definido para este mês
                  </p>
                  <button type="button" onClick={() => setShowBudget(true)} style={{
                    padding: "10px 20px", borderRadius: 12, border: 0, cursor: "pointer",
                    background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  }}>
                    Definir orçamentos
                  </button>
                </div>
              ) : (
                (() => {
                  const items = buildBudgetRows(visibleBudgets, transactions, userCategories, customCat, lang);
                  const totalLimit = items.reduce((s, i) => s + (i.limit ?? 0), 0);
                  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
                  const totalPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
                  const totalOver = totalSpent > totalLimit;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.map(({ key, label, emoji, spent, pct, over, limit, recurring }) => (
                          <div key={key}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                              <span style={{ fontSize: 15 }}>{emoji}</span>
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: TEXT }}>{label}{recurring && <Repeat size={11} style={{ color: ACCENT, verticalAlign: -1, marginLeft: 5 }} />}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: over ? RED : TEXT_SEC }}>
                                {fmt(spent, currency)}
                                {limit !== null && <span style={{ fontWeight: 500, color: TEXT_SEC }}> / {fmt(limit, currency)}</span>}
                              </span>
                            </div>
                            <div style={{ height: 6, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 9999,
                                background: over ? RED : pct > 80 ? AMBER : GREEN,
                                width: `${limit !== null ? pct : 100}%`, transition: "width .5s ease",
                              }} />
                            </div>
                          </div>
                      ))}

                      {/* Total row */}
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${BORDER}`, marginTop: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>Total</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 12, fontWeight: 800, color: totalOver ? RED : TEXT }}>
                            {fmt(totalSpent, currency)}
                            <span style={{ fontWeight: 500, color: TEXT_SEC }}> / {fmt(totalLimit, currency)}</span>
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 9999, background: "rgba(167,139,250,0.08)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 9999,
                            background: totalOver ? RED : totalPct > 80 ? AMBER : GREEN,
                            width: `${totalPct}%`, transition: "width .5s ease",
                          }} />
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: 10, color: totalOver ? RED : TEXT_SEC, textAlign: "right" }}>
                          {Math.round(totalPct)}% do orçamento total
                        </p>
                      </div>

                      {/* Projeção: receitas do mês − orçamento planejado */}
                      <div style={{
                        marginTop: 12, padding: "12px 14px", borderRadius: 12,
                        background: "rgba(124,92,255,0.06)", border: `1px solid ${BORDER}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: TEXT_SEC }}>
                            Sobra projetada
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: (totalReceitas - totalLimit) >= 0 ? GREEN : RED }}>
                            {fmt(totalReceitas - totalLimit, currency)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT_SEC }}>
                          <span>Receitas {fmt(totalReceitas, currency)}</span>
                          <span>− Orçamento {fmt(totalLimit, currency)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── FAB ── */}
      <button
        type="button"
        onClick={() => setShowAddType(true)}
        style={{
          position: "fixed", bottom: 100, right: 20, zIndex: 40,
          width: 56, height: 56, borderRadius: "50%", border: 0, cursor: "pointer",
          background: ACCENT,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
          transition: "transform .15s ease",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        <Plus size={26} color="#fff" />
      </button>

      {/* ── Sheets & Modals ── */}
      {showAddType && (
        <AddTypeSheet
          lang={lang}
          onManual={() => setShowAdd(true)}
          onPhoto={() => router.push("/financas/registrar")}
          onBudget={() => setShowBudget(true)}
          onClose={() => setShowAddType(false)}
        />
      )}

      {(showAdd || editTx) && (
        <TransactionModal
          initial={editTx}
          onClose={() => { setShowAdd(false); setEditTx(null); }}
          onSaved={load}
          lang={lang}
          currency={currency}
          customCat={customCat}
          onCustomCatUpdated={setCustomCat}
          userCategories={userCategories}
          hiddenCatIds={hiddenCatIds}
          subcatOverrides={subcatOverrides}
          onManageCategories={() => {
            setShowAdd(false);
            setEditTx(null);
            setShowCategoryManager(true);
          }}
        />
      )}

      {showSettings && (
        <FinanceSettingsSheet
          currency={currency}
          onSelectCurrency={selectCurrency}
          onOpenCategories={() => { setShowSettings(false); setShowCategoryManager(true); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          type="despesa"
          hiddenIds={hiddenCatIds}
          userCategories={userCategories}
          customCat={customCat}
          lang={lang}
          subcatOverrides={subcatOverrides}
          onHiddenChange={setHiddenCatIds}
          onSubcatOverridesChange={setSubcatOverrides}
          onCategoriesChange={load}
          onClose={() => setShowCategoryManager(false)}
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
          userCategories={userCategories}
          hiddenCatIds={hiddenCatIds}
          subcatOverrides={subcatOverrides}
          recurringBudgets={recurringBudgets}
        />
      )}

      {showGoalCreate && (
        <GoalCreateSheet
          initialArea="financas"
          source="financas"
          onClose={() => setShowGoalCreate(false)}
          onCreated={load}
        />
      )}

      {deleteId && (
        <DeleteConfirm
          onConfirm={() => deleteTx(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
