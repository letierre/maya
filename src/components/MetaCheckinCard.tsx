"use client";

import { useEffect, useState } from "react";
import { AREA_CONFIG } from "@/lib/planejamento-constants";

type Status = "avançou" | "parcial" | "nao";

interface MetaStatus {
  goal_id: string;
  title: string;
  area: string;
  status: Status | null;
  locked: boolean;
  effective: Status | null;
  streak: number;
  doneToday: string[];
  doneTodayCount: number;
}

const OPTIONS: { key: Status; label: string; emoji: string }[] = [
  { key: "avançou", label: "Avançou", emoji: "✓" },
  { key: "parcial", label: "Parcial", emoji: "~" },
  { key: "nao", label: "Não", emoji: "✗" },
];

function feedbackFor(status: Status): string {
  switch (status) {
    case "avançou": return "🔥 Mandou bem. Continue!";
    case "parcial": return "Metade é melhor que nada. O que faltou?";
    case "nao": return "O que te travou hoje? Amanhã é um novo dia.";
  }
}

/**
 * Card "🎯 Metas" no editor do check-in — a "voz do crescimento" da Maya.
 * Uma linha por meta ativa. Se uma atividade ligada à meta foi concluída hoje,
 * o "Avançou" fica travado (não dá pra desmarcar); caso contrário, o usuário
 * reflete com um toque (Avançou / Parcial / Não — com desconforto no "Não").
 */
export function MetaCheckinCard({ date }: { date: string }) {
  const [statuses, setStatuses] = useState<MetaStatus[] | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/goal-daily-status?date=${date}`);
      const data = await r.json();
      if (Array.isArray(data.statuses)) setStatuses(data.statuses);
    } catch {}
  };

  useEffect(() => { load(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!statuses || statuses.length === 0) return null;

  const mark = async (goalId: string, status: Status) => {
    if (savingId) return;
    setSavingId(goalId);
    setStatuses((prev) => (prev ?? []).map((s) =>
      s.goal_id === goalId ? { ...s, effective: status, status } : s,
    ));
    setFeedback((f) => ({ ...f, [goalId]: feedbackFor(status) }));
    try {
      await fetch("/api/goal-daily-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_id: goalId, date, status }),
      });
      await load();
    } catch {}
    setSavingId(null);
  };

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 14,
      background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
      border: "1px solid oklch(0.5 0.12 270 / .12)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>🎯 Metas</span>
        <span style={{ fontSize: 11, color: "#9e96b5", textAlign: "right" }}>Como a meta andou hoje?</span>
      </div>

      {statuses.map((s, i) => {
        const area = AREA_CONFIG[s.area as keyof typeof AREA_CONFIG] || { emoji: "🎯", hue: 270 };
        const fb = feedback[s.goal_id];

        return (
          <div key={s.goal_id} style={{
            padding: "11px 0 3px",
            borderTop: i > 0 ? "1px solid oklch(0.28 0.02 270 / 0.4)" : "none",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>{area.emoji}</span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.3, minWidth: 0 }}>
                {s.title}
              </span>
              {s.streak >= 1 && (
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#F59E0B",
                  background: "oklch(0.14 0.012 270 / 0.9)", borderRadius: 9999, padding: "2px 8px",
                  whiteSpace: "nowrap",
                }}>
                  🔥 {s.streak} {s.streak === 1 ? "dia" : "dias"}
                </span>
              )}
            </div>

            {/* Contexto automático do dia */}
            {s.doneToday.length > 0 && (
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5", lineHeight: 1.4 }}>
                Hoje: {s.doneToday.slice(0, 3).map((t) => `✓ ${t}`).join(" · ")}
              </p>
            )}

            {/* Travado (concluiu atividade hoje) */}
            {s.locked ? (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 9999,
                background: "rgba(94,234,212,0.12)", border: "1px solid rgba(94,234,212,0.25)",
                color: "#5EEAD4", fontSize: 12, fontWeight: 700,
              }}>
                <span>✓</span> Avançou hoje
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                {OPTIONS.map((opt) => {
                  const active = s.effective === opt.key;
                  const isNao = opt.key === "nao";
                  return (
                    <button key={opt.key} type="button"
                      onClick={() => mark(s.goal_id, opt.key)}
                      disabled={savingId === s.goal_id}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 11, border: 0,
                        cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                        transition: "all .15s ease",
                        background: active
                          ? isNao ? "rgba(255,92,92,0.2)" : "#7C5CFF"
                          : "oklch(0.14 0.012 270)",
                        color: active ? (isNao ? "#FF5C5C" : "#fff") : "#9e96b5",
                        outline: active
                          ? isNao ? "1.5px solid rgba(255,92,92,0.45)" : "none"
                          : "1px solid oklch(0.5 0.12 270 / .1)",
                        opacity: savingId === s.goal_id ? 0.6 : 1,
                      }}>
                      {opt.emoji} {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Reação da Maya */}
            {fb && (
              <p style={{
                margin: "9px 0 2px", fontSize: 11.5, lineHeight: 1.45, fontStyle: "italic",
                color: "oklch(0.62 0.03 270)",
              }}>
                💬 {fb}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
