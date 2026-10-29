"use client";

import { calculateStreak } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { ModuloPreviewCard } from "@/components/ModuloPreviewCard";

export interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
  avg_pace: number | null;
  start_time: string;
}
export interface ReadingBook { id: string; status: string }
export interface ReadingSession { date: string }
export interface ShoppingList { id: string }
export interface ShoppingItem { checked: boolean }

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

// ── Cards de espaços (dados vindos da página via props; null = carregando) ──

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

export function CorridaCard({ sessions }: { sessions: RunningSession[] | null }) {
  const { t } = useTranslation();
  const loading = sessions === null;
  const s = sessions && sessions.length > 0 ? sessions[0] : null;
  const preview = loading
    ? null
    : s
      ? `${(s.distance_meters / 1000).toFixed(2)} km`
      : t("or_comece_correr");
  const sub = loading ? "" : s ? `${formatDuration(s.duration_seconds)} · ${formatPace(s.avg_pace || 0)}` : t("or_rastreie_gps");

  return (
    <ModuloPreviewCard
      emoji="🏃"
      label={t("or_lbl_corrida")}
      preview={preview}
      sub={sub}
      href="/corrida"
      accent="#22D18B"
      loading={loading}
    />
  );
}

export function LeituraCard({ books, sessions }: { books: ReadingBook[] | null; sessions: ReadingSession[] | null }) {
  const { t } = useTranslation();
  const loading = books === null || sessions === null;
  const lendo = (books ?? []).filter((b) => b.status === "lendo").length;
  const dates = Array.from(new Set((sessions ?? []).map((s) => s.date)));
  const streak = calculateStreak(dates);

  let preview: string | null = null;
  let sub = "";
  if (!loading) {
    if (lendo > 0) {
      preview = lendo === 1 ? t("or_livro_em_leitura", { n: String(lendo) }) : t("or_livros_em_leitura", { n: String(lendo) });
      sub = streak > 0 ? (streak === 1 ? t("or_dia_seguido", { n: String(streak) }) : t("or_dias_seguidos", { n: String(streak) })) : t("or_comece_hoje");
    } else {
      preview = t("or_monte_estante");
      sub = t("or_adicione_livro");
    }
  }

  return (
    <ModuloPreviewCard
      emoji="📚"
      label={t("or_lbl_leitura")}
      preview={preview}
      sub={sub}
      href="/leitura"
      accent="#A78BFA"
      loading={loading}
    />
  );
}

export function PorquesCard({ count }: { count: number | null }) {
  const { t } = useTranslation();
  const loading = count === null;
  const n = count ?? 0;
  const preview = loading
    ? null
    : n > 0
      ? (n === 1 ? t("or_porque_escrito", { n: String(n) }) : t("or_porques_escritos", { n: String(n) }))
      : t("or_descubra_porques");
  const sub = loading ? "" : t("or_o_que_move");

  return (
    <ModuloPreviewCard
      emoji="💗"
      label={t("or_lbl_porques")}
      preview={preview}
      sub={sub}
      href="/porques"
      accent="#f472b6"
      loading={loading}
    />
  );
}

export function HistoricoCard({ count }: { count: number | null }) {
  const { t } = useTranslation();
  const loading = count === null;
  const n = count ?? 0;
  const preview = loading
    ? null
    : n > 0
      ? t("or_checkins", { n: String(n) })
      : t("or_revise_jornada");
  const sub = loading ? "" : n > 0 ? t("or_historico_completo") : t("or_comece_hoje");

  return (
    <ModuloPreviewCard
      emoji="📊"
      label={t("or_lbl_historico")}
      preview={preview}
      sub={sub}
      href="/historico"
      accent="#38bdf8"
      loading={loading}
    />
  );
}

export function ComprasCard({ lists, items }: { lists: ShoppingList[] | null; items: ShoppingItem[] | null }) {
  const { t } = useTranslation();
  const loading = lists === null || items === null;
  const listCount = (lists ?? []).length;
  const pending = (items ?? []).filter((i) => !i.checked).length;

  let preview: string | null = null;
  let sub = "";
  if (!loading) {
    if (listCount > 0) {
      preview = listCount === 1 ? t("or_lista", { n: String(listCount) }) : t("or_listas", { n: String(listCount) });
      sub = pending > 0 ? (pending === 1 ? t("or_pendente", { n: String(pending) }) : t("or_pendentes", { n: String(pending) })) : t("or_tudo_em_dia");
    } else {
      preview = t("or_crie_listas");
      sub = t("or_mercado_casa");
    }
  }

  return (
    <ModuloPreviewCard
      emoji="🛒"
      label={t("or_lbl_compras")}
      preview={preview}
      sub={sub}
      href="/compras"
      accent="#fbbf24"
      loading={loading}
    />
  );
}
