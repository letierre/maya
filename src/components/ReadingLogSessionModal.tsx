"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ReadingBook } from "@/types";
import { getLocalDate } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const FOREGROUND = "#e0d6ff";

export interface SessionFormValues {
  book_id: string;
  book_title: string;
  date: string;
  pages_read: string;
  minutes_read: string;
}

interface Props {
  books: ReadingBook[];
  initialBookId: string | null;
  onClose: () => void;
  onSave: (values: SessionFormValues) => void;
}

export function ReadingLogSessionModal({ books, initialBookId, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [bookId, setBookId] = useState("");
  const [pages, setPages] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(getLocalDate());

  useEffect(() => {
    if (books.length > 0) {
      const target = initialBookId && books.some((b) => b.id === initialBookId)
        ? initialBookId
        : books[0].id;
      setBookId(target);
    }
    setDate(getLocalDate());
  }, [books, initialBookId]);

  const submit = () => {
    const p = Number(pages) || 0;
    const m = Number(minutes) || 0;
    if (p === 0 && m === 0) return;
    const book = books.find((b) => b.id === bookId);
    onSave({
      book_id: bookId || "",
      book_title: book?.title || t("leitura"),
      date,
      pages_read: pages,
      minutes_read: minutes,
    });
  };

  const valid = (Number(pages) || 0) > 0 || (Number(minutes) || 0) > 0;

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
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t("leitura_registrar_leitura")}</h3>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "none", border: 0, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <Field label={t("leitura_livro")}>
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} style={inputStyle}>
            {books.length === 0 && <option value="">{t("leitura_nenhum_livro")}</option>}
            {books.map((b) => (
              <option key={b.id} value={b.id} style={{ background: "#1a1a28" }}>
                {b.emoji || "📖"} {b.title}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label={t("leitura_paginas_lidas")}>
            <input value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder="0" style={inputStyle} />
          </Field>
          <Field label={t("leitura_minutos_lidos")}>
            <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric" placeholder="0" style={inputStyle} />
          </Field>
        </div>

        <Field label={t("leitura_data")}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </Field>

        <button type="button" onClick={submit} disabled={!valid}
          style={{
            width: "100%", marginTop: 18, padding: "13px", borderRadius: 12,
            background: PURPLE_HEX, color: "#fff", border: 0, cursor: "pointer",
            fontSize: 14, fontWeight: 700, fontFamily: "inherit",
            opacity: valid ? 1 : 0.5,
          }}>
          {t("leitura_salvar_registro")}
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
