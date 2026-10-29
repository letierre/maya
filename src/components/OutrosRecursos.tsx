"use client";

import { useEffect, useState } from "react";
import { cachedFetch, safeCachedFetch } from "@/lib/fetch-cache";
import { calculateStreak } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { ModuloPreviewCard } from "@/components/ModuloPreviewCard";

interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
  avg_pace: number | null;
  start_time: string;
}

interface ReadingBook { id: string; status: string }
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

// ── Cards auto-contidos (cada um busca o próprio preview) ──────

export function MeditacaoCard() {
  const { t } = useTranslation();
  return (
    <ModuloPreviewCard
      emoji="🧘"
      label={t("md_titulo")}
      preview="3 · 5 · 10 min"
      sub={t("md_subtitulo")}
      href="/meditacao"
      accent="#A78BFA"
    />
  );
}

export function RespiracaoCard() {
  const { t } = useTranslation();
  return (
    <ModuloPreviewCard
      emoji="🌬️"
      label={t("rb_titulo")}
      preview="1 · 2 · 3 min"
      sub={t("rb_subtitulo")}
      href="/respiracao"
      accent="#5EEAD4"
    />
  );
}

export function CorridaCard() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    safeCachedFetch<RunningSession[]>("/api/running?limit=1")
      .then((sessions) => {
        if (sessions && sessions.length > 0) {
          const s = sessions[0];
          setPreview(`${(s.distance_meters / 1000).toFixed(2)} km`);
          setSub(`${formatDuration(s.duration_seconds)} · ${formatPace(s.avg_pace || 0)}`);
        } else {
          setPreview(t("or_comece_correr"));
          setSub(t("or_rastreie_gps"));
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [t]);

  return (
    <ModuloPreviewCard
      emoji="🏃"
      label={t("or_lbl_corrida")}
      preview={preview}
      sub={sub}
      href="/corrida"
      accent="#22D18B"
      loading={!ready}
    />
  );
}

export function LeituraCard() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      safeCachedFetch<ReadingBook[]>("/api/leitura/books"),
      safeCachedFetch<ReadingSession[]>("/api/leitura/sessions"),
    ])
      .then(([books, sessions]) => {
        const lendo = (books ?? []).filter((b) => b.status === "lendo").length;
        const dates = Array.from(new Set((sessions ?? []).map((s) => s.date)));
        const streak = calculateStreak(dates);
        if (lendo > 0) {
          setPreview(lendo === 1 ? t("or_livro_em_leitura", { n: String(lendo) }) : t("or_livros_em_leitura", { n: String(lendo) }));
          setSub(streak > 0 ? (streak === 1 ? t("or_dia_seguido", { n: String(streak) }) : t("or_dias_seguidos", { n: String(streak) })) : t("or_comece_hoje"));
        } else {
          setPreview(t("or_monte_estante"));
          setSub(t("or_adicione_livro"));
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [t]);

  return (
    <ModuloPreviewCard
      emoji="📚"
      label={t("or_lbl_leitura")}
      preview={preview}
      sub={sub}
      href="/leitura"
      accent="#A78BFA"
      loading={!ready}
    />
  );
}

export function PorquesCard() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    cachedFetch<{ porques?: unknown[] }>("/api/profile")
      .then((data) => {
        const count = (data.porques ?? []).length;
        if (count > 0) {
          setPreview(count === 1 ? t("or_porque_escrito", { n: String(count) }) : t("or_porques_escritos", { n: String(count) }));
          setSub(t("or_o_que_move"));
        } else {
          setPreview(t("or_descubra_porques"));
          setSub(t("or_o_que_move"));
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [t]);

  return (
    <ModuloPreviewCard
      emoji="💗"
      label={t("or_lbl_porques")}
      preview={preview}
      sub={sub}
      href="/porques"
      accent="#f472b6"
      loading={!ready}
    />
  );
}

export function HistoricoCard() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    safeCachedFetch<{ date: string }[]>("/api/check-ins")
      .then((list) => {
        const count = (list ?? []).length;
        setPreview(count > 0 ? t("or_checkins", { n: String(count) }) : t("or_revise_jornada"));
        setSub(count > 0 ? t("or_historico_completo") : t("or_comece_hoje"));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [t]);

  return (
    <ModuloPreviewCard
      emoji="📊"
      label={t("or_lbl_historico")}
      preview={preview}
      sub={sub}
      href="/historico"
      accent="#38bdf8"
      loading={!ready}
    />
  );
}

export function ComprasCard() {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [sub, setSub] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      safeCachedFetch<{ id: string }[]>("/api/shopping-lists"),
      safeCachedFetch<{ checked: boolean }[]>("/api/shopping-list"),
    ])
      .then(([lists, items]) => {
        const listCount = (lists ?? []).length;
        const pending = (items ?? []).filter((i) => !i.checked).length;
        if (listCount > 0) {
          setPreview(listCount === 1 ? t("or_lista", { n: String(listCount) }) : t("or_listas", { n: String(listCount) }));
          setSub(pending > 0 ? (pending === 1 ? t("or_pendente", { n: String(pending) }) : t("or_pendentes", { n: String(pending) })) : t("or_tudo_em_dia"));
        } else {
          setPreview(t("or_crie_listas"));
          setSub(t("or_mercado_casa"));
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [t]);

  return (
    <ModuloPreviewCard
      emoji="🛒"
      label={t("or_lbl_compras")}
      preview={preview}
      sub={sub}
      href="/compras"
      accent="#fbbf24"
      loading={!ready}
    />
  );
}
