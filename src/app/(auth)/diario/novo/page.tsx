"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { ChevronLeft, ChevronDown, Plus, X, ArrowRight } from "lucide-react";

const MOODS = [
  { value: 1, emoji: "😔" },
  { value: 2, emoji: "😕" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😊" },
];

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

  const selectedMoodEmoji = MOODS.find((m) => m.value === mood)?.emoji ?? "😶";

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
    if (!content.trim()) {
      toast.error(t("escreva_algo"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entryDate, title: title.trim(), content: content.trim(), mood, photos }),
    });
    if (!res.ok) {
      toast.error(t("erro_salvar_entrada"));
      setSaving(false);
      return;
    }
    toast.success(t("entrada_salva"));
    router.push("/diario");
    router.refresh();
  };

  const handlePhotoAdd = useCallback(async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setPhotos((prev) => [...prev, path]);
    } catch {
      toast.error("Erro ao processar imagem");
    }
  }, []);

  const removePhoto = useCallback((path: string) => {
    setPhotos((prev) => prev.filter((p) => p !== path));
  }, []);

  // Prevent pasting HTML — only plain text
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-28"
      style={{
        background: `
          radial-gradient(ellipse 80% 40% at 50% 0%, oklch(.95 .04 80 / .45) 0%, transparent 60%),
          linear-gradient(180deg, oklch(.99 .003 80) 0%, oklch(.96 .015 80) 100%)
        `,
      }}
    >
      {/* Floating back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-white/55 backdrop-blur-md border-0 flex items-center justify-center shadow-sm cursor-pointer"
        style={{ color: "var(--foreground)" }}
        aria-label="Voltar"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Floating mood picker */}
      <div className="absolute top-4 right-4 z-10">
        <button
          type="button"
          onClick={() => setMoodOpen(!moodOpen)}
          className="h-9 pl-3.5 pr-3 rounded-full bg-white/55 backdrop-blur-md border-0 cursor-pointer flex items-center gap-1 shadow-sm"
          style={{ color: "var(--foreground)" }}
        >
          <span className="text-lg leading-none">{selectedMoodEmoji}</span>
          <ChevronDown
            className={`w-3 h-3 text-muted-foreground transition-transform ${moodOpen ? "rotate-180" : ""}`}
          />
        </button>

        {moodOpen && (
          <div
            className="absolute top-11 right-0 rounded-2xl p-1.5 flex gap-0.5 shadow-xl border"
            style={{
              background: "oklch(1 0 0 / .9)",
              backdropFilter: "blur(16px)",
              borderColor: "oklch(.5 .12 160 / .15)",
            }}
          >
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setMood(m.value); setMoodOpen(false); }}
                className="w-10 h-10 rounded-full border-0 cursor-pointer text-xl transition-colors"
                style={{
                  background: mood === m.value ? "oklch(.5 .12 160 / .15)" : "transparent",
                  fontFamily: "inherit",
                }}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date header — letter style */}
      <div className="px-8 pt-16 pb-2">
        <div className="relative inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={openDatePicker}
            className="bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1.5"
          >
            <p className="m-0 font-mono text-[11px] text-muted-foreground tracking-wider uppercase">
              {formatLongDate(entryDate)}
            </p>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          <input
            type="date"
            ref={dateInputRef}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
          />
        </div>
      </div>

      {/* Title — contentEditable, no border */}
      <div className="px-8 pb-4">
        <div
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Título"
          data-placeholder="Título (opcional)"
          onInput={(e) => setTitle((e.target as HTMLElement).innerText)}
          onPaste={handlePaste}
          className="outline-none text-[28px] font-bold tracking-tight leading-[1.15] min-h-[1.15em]"
          style={{ color: "var(--foreground)" }}
        />
      </div>

      {/* Content — flowing contentEditable */}
      <div className="px-8">
        <div
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Conteúdo do diário"
          data-placeholder="Escreva o que estiver passando..."
          onInput={(e) => setContent((e.target as HTMLElement).innerText)}
          onPaste={handlePaste}
          className="outline-none text-base leading-[1.65] tracking-tight min-h-[50vh]"
          style={{ color: "var(--foreground)" }}
        />
      </div>

      {/* Photo strip */}
      <div className="px-8 pt-6">
        <div className="flex gap-2 items-center flex-wrap">
          {photos.map((p) => (
            <div
              key={p}
              className="relative w-[72px] h-[72px] rounded-xl overflow-hidden border-[1.5px] border-white flex-none"
              style={{ boxShadow: "0 2px 8px -2px oklch(.25 .02 160 / .15)" }}
            >
              <img src={photoUrl(p)!} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-[72px] h-[72px] rounded-xl border-[1.5px] border-dashed flex-none flex items-center justify-center cursor-pointer transition-colors hover:bg-white/60"
            style={{
              borderColor: "oklch(.5 .12 160 / .3)",
              background: "oklch(1 0 0 / .4)",
              color: "oklch(.5 .12 160 / .7)",
            }}
          >
            <Plus className="w-5 h-5" />
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Maya pill — só depois de escrever */}
      {content.trim().length > 30 && (
        <div className="px-8 pt-8">
          <button
            type="button"
            onClick={() => router.push(`/insights?context=${entryDate}`)}
            className="inline-flex items-center gap-2 border rounded-full cursor-pointer transition-colors hover:bg-white/80"
            style={{
              background: "oklch(1 0 0 / .6)",
              backdropFilter: "blur(8px)",
              borderColor: "oklch(.5 .12 160 / .2)",
              padding: "8px 14px 8px 8px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--foreground)",
              letterSpacing: "-0.005em",
            }}
          >
            <span
              className="w-[22px] h-[22px] rounded-full overflow-hidden border border-white flex-none"
            >
              <img src="/Maya.png" alt="" className="w-full h-full object-cover" />
            </span>
            Conversar sobre isso com Maya
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Bottom bar — fixed, above bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] px-4 py-3 flex items-center justify-between"
        style={{
          background: "linear-gradient(180deg, transparent 0%, oklch(.99 .003 80 / .88) 28%, oklch(.99 .003 80) 100%)",
        }}
      >
        <span className="text-[11px] text-muted-foreground font-mono">
          {wordCount > 0 ? `${wordCount} ${wordCount === 1 ? "palavra" : "palavras"}` : "Comece a escrever"}
        </span>
        <Button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="h-10 px-5 rounded-xl text-[13px] font-semibold"
          style={{ boxShadow: "0 4px 12px -4px oklch(.5 .12 160 / .45)" }}
        >
          {saving ? "Salvando…" : "Concluir"}
        </Button>
      </div>
    </div>
  );
}
