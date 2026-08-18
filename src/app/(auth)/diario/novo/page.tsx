"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { ChevronLeft, ChevronDown, Plus, X, ArrowRight, Camera } from "lucide-react";

const MOODS = [1, 2, 3, 4, 5] as const;
const MOOD_EMOJI: Record<number, string> = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😊" };

/** Get today's date in the user's actual browser timezone (not hardcoded offset) */
function getBrowserDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [entryDate, setEntryDate] = useState(() => getBrowserDate());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // ── Slash commands ──────────────────────────────────────────
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 });
  const slashSavedSel = useRef<{ node: Node | null; offset: number }>({ node: null, offset: 0 });
  const linkInsertPos = useRef<{ node: Node; offset: number } | null>(null);

  const [linkSearchOpen, setLinkSearchOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<any[]>([]);

  const [allEntries, setAllEntries] = useState<any[]>([]);
  const searchLinks = async (q: string) => {
    try {
      if (allEntries.length === 0) {
        const res = await fetch(`/api/diary?limit=50`);
        const data = await res.json();
        if (Array.isArray(data)) setAllEntries(data);
      }
      const source = allEntries.length > 0 ? allEntries : [];
      if (!q) { setLinkResults(source.slice(0, 20)); return; }
      const ql = q.toLowerCase();
      setLinkResults(source.filter((e: any) =>
        (e.title || "").toLowerCase().includes(ql) ||
        (e.content || "").toLowerCase().includes(ql) ||
        (e.date || "").includes(ql)
      ).slice(0, 20));
    } catch { setLinkResults([]); }
  };

  const SLASH_COMMANDS = [
    { id: "foto", label: "Inserir foto", emoji: "📷", action: () => photoInputRef.current?.click() },
    { id: "hora", label: "Inserir horário", emoji: "🕐", action: () => insertHtmlAtCursor(`<span contenteditable="false" style="color:#A78BFA;font-weight:700;font-size:13px;background:rgba(167,139,250,0.12);padding:1px 6px;border-radius:6px;white-space:nowrap;user-select:none">🕐 ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>&#8203;`) },
    { id: "emoji", label: "Inserir emoji", emoji: "😊", action: () => { setEmojiPickerOpen(true); } },
    { id: "link", label: "Vincular registro", emoji: "🔗", action: () => {
      setSlashOpen(false);
      // Save cursor position before opening search popup
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        linkInsertPos.current = { node: r.startContainer, offset: r.startOffset };
      }
      setLinkSearchOpen(true); setLinkQuery(""); searchLinks("");
    } },
  ];

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const EMOJI_LIST = ["😊","😂","❤️","🙏","😢","😡","😴","🥰","😰","🤔","💪","🔥","✨","🌟","🎉","💀","👍","👎","🤝","📝"];

  const insertHtmlAtCursor = (html: string) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    setContent(el.innerText);
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) { setSlashOpen(false); return; }
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;

    // If cursor is in an element (e.g., after draft restore), find the nearest text node
    if (node.nodeType !== 3 && node.childNodes[offset - 1]) {
      const prev = node.childNodes[offset - 1];
      if (prev.nodeType === 3) { node = prev; offset = (prev.textContent || "").length; }
      else if (prev.textContent) { node = prev; offset = (prev.textContent || "").length; }
    }

    const text = node.textContent || "";
    // Find if we're right after a "/"
    const before = text.slice(0, offset);
    const slashIdx = before.lastIndexOf("/");
    const prevChar = before[slashIdx - 1];
    const isSeparator = slashIdx === 0 || prevChar === " " || prevChar === "\n" || prevChar === " ";
    if (slashIdx >= 0 && isSeparator) {
      const query = before.slice(slashIdx + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setSlashQuery(query);
        slashSavedSel.current = { node, offset: slashIdx };
        // Posiciona o menu junto ao cursor (coordenadas do viewport)
        let top = 80;
        let left = 16;
        try {
          let caret = range.getBoundingClientRect();
          // Safari devolve retângulo zerado em range colapsado: usa marcador temporário
          if (!caret.height && !caret.top && !caret.bottom) {
            const marker = document.createElement("span");
            marker.style.display = "inline-block";
            marker.style.width = "1px";
            marker.style.height = "1em";
            marker.textContent = "​";
            const clone = range.cloneRange();
            clone.collapse(false);
            clone.insertNode(marker);
            const m = marker.getBoundingClientRect();
            marker.remove();
            caret = m;
          }
          const menuH = 260;
          const menuW = 220;
          const screenH = window.innerHeight;
          const screenW = window.innerWidth;
          const spaceBelow = screenH - caret.bottom;
          top = spaceBelow >= menuH + 16 ? caret.bottom + 6 : caret.top - menuH - 6;
          top = Math.max(8, Math.min(top, screenH - menuH - 8));
          left = Math.max(8, Math.min(caret.left, screenW - menuW - 8));
        } catch { /* mantém posição de fallback */ }
        setSlashPos({ x: left, y: top });
        setSlashOpen(true);
        return;
      }
    }
    setSlashOpen(false);
  };

  // Handle inline photo insertion
  const handlePhotoForSlash = useCallback(async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      const url = photoUrl(path);
      if (url) {
        insertHtmlAtCursor(`<div contenteditable="false" style="margin:8px 0"><img src="${url}" alt="" style="max-width:100%;max-height:180px;border-radius:10px;display:block;object-fit:cover" /></div><div><br/></div>`);
      }
    } catch { toast.error("Erro ao inserir foto"); }
  }, []);

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

  // ── Auto-draft ────────────────────────────────────────────
  const DRAFT_KEY = "diary_draft";
  const saveDraft = () => {
    const htmlContent = contentRef.current?.innerHTML || "";
    const d = latestRef.current;
    // Always save if there's any content, title, mood, or photos
    const hasContent = htmlContent.trim() || d.title.trim() || d.mood || d.photos.length > 0;
    if (!hasContent) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        date: d.entryDate, title: d.title, content: htmlContent, mood: d.mood, photos: d.photos,
        savedAt: Date.now(),
      }));
    } catch {}
  };

  const saveDraftAndGoBack = () => {
    saveDraft();
    router.back();
  };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };
  const loadDraft = (): any => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  // Auto-save draft every 10 seconds (stable interval, reads fresh values via refs)
  const latestRef = useRef({ title, mood, photos, entryDate });
  latestRef.current = { title, mood, photos, entryDate };
  useEffect(() => {
    const interval = setInterval(() => {
      const htmlContent = contentRef.current?.innerHTML || "";
      const { title, mood, photos, entryDate } = latestRef.current;
      if (!htmlContent.trim() && !title.trim() && !mood) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ date: entryDate, title, content: htmlContent, mood, photos, savedAt: Date.now() }));
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, []); // Run once — uses refs for latest values

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && (draft.content || draft.title)) {
      setEntryDate(draft.date || entryDate);
      setTitle(draft.title || "");
      setMood(draft.mood ?? null);
      setPhotos(draft.photos || []);
      // Restore title and content into contentEditable divs
      setTimeout(() => {
        if (titleRef.current) titleRef.current.innerText = draft.title || "";
        if (contentRef.current) contentRef.current.innerHTML = draft.content || "";
      }, 100);
      toast("Rascunho restaurado", { duration: 2000 });
    }
  }, []);

  const handleSave = async () => {
    const htmlContent = contentRef.current?.innerHTML || "";
    if (!htmlContent.trim() && !content.trim()) { toast.error(t("escreva_algo")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: entryDate, title: title.trim(), content: htmlContent.trim() || content.trim(), mood, photos }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Save error:", err);
        toast.error("Erro ao salvar. Tente de novo.");
        setSaving(false);
        return;
      }
      clearDraft();
      toast.success(t("entrada_salva"), { duration: 3000, dismissible: true });
      router.push("/diario");
      router.refresh();
    } catch (e) {
      console.error("Save exception:", e);
      toast.error("Erro ao salvar. Verifique sua conexão.");
      setSaving(false);
    }
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
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    // Trigger React state update
    (e.target as HTMLElement).dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0F0F14", paddingBottom: 100 }}>
      {/* Floating back */}
      <button type="button" onClick={saveDraftAndGoBack}
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
          ref={titleRef}
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
          ref={contentRef}
          contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
          aria-label="Conteúdo do diário" data-placeholder="Escreva o que estiver passando... (digite / para ações rápidas)"
          onInput={handleContentInput}
          onPaste={handlePaste}
          style={{
            outline: "none", fontSize: 15, lineHeight: 1.7, letterSpacing: "-0.005em",
            minHeight: "40vh", color: "#e0d6ff", position: "relative",
          }}
        />
        {/* Slash command menu */}
        {slashOpen && (
          <div style={{
            position: "fixed", left: Math.min(slashPos.x, typeof window !== "undefined" ? window.innerWidth - 220 : 200), top: slashPos.y, zIndex: 50,
            background: "#1a1530", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 14,
            padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 200, maxHeight: 260, overflowY: "auto",
          }}>
            {SLASH_COMMANDS.filter(c => c.id.includes(slashQuery.toLowerCase()) || c.label.toLowerCase().includes(slashQuery.toLowerCase())).map((cmd, i) => (
              <button key={cmd.id} type="button"
                onClick={() => {
                  setSlashOpen(false);
                  const el = contentRef.current; if (!el) return;
                  el.focus();
                  const sel = window.getSelection(); if (!sel) return;
                  const { node, offset } = slashSavedSel.current;
                  if (node && node.textContent) {
                    const before = node.textContent.slice(0, offset);
                    const after = node.textContent.slice(offset + 1 + slashQuery.length);
                    node.textContent = before + after;
                    const range = document.createRange();
                    range.setStart(node, before.length);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                  }
                  cmd.action();
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10,
                  border: 0, background: i === 0 ? "rgba(124,92,255,0.1)" : "transparent",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#e0d6ff",
                  fontWeight: 600, textAlign: "left", width: "100%",
                }}>
                <span style={{ fontSize: 18 }}>{cmd.emoji}</span>
                <span>{cmd.label}</span>
              </button>
            ))}
          </div>
        )}
        {/* Emoji picker */}
        {emojiPickerOpen && (
          <div style={{
            position: "fixed", bottom: 300, left: "50%", transform: "translateX(-50%)", zIndex: 50,
            background: "#1a1530", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 14,
            padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", display: "flex", flexWrap: "wrap", gap: 4,
            maxWidth: 320,
          }}>
            {EMOJI_LIST.map(emoji => (
              <button key={emoji} type="button" onClick={() => {
                insertHtmlAtCursor(emoji);
                setEmojiPickerOpen(false);
              }}
                style={{ width: 40, height: 40, borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", fontSize: 22 }}>
                {emoji}
              </button>
            ))}
            <button type="button" onClick={() => setEmojiPickerOpen(false)}
              style={{ width: "100%", padding: "6px 0", borderRadius: 8, border: 0, background: "transparent", cursor: "pointer", color: "#9e96b5", fontSize: 11, fontFamily: "inherit" }}>
              Fechar
            </button>
          </div>
        )}
        {/* Link search popup */}
        {linkSearchOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}>
            <div style={{ width: "100%", maxWidth: 380, background: "#1a1530", borderRadius: 20, padding: 20, border: "1px solid rgba(167,139,250,0.2)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>🔗 Vincular registro</h3>
                <button type="button" onClick={() => setLinkSearchOpen(false)} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
              <input value={linkQuery} onChange={e => { setLinkQuery(e.target.value); searchLinks(e.target.value); }}
                placeholder="Buscar por título ou conteúdo..."
                autoFocus
                style={{ width: "100%", boxSizing: "border-box" as any, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 10 }} />
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {linkResults.map((entry: any) => {
                  const d = new Date(entry.date + "T12:00:00");
                  const dateStr = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
                  return (
                    <button key={entry.id} type="button"
                      onClick={() => {
                        setLinkSearchOpen(false);
                        const title = entry.title || dateStr;
                        // Restore cursor to where /link was typed
                        const el = contentRef.current;
                        if (el && linkInsertPos.current) {
                          el.focus();
                          const sel = window.getSelection();
                          if (sel) {
                            const range = document.createRange();
                            range.setStart(linkInsertPos.current.node, linkInsertPos.current.offset);
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                        }
                        insertHtmlAtCursor(`<a href="/diario/${entry.id}" contenteditable="false" style="color:#A78BFA;font-weight:600;text-decoration:underline;cursor:pointer" onclick="event.preventDefault();window.location.href='/diario/${entry.id}'">📔 ${title}</a>&nbsp;`);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", color: "#e0d6ff" }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📔</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.title || "Sem título"}
                        </span>
                        <span style={{ fontSize: 10, color: "#9e96b5" }}>{dateStr}{entry.mood ? ` · ${["😔","😕","😐","🙂","😊"][entry.mood - 1] || ""}` : ""}</span>
                      </div>
                    </button>
                  );
                })}
                {linkResults.length === 0 && (
                  <p style={{ textAlign: "center", color: "#9e96b5", fontSize: 12, padding: 16 }}>
                    {linkQuery ? "Nenhum registro encontrado" : allEntries.length === 0 ? "Carregando..." : "Nenhum registro"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
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
            onChange={(e) => { if (e.target.files?.[0]) handlePhotoForSlash(e.target.files[0]); e.target.value = ""; }} />
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
