"use client";

import type { CheckIn } from "@/types";
import { Section, CARD, MUTED, LILAC, Stat } from "./Section";

export function PausaResumo({ checkIns }: { checkIns: CheckIn[] }) {
  const days = checkIns.length;
  const medDays = checkIns.filter((c) => c.meditation === true).length;
  const prayDays = checkIns.filter((c) => c.prayer === true).length;
  const breatheDays = checkIns.filter((c) => c.breathing === true).length;
  const pauseDays = checkIns.filter(
    (c) => c.meditation === true || c.prayer === true || c.breathing === true,
  ).length;

  if (pauseDays === 0) return null;

  const breakdown = [
    { emoji: "🧘", label: "meditação", n: medDays },
    { emoji: "🙏", label: "oração", n: prayDays },
    { emoji: "🌬️", label: "respiração", n: breatheDays },
  ].filter((b) => b.n > 0);

  return (
    <Section title="Pausa">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Stat value={`${Math.round((pauseDays / days) * 100)}%`} label="dias de pausa" color={LILAC} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {breakdown.map((b) => (
            <span
              key={b.label}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: MUTED,
                background: "oklch(0.2 0.03 270)",
                borderRadius: 9999,
                padding: "4px 10px",
              }}
            >
              {b.emoji} {b.label} · {b.n} {b.n === 1 ? "dia" : "dias"}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
