"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ReadingBook, ReadingStatus } from "@/types";
import { useTranslation } from "@/lib/useTranslation";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";
const CARD_BG = "oklch(.17 .015 270 / .6)";

const EMOJIS = ["📖", "📚", "💡", "🧠", "🌱", "💪", "❤️", "✨", "🌙", "⚡", "🎯", "🕊️", "💰", "🧘"];

export const GENRES: { value: string; key: string }[] = [
  { value: "Desenvolvimento pessoal", key: "leitura_genre_desenvolvimento" },
  { value: "Filosofia", key: "leitura_genre_filosofia" },
  { value: "Espiritualidade", key: "leitura_genre_espiritualidade" },
  { value: "Finanças", key: "leitura_genre_financas" },
  { value: "Negócios", key: "leitura_genre_negocios" },
  { value: "Biografia", key: "leitura_genre_biografia" },
  { value: "Ficção", key: "leitura_genre_ficcao" },
  { value: "Saúde", key: "leitura_genre_saude" },
  { value: "Outro", key: "leitura_genre_outro" },
];

const STATUS_OPTIONS: { value: ReadingStatus; key: string }[] = [
  { value: "quero_ler", key: "leitura_quero_ler" },
  { value: "lendo", key: "leitura_lendo" },
  { value: "concluido", key: "leitura_concluido" },
  { value: "abandonado", key: "leitura_abandonado" },
];

export interface BookFormValues {
  title: string;
  author: string;
  emoji: string;
  genre: string;
  total_pages: string;
  current_page: string;
  status: ReadingStatus;
}

interface Props {
  initial: ReadingBook | null;
  onClose: () => void;
  onSave: (values: BookFormValues) => void;
}

export function ReadingAddBookModal({ initial, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [emoji, setEmoji] = useState("📖");
  const [genre, setGenre] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [currentPage, setCurrentPage] = useState("");
  const [status, setStatus] = useState<ReadingStatus>("quero_ler");

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setAuthor(initial.author || "");
      setEmoji(initial.emoji || "📖");
      setGenre(initial.genre || "");
      setTotalPages(initial.total_pages ? String(initial.total_pages) : "");
      setCurrentPage(initial.current_page ? String(initial.current_page) : "");
      setStatus(initial.status);
    } else {
      setTitle("");
      setAuthor("");
      setEmoji("📖");
      setGenre("");
      setTotalPages("");
      setCurrentPage("");
      setStatus("quero_ler");
    }
  }, [initial]);

  const submit = () => {
    if (!title.trim()) return;
    onSave({ title, author, emoji, genre, total_pages: totalPages, current_page: currentPage, status });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(8,8,14,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto",
        background: "oklch(.15 .015 270 / .98)", borderRadius: "20px 20px 0 0",
        border: `1px solid ${BORDER}`, padding: "20px 20px 28px",
        color: FOREGROUND,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {initial ? t("leitura_editar_livro") : t("leitura_adicionar_livro")}
          </h3>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: 0, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Emoji */}
        <p style={{ margin: "0 0 6px", fontSize: 12, color: MUTED, fontWeight: 600 }}>{t("leitura_capa_emoji")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)}
              style={{
                width: 38, height: 38, borderRadius: 10, fontSize: 20, cursor: "pointer",
                background: emoji === e ? `${PURPLE_HEX}30` : "oklch(.20 .015 270 / .4)",
                border: emoji === e ? `1px solid ${PURPLE_HEX}60` : "1px solid transparent",
              }}>
              {e}
            </button>
          ))}
        </div>

        <Field label={`${t("titulo")} *`}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("leitura_nome_livro_ph")}
            style={inputStyle} />
        </Field>

        <Field label={t("leitura_autor")}>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t("leitura_autor_ph")}
            style={inputStyle} />
        </Field>

        <Field label={t("leitura_categoria")}>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {GENRES.map((g) => (
              <option key={g.value} value={g.value} style={{ background: "#1a1a28" }}>{t(g.key)}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label={t("leitura_total_paginas")}>
            <input value={totalPages} onChange={(e) => setTotalPages(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder={t("leitura_ex_240")} style={inputStyle} />
          </Field>
          <Field label={t("leitura_pagina_atual")}>
            <input value={currentPage} onChange={(e) => setCurrentPage(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder="0" style={inputStyle} />
          </Field>
        </div>

        <Field label={t("leitura_status")}>
          <select value={status} onChange={(e) => setStatus(e.target.value as ReadingStatus)} style={inputStyle}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value} style={{ background: "#1a1a28" }}>{t(s.key)}</option>
            ))}
          </select>
        </Field>

        <button type="button" onClick={submit} disabled={!title.trim()}
          style={{
            width: "100%", marginTop: 18, padding: "13px", borderRadius: 12,
            background: PURPLE_HEX, color: "#fff", border: 0, cursor: "pointer",
            fontSize: 14, fontWeight: 700, fontFamily: "inherit",
            opacity: title.trim() ? 1 : 0.5,
          }}>
          {initial ? t("leitura_salvar_alteracoes") : t("leitura_adicionar_estante")}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  background: "oklch(.20 .015 270 / .5)", border: `1px solid ${BORDER}`,
  color: "#e0d6ff", fontSize: 14, fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, flex: 1, minWidth: 0 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: MUTED, fontWeight: 600 }}>{label}</p>
      {children}
    </div>
  );
}
