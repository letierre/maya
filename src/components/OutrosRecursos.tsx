"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { calculateStreak } from "@/lib/utils";

interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
  avg_pace: number | null;
  start_time: string;
}

interface ReadingBook { status: string }
interface ReadingSession { date: string }

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}min`;
  return `${m}min ${s}s`;
}

// ── Card compacto (strip horizontal) ───────────────────────────

function ResourceCard({
  emoji,
  label,
  preview,
  sub,
  href,
  accent,
  ready,
}: {
  emoji: string;
  label: string;
  preview: string | null;
  sub: string;
  href: string;
  accent: string;
  ready: boolean;
}) {
  if (!ready) {
    return (
      <div
        className="rounded-2xl animate-pulse flex flex-col gap-2 p-4 min-w-[148px]"
        style={{
          background: "oklch(0.16 0.012 270)",
          border: "1px solid oklch(0.28 0.02 270 / 0.5)",
        }}
      >
        <div className="w-8 h-8 rounded-full" style={{ background: "oklch(0.22 0.02 270)" }} />
        <div className="h-3 rounded-full w-16" style={{ background: "oklch(0.22 0.02 270)" }} />
        <div className="h-3 rounded-full w-24" style={{ background: "oklch(0.22 0.02 270)" }} />
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-2xl p-4 text-left cursor-pointer transition-all active:scale-[0.98] flex flex-col gap-2 min-w-[148px] shrink-0 group relative overflow-hidden"
      style={{
        background: "oklch(0.16 0.012 270)",
        border: "1px solid oklch(0.28 0.02 270 / 0.5)",
        textDecoration: "none",
      }}
    >
      {/* Accent glow */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />

      <span className="text-2xl leading-none relative">{emoji}</span>

      <p
        className="m-0 text-[10px] font-bold tracking-[.1em] uppercase"
        style={{ color: accent }}
      >
        {label}
      </p>

      <p className="m-0 text-[12px] font-medium leading-snug" style={{ color: "#e0d6ff" }}>
        {preview || sub || "—"}
      </p>

      {sub && (
        <p className="m-0 text-[10px]" style={{ color: "oklch(0.55 0.03 270)" }}>
          {sub}
        </p>
      )}

      <ArrowRight
        className="w-3 h-3 absolute bottom-3 right-3 opacity-30 group-hover:opacity-70 transition-opacity"
        style={{ color: accent }}
      />
    </Link>
  );
}

// ── Seção ──────────────────────────────────────────────────────

export function OutrosRecursos() {
  const [runPreview, setRunPreview] = useState<string | null>(null);
  const [runSub, setRunSub] = useState("");
  const [runReady, setRunReady] = useState(false);

  const [readPreview, setReadPreview] = useState<string | null>(null);
  const [readSub, setReadSub] = useState("");
  const [readReady, setReadReady] = useState(false);

  const [porquePreview, setPorquePreview] = useState<string | null>(null);
  const [porqueSub, setPorqueSub] = useState("");
  const [porqueReady, setPorqueReady] = useState(false);

  const [histPreview, setHistPreview] = useState<string | null>(null);
  const [histSub, setHistSub] = useState("");
  const [histReady, setHistReady] = useState(false);

  useEffect(() => {
    // Corrida — última sessão
    safeCachedFetch<RunningSession[]>("/api/running?limit=1")
      .then((sessions) => {
        if (sessions && sessions.length > 0) {
          const s = sessions[0];
          setRunPreview(`${(s.distance_meters / 1000).toFixed(2)} km`);
          setRunSub(`${formatDuration(s.duration_seconds)} · ${formatPace(s.avg_pace || 0)}`);
        } else {
          setRunPreview("Comece a correr");
          setRunSub("Rastreie com GPS");
        }
      })
      .catch(() => {})
      .finally(() => setRunReady(true));

    // Leitura — livros em leitura + sequência de dias
    Promise.all([
      safeCachedFetch<ReadingBook[]>("/api/leitura/books"),
      safeCachedFetch<ReadingSession[]>("/api/leitura/sessions"),
    ])
      .then(([books, sessions]) => {
        const lendo = (books ?? []).filter((b) => b.status === "lendo").length;
        const dates = Array.from(new Set((sessions ?? []).map((s) => s.date)));
        const streak = calculateStreak(dates);

        if (lendo > 0) {
          setReadPreview(`${lendo} livro${lendo !== 1 ? "s" : ""} em leitura`);
          setReadSub(streak > 0 ? `🔥 ${streak} dia${streak !== 1 ? "s" : ""} seguidos` : "Comece hoje");
        } else {
          setReadPreview("Monte sua estante");
          setReadSub("Adicione um livro");
        }
      })
      .catch(() => {})
      .finally(() => setReadReady(true));

    // Porquês — contagem de "porquês" escritos
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const count = (data.porques ?? []).length;
        if (count > 0) {
          setPorquePreview(`${count} porquê${count !== 1 ? "s" : ""} escritos`);
          setPorqueSub("O que te move");
        } else {
          setPorquePreview("Descubra seus porquês");
          setPorqueSub("O que te move");
        }
      })
      .catch(() => {})
      .finally(() => setPorqueReady(true));

    // Histórico — total de check-ins registrados
    safeCachedFetch<{ date: string }[]>("/api/check-ins")
      .then((list) => {
        const count = (list ?? []).length;
        setHistPreview(count > 0 ? `${count} check-in${count !== 1 ? "s" : ""}` : "Revise sua jornada");
        setHistSub(count > 0 ? "Seu histórico completo" : "Comece hoje");
      })
      .catch(() => {})
      .finally(() => setHistReady(true));
  }, []);

  return (
    <div className="px-3.5 pt-4">
      <p
        className="m-0 mb-2.5 text-[10px] font-bold tracking-[.12em] uppercase"
        style={{ color: "oklch(0.65 0.12 270)", paddingLeft: 4 }}
      >
        Outros recursos
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <ResourceCard
          emoji="🏃"
          label="Corrida"
          preview={runPreview}
          sub={runSub}
          href="/corrida"
          accent="#22D18B"
          ready={runReady}
        />
        <ResourceCard
          emoji="📚"
          label="Leitura"
          preview={readPreview}
          sub={readSub}
          href="/leitura"
          accent="#A78BFA"
          ready={readReady}
        />
        <ResourceCard
          emoji="💗"
          label="Porquês"
          preview={porquePreview}
          sub={porqueSub}
          href="/porques"
          accent="#f472b6"
          ready={porqueReady}
        />
        <ResourceCard
          emoji="📊"
          label="Histórico"
          preview={histPreview}
          sub={histSub}
          href="/historico"
          accent="#38bdf8"
          ready={histReady}
        />
      </div>
    </div>
  );
}
