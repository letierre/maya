"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { ArrowLeft, Plus, X, Camera } from "lucide-react";
import type { DiaryEntry } from "@/types";
import { photoUrl, compressImage, uploadToCloud } from "@/lib/photo-storage";

const MOODS = [
  { value: 1, emoji: "😔", key: "muito_mal" },
  { value: 2, emoji: "😕", key: "mal" },
  { value: 3, emoji: "😐", key: "normal" },
  { value: 4, emoji: "🙂", key: "bem" },
  { value: 5, emoji: "😊", key: "muito_bem" },
];

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export default function DiarioEntryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { t } = useTranslation();

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [entryDate, setEntryDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/diary?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setEntry(data);
          setEntryDate(data.date || "");
          setTitle(data.title || "");
          setContent(data.content || "");
          setMood(data.mood ?? null);
          setPhotos(data.photos || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!content.trim()) { toast.error(t("escreva_algo")); return; }
    setSaving(true);
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, date: entryDate, title: title.trim(), content: content.trim(), mood, photos }),
    });
    if (!res.ok) { toast.error(t("erro_salvar_entrada")); setSaving(false); return; }
    toast.success(t("entrada_atualizada"));
    setEditing(false); setSaving(false);
    setEntry((prev) => prev ? { ...prev, date: entryDate, title: title.trim(), content: content.trim(), mood } : prev);
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmar_deletar"))) return;
    const res = await fetch(`/api/diary/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error(t("erro_deletar")); return; }
    toast.success(t("entrada_deletada"));
    router.push("/diario"); router.refresh();
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if ("showPicker" in el && typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  };

  const handlePhotoAdd = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setPhotos((prev) => [...prev, path]);
    } catch { toast.error("Erro ao processar imagem"); }
    setUploading(false);
  }, []);

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "#0F0F14" }}>
        <p style={{ color: "#9e96b5" }}>{t("carregando")}</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0F0F14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
        <div style={{ fontSize: 40 }}>📔</div>
        <p style={{ color: "#9e96b5" }}>{t("entrada_nao_encontrada")}</p>
        <Button onClick={() => router.push("/diario")} style={{ borderRadius: 12, background: "#7C5CFF" }}>{t("voltar_diario")}</Button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0F0F14", paddingBottom: 100 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => router.push("/diario")}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#A78BFA",
              }}>
              <ArrowLeft size={18} />
            </button>
            {editing ? (
              <button type="button" onClick={openDatePicker}
                style={{ background: "none", border: 0, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>{formatDisplayDate(entryDate)}</h1>
              </button>
            ) : (
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>
                  {entry.title || t("diario_title")}
                </h1>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9e96b5" }}>{formatDisplayDate(entry.date)}</p>
              </div>
            )}
          </div>
          <input type="date" ref={dateInputRef} value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            style={{ position: "absolute", top: 0, left: 0, opacity: 0, width: 180, height: 28, cursor: "pointer" }} />

          {editing ? (
            <Button onClick={handleSave} disabled={saving}
              style={{ height: 38, paddingInline: 18, borderRadius: 12, background: "#7C5CFF", border: 0, color: "#fff", fontSize: 13, fontWeight: 600 }}>
              {saving ? t("salvando") : t("salvar")}
            </Button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => setEditing(true)}
                style={{ height: 34, paddingInline: 14, borderRadius: 10, background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", color: "#e0d6ff", fontSize: 12, fontWeight: 600 }}>
                {t("editar")}
              </Button>
              <Button onClick={handleDelete}
                style={{ height: 34, paddingInline: 14, borderRadius: 10, background: "rgba(255,92,92,0.15)", border: 0, color: "#FF5C5C", fontSize: 12, fontWeight: 600 }}>
                {t("deletar")}
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <>
            {/* Mood selector */}
            <div style={{
              background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
              borderRadius: 16, padding: 14, marginBottom: 16,
            }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>{t("humor_dia")}</p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                {MOODS.map((m) => (
                  <button key={m.value} type="button" onClick={() => setMood(m.value)}
                    style={{
                      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      padding: "8px 4px", borderRadius: 12, border: 0, cursor: "pointer",
                      background: mood === m.value ? "rgba(124,92,255,0.25)" : "transparent",
                      transition: "all .15s",
                    }}>
                    <span style={{ fontSize: 24 }}>{m.emoji}</span>
                    <span style={{ fontSize: 9, color: mood === m.value ? "#A78BFA" : "#9e96b5", fontWeight: 600 }}>
                      {t(m.key)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <input
              placeholder={t("titulo_placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", padding: "12px 14px",
                borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)",
                background: "#1a1530", color: "#e0d6ff", fontSize: 14, fontFamily: "inherit",
                marginBottom: 12, outline: "none",
              }}
            />

            {/* Content */}
            <textarea
              placeholder={t("escrever_placeholder")}
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", padding: "14px",
                borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)",
                background: "#1a1530", color: "#e0d6ff", fontSize: 14,
                fontFamily: "inherit", lineHeight: 1.7, resize: "vertical",
                marginBottom: 12, outline: "none",
              }}
            />

            {/* Photo strip in edit mode */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {photos.map((p, i) => (
                <div key={p} style={{
                  width: 72, height: 72, borderRadius: 14, overflow: "hidden",
                  border: "2px solid rgba(167,139,250,0.3)", position: "relative", flexShrink: 0,
                }}>
                  <img src={photoUrl(p)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => removePhoto(i)}
                    style={{
                      position: "absolute", top: 4, right: 4, width: 22, height: 22,
                      borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: 0,
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading}
                style={{
                  width: 72, height: 72, borderRadius: 14,
                  border: "1.5px dashed rgba(167,139,250,0.3)",
                  background: "rgba(124,92,255,0.06)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#A78BFA",
                }}>
                {uploading ? <span style={{ fontSize: 11, color: "#9e96b5" }}>...</span> : <Plus size={22} />}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]); e.target.value = ""; }} />
            </div>

            {/* Cancel */}
            <button type="button" onClick={() => {
              setEditing(false);
              setTitle(entry.title || "");
              setContent(entry.content || "");
              setMood(entry.mood ?? null);
              setEntryDate(entry.date || "");
              setPhotos(entry.photos || []);
            }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 14,
                border: "1px solid rgba(167,139,250,0.2)", background: "transparent",
                cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                color: "#9e96b5",
              }}>
              {t("cancelar")}
            </button>
          </>
        ) : (
          <>
            {/* Mood display */}
            {entry.mood && (
              <div style={{
                background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 16, padding: 16, textAlign: "center", marginBottom: 16,
              }}>
                <span style={{ fontSize: 40 }}>
                  {MOODS.find((m) => m.value === entry.mood)?.emoji}
                </span>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9e96b5" }}>
                  {t(MOODS.find((m) => m.value === entry.mood)?.key || "")}
                </p>
              </div>
            )}

            {entry.title && (
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e0d6ff", margin: "0 0 12px" }}>{entry.title}</h2>
            )}

            {entry.content ? (
              <div style={{ marginBottom: 16 }}>
                {entry.content.split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "0 0 8px", fontSize: 14, color: "#e0d6ff", lineHeight: 1.7 }}>
                    {line || " "}
                  </p>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9e96b5", fontStyle: "italic", textAlign: "center", padding: 32 }}>
                {t("sem_conteudo")}
              </p>
            )}

            {/* Photos display */}
            {entry.photos && entry.photos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {entry.photos.map((p) => {
                  const src = photoUrl(p);
                  return src ? (
                    <img key={p} src={src} alt="" style={{
                      width: "100%", aspectRatio: "1", objectFit: "cover",
                      borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)",
                    }} />
                  ) : null;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
