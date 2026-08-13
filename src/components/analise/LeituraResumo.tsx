"use client";

import { useEffect, useState } from "react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { calculateStreak } from "@/lib/utils";
import { Section, CARD, Stat } from "./Section";

interface ReadingSession {
  date: string;
  minutes_read: number;
  pages_read: number;
}

interface ReadingBook {
  id: string;
}

export function LeituraResumo({ from, to }: { from: string; to: string }) {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [doneBooks, setDoneBooks] = useState<ReadingBook[]>([]);

  useEffect(() => {
    safeCachedFetch<ReadingSession[]>(`/api/leitura/sessions?from=${from}&to=${to}`).then((d) => {
      if (Array.isArray(d)) setSessions(d);
    });
    safeCachedFetch<ReadingBook[]>("/api/leitura/books?status=concluido").then((d) => {
      if (Array.isArray(d)) setDoneBooks(d);
    });
  }, [from, to]);

  if (sessions.length === 0 && doneBooks.length === 0) return null;

  const totalMin = sessions.reduce((s, x) => s + (x.minutes_read || 0), 0);
  const totalPages = sessions.reduce((s, x) => s + (x.pages_read || 0), 0);
  const streak = calculateStreak([...new Set(sessions.map((x) => x.date))]);

  const stats: { value: string | number; label: string }[] = [];
  if (sessions.length > 0) {
    stats.push({ value: Math.round(totalMin), label: "min" });
    stats.push({ value: totalPages, label: "páginas" });
    if (streak > 0) stats.push({ value: `${streak}d`, label: "sequência" });
  }
  if (doneBooks.length > 0) {
    stats.push({ value: doneBooks.length, label: "livros lidos" });
  }

  return (
    <Section title="Leitura">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", gap: 8 }}>
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </div>
    </Section>
  );
}
