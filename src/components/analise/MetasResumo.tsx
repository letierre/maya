"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { AREA_CONFIG } from "@/lib/planejamento-constants";
import type { TaskArea } from "@/types";
import { Section, CARD, FOREGROUND, MUTED, LILAC, ProgressBar } from "./Section";

interface GoalStage { id: string; status: string; }
interface GoalSummary {
  id: string;
  title: string;
  area: string;
  status: string;
  goal_stages?: GoalStage[];
}

export function MetasResumo() {
  const [goals, setGoals] = useState<GoalSummary[]>([]);

  useEffect(() => {
    safeCachedFetch<GoalSummary[]>("/api/goals").then((data) => {
      if (Array.isArray(data)) setGoals(data);
    });
  }, []);

  const ativas = goals.filter((g) => g.status === "ativa");
  const concluidas = goals.filter((g) => g.status === "concluida");
  if (goals.length === 0) return null;

  return (
    <Section title="Suas metas">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Badge>{ativas.length} ativas</Badge>
          <Badge>{concluidas.length} concluídas</Badge>
        </div>

        {ativas.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
            Nenhuma meta ativa no momento.
          </p>
        ) : (
          ativas.slice(0, 5).map((g) => {
            const total = g.goal_stages?.length ?? 0;
            const done = g.goal_stages?.filter((s) => s.status === "concluida").length ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const emoji = AREA_CONFIG[g.area as TaskArea]?.emoji ?? "🎯";
            return (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 600,
                      color: FOREGROUND,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.title}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: LILAC }}>{pct}%</span>
                </div>
                <ProgressBar pct={pct} />
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: LILAC,
        background: "oklch(0.2 0.03 270)",
        borderRadius: 9999,
        padding: "5px 12px",
      }}
    >
      {children}
    </span>
  );
}
