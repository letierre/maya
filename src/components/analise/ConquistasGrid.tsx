"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { getLocalDateFromISO } from "@/lib/utils";
import type { UserAchievement } from "@/types";
import { Section, FOREGROUND } from "./Section";
import { useTranslation } from "@/lib/useTranslation";

export function ConquistasGrid({ from, to }: { from: string; to: string }) {
  const { t } = useTranslation();
  const [achs, setAchs] = useState<UserAchievement[]>([]);

  useEffect(() => {
    safeCachedFetch<UserAchievement[]>("/api/achievements").then((data) => {
      if (Array.isArray(data)) setAchs(data);
    });
  }, []);

  // Conquistas desbloqueadas dentro do período selecionado
  const period = achs.filter((a) => {
    if (!a.unlocked_at) return false;
    const d = getLocalDateFromISO(a.unlocked_at);
    return d >= from && d <= to;
  });

  if (period.length === 0) return null;

  return (
    <Section title={t("conquistas")}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {period.map((a) => {
          const meta = (a.metadata ?? {}) as { label?: string; icon?: string };
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "var(--surface)",
                border: "1px solid var(--surface-border)",
                borderRadius: 9999,
                padding: "7px 12px",
              }}
            >
              <span style={{ fontSize: 14 }}>{meta.icon ?? "🏅"}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: FOREGROUND }}>
                {meta.label ?? a.achievement_type}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
