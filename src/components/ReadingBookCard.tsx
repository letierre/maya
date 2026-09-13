"use client";

import { BookOpen, Check, Edit3, Trash2, RotateCcw } from "lucide-react";
import type { ReadingBook } from "@/types";
import { useTranslation } from "@/lib/useTranslation";
import { GENRES } from "@/components/ReadingAddBookModal";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const CARD_BG = "oklch(.17 .015 270 / .6)";

const STATUS_KEY: Record<ReadingBook["status"], string> = {
  lendo: "leitura_lendo",
  quero_ler: "leitura_quero_ler",
  concluido: "leitura_concluido",
  abandonado: "leitura_abandonado",
};
const STATUS_COLOR: Record<ReadingBook["status"], string> = {
  lendo: "#A78BFA",
  quero_ler: MUTED,
  concluido: "oklch(0.55 0.15 160)",
  abandonado: "oklch(0.6 0.12 20)",
};

function genreLabel(t: (key: string) => string, genre?: string | null): string | null {
  if (!genre) return null;
  const opt = GENRES.find((g) => g.value === genre);
  return opt ? t(opt.key) : genre;
}

interface Props {
  book: ReadingBook;
  onLogSession: (book: ReadingBook) => void;
  onComplete: (book: ReadingBook) => void;
  onReopen: (book: ReadingBook) => void;
  onEdit: (book: ReadingBook) => void;
  onDelete: (book: ReadingBook) => void;
}

export function ReadingBookCard({ book, onLogSession, onComplete, onReopen, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLOR[book.status];
  const hasTotal = book.total_pages && book.total_pages > 0;
  const pct = hasTotal
    ? Math.min(100, Math.round((book.current_page / (book.total_pages as number)) * 100))
    : 0;

  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: CARD_BG, border: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 12 }}>
        {/* Emoji cover */}
        <div style={{
          width: 46, height: 60, borderRadius: 8, flexShrink: 0,
          background: "oklch(.22 .015 270 / .5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
        }}>
          {book.emoji || "📖"}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <h4 style={{
              margin: 0, fontSize: 14, fontWeight: 600, color: FOREGROUND,
              lineHeight: 1.3, flex: 1, minWidth: 0,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {book.title}
            </h4>
            <span style={{
              fontSize: 10, fontWeight: 700, color: statusColor,
              background: "oklch(.22 .015 270 / .6)", borderRadius: 9999,
              padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {t(STATUS_KEY[book.status])}
            </span>
          </div>

          {(book.author || book.genre) && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>
              {[book.author, genreLabel(t, book.genre)].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Progresso */}
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                flex: 1, height: 4, borderRadius: 9999,
                background: "oklch(.22 .015 270 / .5)", overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 9999, background: PURPLE_HEX,
                  width: `${pct}%`, transition: "width 0.4s ease",
                }} />
              </div>
              <span style={{ fontSize: 10, color: PURPLE_HEX, fontWeight: 700, whiteSpace: "nowrap" }}>
                {hasTotal
                  ? `${book.current_page}/${book.total_pages} ${t("leitura_pag")}`
                  : book.current_page > 0
                    ? `${book.current_page} ${t("leitura_pag")}`
                    : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      {book.notes && (
        <p style={{
          margin: 0, fontSize: 11, color: MUTED, lineHeight: 1.4, opacity: 0.85,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        } as React.CSSProperties}>
          💭 {book.notes}
        </p>
      )}

      {/* Ações */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {book.status !== "concluido" ? (
          <button type="button" onClick={() => onLogSession(book)}
            style={{
              fontSize: 11, fontWeight: 600, color: "#fff", background: PURPLE_HEX,
              border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
            <BookOpen style={{ width: 12, height: 12 }} />
            {book.status === "lendo" ? t("leitura_registrar_leitura") : t("leitura_comecar")}
          </button>
        ) : (
          <button type="button" onClick={() => onReopen(book)}
            style={{
              fontSize: 11, fontWeight: 600, color: "#A78BFA", background: `${PURPLE_HEX}15`,
              border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
            <RotateCcw style={{ width: 12, height: 12 }} /> {t("leitura_reabrir")}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {book.status !== "concluido" && (
          <IconBtn title={t("leitura_concluir")} onClick={() => onComplete(book)} color="oklch(0.55 0.15 160)">
            <Check style={{ width: 14, height: 14 }} />
          </IconBtn>
        )}
        <IconBtn title={t("editar")} onClick={() => onEdit(book)} color={MUTED}>
          <Edit3 style={{ width: 14, height: 14 }} />
        </IconBtn>
        <IconBtn title={t("leitura_remover")} onClick={() => onDelete(book)} color={MUTED}>
          <Trash2 style={{ width: 14, height: 14 }} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, color, children }: {
  title: string;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 8, cursor: "pointer",
        background: "transparent", border: 0, color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
      {children}
    </button>
  );
}
