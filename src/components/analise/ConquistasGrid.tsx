"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import type { UserAchievement } from "@/types";
import { Section, FOREGROUND } from "./Section";

export function ConquistasGrid() {
  const [achs, setAchs] = useState<UserAchievement[]>([]);

  useEffect(() => {
    safeCachedFetch<UserAchievement[]>("/api/achievements").then((data) => {
      if (Array.isArray(data)) setAchs(data);
    });
  }, []);

  if (achs.length === 0) return null;

  return (
    <Section title="Conquistas">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {achs.map((a) => {
          const meta = (a.metadata ?? {}) as { label?: string; icon?: string };
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "oklch(0.16 0.012 270)",
                border: "1px solid oklch(0.28 0.02 270 / 0.5)",
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
