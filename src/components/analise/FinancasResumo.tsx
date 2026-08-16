"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import type { FinancialTransaction, FinancialBudget } from "@/types";
import { getCatById, type UserCategory } from "@/lib/financas-categories";
import { getLocalDate, formatLocalDate } from "@/lib/utils";
import { Section, CARD, FOREGROUND, MUTED, GREEN, RED } from "./Section";

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

function fmt(amount: number, currency: string): string {
  const conf = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
  try {
    return new Intl.NumberFormat(conf.locale, { style: "currency", currency: conf.code }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ── Labels ────────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  moradia: "Moradia",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude_beleza: "Saúde & Beleza",
  educacao: "Educação",
  lazer: "Lazer",
  pessoal: "Pessoal",
  servicos_fin: "Serviços financeiros",
  comunicacao: "Comunicação",
  doacoes: "Doações",
  pet: "Pet",
  personalizada: "Personalizada",
  outros: "Outros",
};

function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

// ── Date helpers (local timezone) ─────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

function weekdayShort(ds: string): string {
  return new Date(ds + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function weekStartOf(ds: string): string {
  const d = new Date(ds + "T12:00:00");
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); // desloca para a segunda-feira
  d.setDate(d.getDate() + diff);
  return formatLocalDate(d);
}

const PERIOD_DAYS = { semana: 7, mes: 30, trimestre: 90 } as const;
export type FinPeriod = keyof typeof PERIOD_DAYS;

export function FinancasResumo({ period }: { period: FinPeriod }) {
  const [txs, setTxs] = useState<FinancialTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinancialBudget[]>([]);
  const [currency, setCurrency] = useState("BRL");
  const [userCats, setUserCats] = useState<UserCategory[]>([]);

  useEffect(() => {
    safeCachedFetch<FinancialTransaction[]>("/api/financas/transactions?limit=500").then((d) => {
      if (Array.isArray(d)) setTxs(d);
    });
    safeCachedFetch<FinancialBudget[]>(`/api/financas/budgets?month=${getLocalDate().slice(0, 7)}`).then((d) => {
      if (Array.isArray(d)) setBudgets(d);
    });
    safeCachedFetch<{ context?: { currency?: string } }>("/api/preferences").then((p) => {
      if (p?.context?.currency) setCurrency(p.context.currency);
    });
    safeCachedFetch<{ categories?: UserCategory[] }>("/api/financas/categories").then((r) => {
      if (r?.categories) setUserCats(r.categories);
    });
  }, []);

  if (txs.length === 0 && budgets.length === 0) return null;

  const periodDays = PERIOD_DAYS[period];
  const periodLabel = period === "semana" ? "esta semana" : period === "mes" ? "este mês" : "este trimestre";
  const from = daysAgo(periodDays - 1);
  const to = daysAgo(0);
  const nowMonth = getLocalDate().slice(0, 7);

  const userCatById = new Map(userCats.map((uc) => [`user_${uc.id}`, uc]));
  const labelOf = (id: string): string => {
    const uc = userCatById.get(id);
    if (uc) return uc.name;
    return CAT_LABEL[id] ?? getCatById(id, "despesa").id;
  };
  const emojiOf = (id: string): string => {
    const uc = userCatById.get(id);
    if (uc) return uc.emoji;
    return getCatById(id, "despesa").emoji;
  };

  // ── totals do período ──
  const periodTxs = txs.filter((t) => t.date >= from && t.date <= to);
  const receitas = periodTxs.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
  const despesas = periodTxs.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
  const saldo = receitas - despesas;
  const savingsPct = receitas > 0 ? Math.round((saldo / receitas) * 100) : null;

  // ── gastos por categoria (período) ──
  const catTotals = new Map<string, number>();
  periodTxs.forEach((t) => {
    if (t.type !== "despesa") return;
    catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + t.amount);
  });
  const catEntries = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ── orçamento (mês calendário atual — só faz sentido no filtro "mês") ──
  const monthTxs = txs.filter((t) => t.date.slice(0, 7) === nowMonth);
  const budgetItems = budgets.map((b) => {
    const spent = monthTxs
      .filter((t) => t.type === "despesa" && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.monthly_limit > 0 ? Math.min((spent / b.monthly_limit) * 100, 100) : 0;
    return { b, spent, pct, over: spent > b.monthly_limit };
  });
  const totalLimit = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const totalSpent = budgetItems.reduce((s, i) => s + i.spent, 0);
  const totalPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
  const totalOver = totalSpent > totalLimit;

  // ── tendência (granularidade conforme o período) ──
  const byDate = new Map<string, { rec: number; des: number }>();
  txs.forEach((t) => {
    const cur = byDate.get(t.date) ?? { rec: 0, des: 0 };
    if (t.type === "receita") cur.rec += t.amount;
    else cur.des += t.amount;
    byDate.set(t.date, cur);
  });
  const saldoAt = (ds: string): number => {
    const e = byDate.get(ds);
    return e ? e.rec - e.des : 0;
  };

  let trend: { label: string; saldo: number }[];
  let trendTitle: string;
  if (period === "semana") {
    trendTitle = "Saldo · por dia";
    trend = Array.from({ length: 7 }, (_, i) => {
      const ds = daysAgo(6 - i);
      return { label: weekdayShort(ds), saldo: saldoAt(ds) };
    });
  } else if (period === "mes") {
    trendTitle = "Saldo · por semana";
    const weekMap = new Map<string, number>();
    for (let i = periodDays - 1; i >= 0; i--) {
      const ds = daysAgo(i);
      const wk = weekStartOf(ds);
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + saldoAt(ds));
    }
    trend = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wk, s]) => ({ label: String(new Date(wk + "T12:00:00").getDate()), saldo: s }));
  } else {
    trendTitle = "Saldo · por mês";
    const monthMap = new Map<string, number>();
    for (let i = periodDays - 1; i >= 0; i--) {
      const ds = daysAgo(i);
      const mk = ds.slice(0, 7);
      monthMap.set(mk, (monthMap.get(mk) ?? 0) + saldoAt(ds));
    }
    trend = [...monthMap.entries()].sort().map(([mk, s]) => ({ label: monthShort(mk), saldo: s }));
  }
  const maxAbs = Math.max(1, ...trend.map((t) => Math.abs(t.saldo)));

  const pillStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: 12,
    padding: "10px 12px",
    background: "oklch(0.2 0.02 270)",
  };

  return (
    <Section title="Finanças">
      <div style={{ ...CARD }}>
        {/* Saldo do período */}
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
          Saldo · {periodLabel}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 800, color: saldo >= 0 ? GREEN : RED, letterSpacing: "-0.02em" }}>
          {fmt(saldo, currency)}
        </p>

        {/* Receitas / despesas */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div style={pillStyle}>
            <p style={{ margin: 0, fontSize: 10, color: MUTED, fontWeight: 600 }}>Receitas</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 800, color: GREEN }}>{fmt(receitas, currency)}</p>
          </div>
          <div style={pillStyle}>
            <p style={{ margin: 0, fontSize: 10, color: MUTED, fontWeight: 600 }}>Despesas</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 800, color: RED }}>{fmt(despesas, currency)}</p>
          </div>
        </div>

        {/* Taxa de poupança */}
        {savingsPct != null && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: FOREGROUND, lineHeight: 1.4 }}>
            💰 Você poupou <span style={{ fontWeight: 700, color: savingsPct >= 0 ? GREEN : RED }}>{savingsPct}%</span> da sua renda {periodLabel}.
          </p>
        )}

        {/* Gastos por categoria */}
        {catEntries.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
              Gastos por categoria
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {catEntries.map(([id, total]) => {
                const pct = despesas > 0 ? Math.round((total / despesas) * 100) : 0;
                return (
                  <div key={id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{emojiOf(id)}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: FOREGROUND }}>{labelOf(id)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: FOREGROUND }}>{fmt(total, currency)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 9999, background: "oklch(0.25 0.02 270)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 9999,
                        background: "linear-gradient(90deg, #7C5CFF, #A78BFA)",
                        width: `${Math.max(pct, 2)}%`, transition: "width .5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Orçamento (apenas no mês) */}
        {period === "mes" && budgets.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
              Orçamento
            </p>
            {budgetItems.slice(0, 4).map(({ b, spent, pct, over }) => (
              <div key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{emojiOf(b.category)}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: FOREGROUND }}>{labelOf(b.category)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: over ? RED : MUTED }}>
                    {fmt(spent, currency)} / {fmt(b.monthly_limit, currency)}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 9999, background: "oklch(0.25 0.02 270)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 9999,
                    background: over ? RED : pct > 80 ? "#f59e0b" : GREEN,
                    width: `${pct}%`, transition: "width .5s ease",
                  }} />
                </div>
              </div>
            ))}
            {/* Total */}
            <div style={{ paddingTop: 10, borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: FOREGROUND }}>Total</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: totalOver ? RED : FOREGROUND }}>
                  {fmt(totalSpent, currency)}
                  <span style={{ fontWeight: 500, color: MUTED }}> / {fmt(totalLimit, currency)}</span>
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 9999, background: "oklch(0.25 0.02 270)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 9999,
                  background: totalOver ? RED : totalPct > 80 ? "#f59e0b" : GREEN,
                  width: `${totalPct}%`, transition: "width .5s ease",
                }} />
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: totalOver ? RED : MUTED, textAlign: "right" }}>
                {Math.round(totalPct)}% do orçamento total
              </p>
            </div>
          </div>
        )}

        {/* Tendência */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid oklch(0.28 0.02 270 / 0.5)" }}>
          <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>
            {trendTitle}
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 56 }}>
            {trend.map((t) => (
              <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}>
                <div style={{
                  width: "100%",
                  height: `${Math.max((Math.abs(t.saldo) / maxAbs) * 40, 3)}px`,
                  borderRadius: 5,
                  background: t.saldo >= 0 ? GREEN : RED,
                  opacity: t.saldo === 0 ? 0.35 : 1,
                }} />
                <span style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
