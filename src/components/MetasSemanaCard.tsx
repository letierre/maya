"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";

interface Stage { id: string; title: string; status: string; }
interface Goal { id: string; title: string; status: string; goal_stages?: Stage[]; }

/**
 * "Metas da semana" — lista metas ativas com o próximo estágio pendente como
 * checkbox. Concluir/desfazer um estágio direto da home (PATCH do estágio).
 */
export function MetasSemanaCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[] | null>(null);

  useEffect(() => {
    cachedFetch<Goal[]>("/api/goals")
      .then((g) => setGoals(g ?? []))
      .catch(() => setGoals([]));
  }, []);

  const active = (goals ?? [])
    .filter((g) => g.status === "ativa" || g.status === "pausada")
    .slice(0, 3);

  if (goals === null || active.length === 0) return null;

  const toggle = async (goal: Goal, stage: Stage) => {
    const next = stage.status === "concluida" ? "pendente" : "concluida";
    setGoals((prev) =>
      (prev ?? []).map((g) =>
        g.id === goal.id
          ? {
              ...g,
              goal_stages: (g.goal_stages ?? []).map((s) =>
                s.id === stage.id ? { ...s, status: next } : s,
              ),
            }
          : g,
      ),
    );
    try {
      await fetch(`/api/goals/${goal.id}/stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    } catch {}
  };

  return (
    <div className="px-3.5 pt-4">
      <div
        className="rounded-[18px] px-4 pt-4 pb-[14px] relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(124,92,255,.16), rgba(167,139,250,.05))",
          border: "1px solid rgba(167,139,250,.22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "#A78BFA" }}>
            {t("mws_titulo")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/agenda?tab=metas")}
            className="inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-[11px] font-semibold"
            style={{ color: "#A78BFA" }}
          >
            {t("mws_ver_todas")} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {active.map((goal) => {
            const stages = goal.goal_stages ?? [];
            const done = stages.filter((s) => s.status === "concluida").length;
            const allDone = stages.length > 0 && done === stages.length;
            const next = stages.find((s) => s.status !== "concluida") ?? null;

            return (
              <div key={goal.id} className="flex items-center gap-2.5 py-1.5">
                <button
                  type="button"
                  aria-label={allDone ? t("mws_concluida") : goal.title}
                  onClick={() => { if (next) toggle(goal, next); }}
                  disabled={!next}
                  className="size-[20px] rounded-md flex-none flex items-center justify-center"
                  style={{
                    background: allDone ? "#7C5CFF" : "transparent",
                    border: allDone ? "none" : "1.5px solid rgba(167,139,250,.45)",
                    cursor: next ? "pointer" : "default",
                  }}
                >
                  {allDone && <span style={{ color: "#fff", fontSize: 12, lineHeight: 1 }}>✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className="m-0 text-[13px] font-semibold leading-tight truncate"
                    style={{
                      color: allDone ? "#9e96b5" : "#e0d6ff",
                      textDecoration: allDone ? "line-through" : "none",
                    }}
                  >
                    {goal.title}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                    {allDone
                      ? t("mws_concluida")
                      : next
                        ? next.title
                        : t("mws_sem_etapas")}
                  </p>
                </div>

                {stages.length > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                    {done}/{stages.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
