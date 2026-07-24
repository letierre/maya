"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { ChevronLeft, ChevronDown, Plus, X, ArrowRight, Camera } from "lucide-react";

const MOODS = [1, 2, 3, 4, 5] as const;
const MOOD_EMOJI: Record<number, string> = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😊" };

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const wk = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("pt-BR", { month: "long" });
  return `${wk.charAt(0).toUpperCase() + wk.slice(1)}, ${day} de ${month}`;
}

export default function NovoDiarioPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [entryDate, setEntryDate] = useState(() => getLocalDate());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selectedMoodEmoji = mood ? MOOD_EMOJI[mood] : "😶";

  const wordCount = useMemo(() => {
    const text = content.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if ("showPicker" in el && typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  };

  const handleSave = async () => {
    if (!content.trim()) { toast.error(t("escreva_algo")); return; }
    setSaving(true);
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entryDate, title: title.trim(), content: content.trim(), mood, photos }),
    });
    if (!res.ok) { toast.error(t("erro_salvar_entrada")); setSaving(false); return; }
    toast.success(t("entrada_salva"));
    router.push("/diario");
    router.refresh();
  };

  const handlePhotoAdd = useCallback(async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setPhotos((prev) => [...prev, path]);
    } catch { toast.error("Erro ao processar imagem"); }
  }, []);

  const removePhoto = useCallback((path: string) => {
    setPhotos((prev) => prev.filter((p) => p !== path));
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0F0F14", paddingBottom: 100 }}>
      {/* Floating back */}
      <button type="button" onClick={() => router.back()}
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: "50%",
          background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#A78BFA", backdropFilter: "blur(8px)",
        }}>
        <ChevronLeft size={18} />
      </button>

      {/* Floating mood picker */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <button type="button" onClick={() => setMoodOpen(!moodOpen)}
          style={{
            height: 36, paddingInline: 14, borderRadius: 9999,
            background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            color: "#e0d6ff", backdropFilter: "blur(8px)",
          }}>
          <span style={{ fontSize: 18 }}>{selectedMoodEmoji}</span>
          <ChevronDown size={12} style={{ color: "#9e96b5", transform: moodOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
        {moodOpen && (
          <div style={{
            position: "absolute", top: 44, right: 0, borderRadius: 16, padding: "6px 4px",
            display: "flex", gap: 2, background: "#1a1530",
            border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {MOODS.map((m) => (
              <button key={m} type="button" onClick={() => { setMood(m); setMoodOpen(false); }}
                style={{
                  width: 40, height: 40, borderRadius: "50%", border: 0, cursor: "pointer",
                  fontSize: 20, background: mood === m ? "rgba(124,92,255,0.2)" : "transparent",
                }}>
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date header */}
      <div style={{ padding: "72px 24px 8px", position: "relative" }}>
        <button type="button" onClick={openDatePicker}
          style={{
            background: "none", border: 0, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", padding: 0,
          }}>
          <span style={{
            fontSize: 11, fontFamily: "monospace", color: "#9e96b5",
            letterSpacing: ".06em", textTransform: "uppercase",
          }}>
            {formatLongDate(entryDate)}
          </span>
          <ChevronDown size={12} style={{ color: "#9e96b5" }} />
        </button>
        <input type="date" ref={dateInputRef} value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          style={{
            position: "absolute", top: 72, left: 24, opacity: 0,
            width: 180, height: 24, cursor: "pointer",
          }} />
      </div>

      {/* Title */}
      <div style={{ padding: "0 24px 12px" }}>
        <div
          contentEditable suppressContentEditableWarning role="textbox" aria-label="Título"
          data-placeholder="Título (opcional)"
          onInput={(e) => setTitle((e.target as HTMLElement).innerText)}
          onPaste={handlePaste}
          style={{
            outline: "none", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em",
            lineHeight: 1.15, minHeight: "1.15em", color: "#e0d6ff",
          }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: "0 24px" }}>
        <div
          contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
          aria-label="Conteúdo do diário" data-placeholder="Escreva o que estiver passando..."
          onInput={(e) => setContent((e.target as HTMLElement).innerText)}
          onPaste={handlePaste}
          style={{
            outline: "none", fontSize: 15, lineHeight: 1.7, letterSpacing: "-0.005em",
            minHeight: "40vh", color: "#e0d6ff",
          }}
        />
      </div>

      {/* Photo strip */}
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {photos.map((p) => (
            <div key={p} style={{
              width: 72, height: 72, borderRadius: 14, overflow: "hidden",
              border: "2px solid rgba(167,139,250,0.3)", flexShrink: 0, position: "relative",
            }}>
              <img src={photoUrl(p)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" onClick={() => removePhoto(p)}
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
          <button type="button" onClick={() => photoInputRef.current?.click()}
            style={{
              width: 72, height: 72, borderRadius: 14,
              border: "1.5px dashed rgba(167,139,250,0.3)",
              background: "rgba(124,92,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#A78BFA",
            }}>
            <Plus size={22} />
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0F0F14", borderTop: "1px solid rgba(167,139,250,0.1)",
      }}>
        <span style={{ fontSize: 11, color: "#9e96b5", fontFamily: "monospace" }}>
          {wordCount > 0 ? `${wordCount} ${wordCount === 1 ? "palavra" : "palavras"}` : "Comece a escrever"}
        </span>
        <Button onClick={handleSave} disabled={saving || !content.trim()}
          style={{
            height: 40, paddingInline: 20, borderRadius: 12,
            background: "#7C5CFF", border: 0, color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            opacity: (saving || !content.trim()) ? 0.5 : 1,
          }}>
          {saving ? "Salvando…" : "Concluir"}
        </Button>
      </div>
    </div>
  );
}
