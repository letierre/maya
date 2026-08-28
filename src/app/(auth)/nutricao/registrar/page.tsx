"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";
import { getMealTypeFromHour, mealTypeLabel, mealTypeEmoji } from "@/lib/meal-utils";
import { compressImage, uploadToCloud } from "@/lib/photo-storage";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { Camera, ImageIcon, X, Plus, Check, ChevronLeft, ChevronDown, Sparkles, Star } from "lucide-react";
import type { MealType, MealItem, Macros, MealClassification } from "@/types";
import { toast } from "sonner";

const MEAL_TYPES: MealType[] = ["cafe_da_manha", "almoco", "lanche", "jantar", "lanche_noturno"];
const MAX_PHOTOS = 3;

type Stage = "capture" | "analyzing" | "results";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const PURPLE_OKLCH = "oklch(.58 .18 270)";
const FOREGROUND = "#e0d6ff";
const DARK_CARD = "oklch(.17 .015 270 / .6)";

// ── Classification map matching actual API types ─────────────
const CLASSIFICATION_STYLE: Record<string, { bg: string; text: string; emoji: string; label: string }> = {
  equilibrada:      { bg: "oklch(0.45 0.15 160 / 0.12)", text: "oklch(0.45 0.15 160)", emoji: "✅", label: "Equilibrada" },
  leve_proteina:    { bg: "oklch(0.60 0.12 70 / 0.12)",  text: "oklch(0.60 0.12 70)",  emoji: "💪", label: "Leve em proteína" },
  alta_acucar:      { bg: "oklch(0.50 0.15 15 / 0.12)",  text: "oklch(0.50 0.15 15)",  emoji: "🍬", label: "Alta em açúcar" },
  alta_gordura:     { bg: "oklch(0.55 0.15 45 / 0.12)",  text: "oklch(0.55 0.15 45)",  emoji: "🍟", label: "Alta em gordura" },
  alta_sal:         { bg: "oklch(0.58 0.18 270 / 0.12)", text: "oklch(0.58 0.18 270)", emoji: "🧂", label: "Alta em sódio" },
  vegetais_baixo:   { bg: "oklch(0.50 0.12 220 / 0.12)", text: "oklch(0.50 0.12 220)", emoji: "🥬", label: "Poucos vegetais" },
  nao_identificada: { bg: "oklch(0.5 0 0 / 0.08)",        text: MUTED,                emoji: "❓", label: "Não identificada" },
};

const BG_GRADIENT: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.58 .18 270 / .15) 0%, transparent 60%),
    linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
  `,
  fontFamily: "var(--font-sans)",
  color: FOREGROUND,
};

// ── Helpers ────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const days = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} · ${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

// ── Page ───────────────────────────────────────────────────────

export default function RegistrarRefeicaoPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // --- Capture state ---
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType>(() => getMealTypeFromHour(new Date().getHours()));
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [dateTime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- Analysis state ---
  const [stage, setStage] = useState<Stage>("capture");
  const [mealId, setMealId] = useState<string | null>(null);
  const [analysisItems, setAnalysisItems] = useState<MealItem[]>([]);
  const [analysisMacros, setAnalysisMacros] = useState<Macros | null>(null);
  const [analysisClass, setAnalysisClass] = useState<MealClassification | null>(null);
  const [analysisObs, setAnalysisObs] = useState("");
  const [favorited, setFavorited] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const handleFile = async (file: File) => {
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos por refeição`);
      return;
    }
    try {
      const compressed = await compressImage(file, { maxDim: 1024, quality: 0.85 });
      const path = await uploadToCloud(compressed, "meals");
      setPhotos((prev) => [...prev, compressed]);
      setPhotoPaths((prev) => [...prev, path]);
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPaths((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_hora: new Date(dateTime).toISOString(),
          tipo_refeicao: mealType,
          foto_path: photoPaths.length > 0 ? photoPaths[0] : null,
          fotos: photoPaths,
          texto_livre: description.trim(),
          status_analise: "pendente",
          favorited,
          itens: [],
          macros: null,
          classificacao: null,
          observacao: "",
        }),
      });
      if (!res.ok) throw new Error();
      const meal = await res.json();

      if (meal.id) {
        setMealId(meal.id);
        setStage("analyzing");
        setSaving(false);
        toast.success(t("refeicao_salva"));

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);
          const hasPhotos = photos.length > 0 && photoPaths.length > 0;
          const analyzeRes = await fetch("/api/meals/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mealId: meal.id,
              ...(hasPhotos ? { photosBase64: photos } : {}),
              description: description.trim(),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (analyzeRes.ok) {
            const analyzed = await analyzeRes.json();
            setAnalysisItems(analyzed.itens || []);
            setAnalysisMacros(analyzed.macros || null);
            setAnalysisClass(analyzed.classificacao || "nao_identificada");
            setAnalysisObs(analyzed.observacao || "");
            setStage("results");
          } else {
            setAnalysisItems([]);
            setAnalysisMacros(null);
            setAnalysisClass("nao_identificada");
            setAnalysisObs("");
            toast.error(t("erro_analisar"));
            setStage("results");
          }
        } catch {
          toast.error(t("erro_analisar"));
          setStage("results");
        }
      }
    } catch {
      toast.error(t("erro_salvar_refeicao"));
      setSaving(false);
    }
  };

  const addItem = () => {
    const nome = newItemName.trim();
    if (!nome) return;
    setAnalysisItems((prev) => [...prev, { nome }]);
    setNewItemName("");
  };

  const removeItem = (idx: number) => {
    setAnalysisItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemName = (idx: number, nome: string) => {
    setAnalysisItems((prev) => prev.map((item, i) => (i === idx ? { ...item, nome } : item)));
  };

  const confirmAnalysis = async () => {
    if (!mealId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mealId,
          data_hora: new Date(dateTime).toISOString(),
          tipo_refeicao: mealType,
          itens: analysisItems,
          macros: analysisMacros,
          classificacao: analysisClass,
          observacao: analysisObs,
          texto_livre: description.trim(),
          fotos: photoPaths,
          status_analise: "analisado",
          favorited,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("refeicao_atualizada"));
      invalidateFetchCache("/api/meals");
      router.push("/nutricao");
    } catch {
      toast.error(t("erro_salvar_refeicao"));
    } finally {
      setSaving(false);
    }
  };

  const skipAnalysis = () => {
    invalidateFetchCache("/api/meals");
    router.push("/nutricao");
  };

  const classInfo = analysisClass ? (CLASSIFICATION_STYLE[analysisClass] ?? CLASSIFICATION_STYLE.nao_identificada) : null;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", ...BG_GRADIENT, overflow: "hidden" }}>
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: "oklch(.16 .012 270 / .65)", backdropFilter: "blur(12px)", border: 0, cursor: "pointer",
            }}
          >
            <ChevronLeft style={{ width: 16, height: 16, color: FOREGROUND }} />
          </button>
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, color: MUTED, margin: 0 }}>
              Nutrição
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: FOREGROUND, margin: "2px 0 0" }}>
              {stage === "results" ? "Sua refeição" : "Nova refeição"}
            </h1>
          </div>
        </div>
        <p style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", fontFamily: "monospace", margin: 0, paddingTop: 2 }}>
          {formatDateTime(dateTime)}
        </p>
      </div>

      {/* ── Meal type chip ─────────────────────────────────── */}
      <div style={{ padding: "0 16px 8px", flexShrink: 0 }}>
        <button
          onClick={() => setShowTypePicker(!showTypePicker)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 8px",
            borderRadius: 9999, cursor: "pointer", border: `1px solid ${BORDER}`, fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, background: DARK_CARD, color: FOREGROUND,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{mealTypeEmoji(mealType)}</span>
          {mealTypeLabel(mealType)}
          <ChevronDown style={{ width: 10, height: 10 }} />
        </button>

        {showTypePicker && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                onClick={() => { setMealType(mt); setShowTypePicker(false); }}
                style={{
                  padding: "6px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 500,
                  border: 0, cursor: "pointer", fontFamily: "inherit",
                  background: mt === mealType ? PURPLE_HEX : "oklch(.22 .015 270 / .5)",
                  color: mt === mealType ? "#fff" : FOREGROUND,
                }}
              >
                {mealTypeEmoji(mt)} {mealTypeLabel(mt)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content (scrollable if needed) ─────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", minHeight: 0 }}>

        {/* ── STAGE: capture ── */}
        {stage === "capture" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Photo area */}
            {photos.length === 0 ? (
              <div
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  borderRadius: 16, border: `1.5px dashed ${PURPLE_OKLCH} / 0.4`,
                  background: `linear-gradient(135deg, ${PURPLE_OKLCH} / 0.06, ${PURPLE_OKLCH} / 0.02)`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: "28px 16px", gap: 8, position: "relative", overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute", right: -20, top: -20, width: 144, height: 144, borderRadius: "50%",
                  background: `radial-gradient(circle, ${PURPLE_OKLCH} / .12, transparent 70%)`, pointerEvents: "none",
                }} />
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: PURPLE_HEX, boxShadow: `0 8px 24px -8px ${PURPLE_HEX} / .5`,
                }}>
                  <Camera style={{ width: 22, height: 22, color: "#fff", strokeWidth: 1.7 }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: FOREGROUND, margin: 0 }}>Tire uma foto</p>
                <p style={{ fontSize: 11, color: MUTED, textAlign: "center", maxWidth: 220, margin: 0 }}>
                  A Maya identifica ingredientes e estima os macros
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                    style={{
                      padding: "6px 12px", borderRadius: 10, background: DARK_CARD, border: `1px solid ${BORDER}`,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: FOREGROUND,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <Camera style={{ width: 14, height: 14 }} /> Câmera
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    style={{
                      padding: "6px 12px", borderRadius: 10, background: DARK_CARD, border: `1px solid ${BORDER}`,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: FOREGROUND,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <ImageIcon style={{ width: 14, height: 14 }} /> Galeria
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: photos.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
                      <img src={p} alt={`Refeição ${i + 1}`} style={{ width: "100%", aspectRatio: photos.length === 1 ? "16/9" : "4/3", objectFit: "cover", display: "block" }} />
                      <button
                        onClick={() => removePhoto(i)}
                        style={{
                          position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%",
                          background: "rgba(0,0,0,0.55)", border: 0, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <X style={{ width: 14, height: 14, color: "#fff" }} />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        borderRadius: 14, border: `1.5px dashed ${BORDER}`, background: "transparent",
                        cursor: "pointer", fontFamily: "inherit",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                      }}
                    >
                      <Plus style={{ width: 20, height: 20, color: MUTED }} />
                      <span style={{ fontSize: 10, color: MUTED }}>Adicionar</span>
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 8 }}>
                  {photos.length} de {MAX_PHOTOS} fotos
                </p>
              </div>
            )}

            {/* Description */}
            <textarea
              placeholder="Ex: salada com frango grelhado, arroz integral e abacate…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{
                width: "100%", borderRadius: 14, border: `1px solid ${BORDER}`,
                background: DARK_CARD, color: FOREGROUND, fontSize: 14, fontFamily: "inherit",
                padding: "10px 14px", outline: "none", resize: "none",
                boxSizing: "border-box", lineHeight: 1.5, minHeight: 56,
              }}
            />
          </div>
        )}

        {/* ── STAGE: analyzing ── */}
        {stage === "analyzing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 16 }}>
            <div style={{
              width: "100%", borderRadius: 16, overflow: "hidden", position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${PURPLE_OKLCH} / .15, ${PURPLE_OKLCH} / .05)`,
              padding: "40px 0",
            }}>
              {photos[0] && (
                <img
                  src={photos[0]} alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.4, filter: "blur(8px) saturate(1.3)" }}
                />
              )}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / .35) 50%, transparent 100%)",
                animation: "shimmer 1.6s linear infinite",
              }} />
              <div style={{ position: "relative", textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px",
                  background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden",
                }}>
                  <img
                    src="/maya-avatar.webp" alt="Maya"
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid white" }}
                  />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.35)", margin: 0 }}>
                  Maya está olhando…
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: MUTED, fontStyle: "italic", margin: 0 }}>
              Identificando ingredientes e estimando os macros
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, width: "100%" }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1", borderRadius: 14,
                    background: "linear-gradient(120deg, oklch(.16 .012 270), oklch(.19 .015 270), oklch(.16 .012 270))",
                    backgroundSize: "200% 100%",
                    animation: "shimmerBg 1.6s linear infinite",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── STAGE: results ── */}
        {stage === "results" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Photo (compact) */}
            {photos.length > 0 && (
              <div style={{ borderRadius: 16, overflow: "hidden", position: "relative" }}>
                <img src={photos[0]} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
                <span style={{
                  position: "absolute", top: 10, right: 10, padding: "3px 10px", borderRadius: 9999,
                  fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: PURPLE_HEX, color: "#fff",
                }}>
                  <Check style={{ width: 10, height: 10, strokeWidth: 3 }} /> Analisado
                </span>
              </div>
            )}

            {/* Macro tiles */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px 4px" }}>
                Macros estimados
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                {([
                  { label: "Kcal", value: analysisMacros?.calorias_kcal ?? "—", color: "oklch(0.60 0.12 70)" },
                  { label: "Carb", value: analysisMacros?.carboidratos_g != null ? `${analysisMacros.carboidratos_g}g` : "—", color: "oklch(0.55 0.15 45)" },
                  { label: "Prot", value: analysisMacros?.proteinas_g != null ? `${analysisMacros.proteinas_g}g` : "—", color: "oklch(0.50 0.15 15)" },
                  { label: "Gord", value: analysisMacros?.gorduras_g != null ? `${analysisMacros.gorduras_g}g` : "—", color: PURPLE_OKLCH },
                ]).map(({ label, value, color }) => (
                  <div key={label} style={{
                    borderRadius: 14, textAlign: "center", padding: "8px 4px",
                    background: `${color} / 0.10`, border: `1px solid ${color} / 0.18`,
                  }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: FOREGROUND, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {value}
                    </p>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color, margin: "2px 0 0" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED, margin: 0 }}>
                  Identificados
                </p>
                <span style={{ fontSize: 11, color: MUTED }}>
                  {analysisItems.length} {analysisItems.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {analysisItems.map((item, idx) => (
                  <span key={idx} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 9999, fontSize: 12,
                    background: DARK_CARD, border: `1px solid ${BORDER}`,
                  }}>
                    <input
                      value={item.nome}
                      onChange={(e) => updateItemName(idx, e.target.value)}
                      style={{
                        background: "transparent", border: "none", outline: "none",
                        fontSize: 12, color: FOREGROUND, fontFamily: "inherit",
                        minWidth: 60, width: Math.max(60, item.nome.length * 8),
                      }}
                    />
                    <button
                      onClick={() => removeItem(idx)}
                      style={{
                        width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, background: `${PURPLE_OKLCH} / .15`, border: 0, cursor: "pointer",
                      }}
                    >
                      <X style={{ width: 9, height: 9, color: MUTED }} />
                    </button>
                  </span>
                ))}

                {addingItem ? (
                  <input
                    autoFocus
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { addItem(); setAddingItem(false); }
                      if (e.key === "Escape") { setAddingItem(false); setNewItemName(""); }
                    }}
                    onBlur={() => { if (newItemName.trim()) addItem(); setAddingItem(false); setNewItemName(""); }}
                    placeholder="novo item"
                    style={{
                      padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontFamily: "inherit",
                      background: DARK_CARD, border: `1px solid ${PURPLE_OKLCH} / .35`,
                      color: FOREGROUND, outline: "none",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setAddingItem(true)}
                    style={{
                      padding: "4px 10px", borderRadius: 9999, border: `1.5px dashed ${BORDER}`,
                      cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: "transparent", color: MUTED,
                    }}
                  >
                    <Plus style={{ width: 10, height: 10 }} /> Adicionar
                  </button>
                )}
              </div>
            </div>

            {/* Classification */}
            {classInfo && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED, margin: "0 0 6px 4px" }}>
                  Classificação
                </p>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: classInfo.bg, color: classInfo.text, border: `1px solid ${classInfo.text} / .18`,
                }}>
                  <span style={{ fontSize: 14 }}>{classInfo.emoji}</span>
                  {classInfo.label}
                </span>
                {analysisObs && (
                  <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.45, fontStyle: "italic", margin: "6px 0 0" }}>
                    {analysisObs}
                  </p>
                )}
              </div>
            )}

            {/* Favorite toggle */}
            <button
              type="button"
              onClick={() => setFavorited(!favorited)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: `1px solid ${favorited ? "#fbbf24 / .35" : BORDER}`,
                background: favorited ? "oklch(0.95 0.18 90 / 0.10)" : DARK_CARD,
                color: favorited ? "#fbbf24" : MUTED, cursor: "pointer",
                fontFamily: "inherit", alignSelf: "flex-start",
              }}
            >
              <Star style={{
                width: 16, height: 16,
                fill: favorited ? "#fbbf24" : "none",
              }} />
              {favorited ? "Favoritada" : "Favoritar refeição"}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom bar ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "12px 16px",
        background: `linear-gradient(180deg, transparent, oklch(.12 .012 270 / .85) 25%, oklch(.12 .012 270))`,
        display: "flex", alignItems: "center", gap: 8,
        borderTop: `1px solid ${BORDER}`,
      }}>
        {stage === "capture" && (
          <>
            <span style={{ flex: 1, fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
              {photos.length > 0 && `${photos.length} foto${photos.length > 1 ? "s" : ""}`}
              {photos.length > 0 && description.trim() && " · "}
              {description.trim() && "1 descrição"}
              {!photos.length && !description.trim() && "Adicione foto ou descrição"}
            </span>
            <button
              onClick={handleSave}
              disabled={saving || (!photos.length && !description.trim())}
              style={{
                padding: "12px 22px", borderRadius: 14, border: 0, cursor: "pointer",
                background: saving || (!photos.length && !description.trim())
                  ? "oklch(.22 .015 270 / .6)"
                  : PURPLE_HEX,
                color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 6,
                boxShadow: saving || (!photos.length && !description.trim())
                  ? "none"
                  : `0 4px 14px -4px ${PURPLE_HEX} / .5`,
                opacity: saving || (!photos.length && !description.trim()) ? 0.5 : 1,
              }}
            >
              {photos.length > 0 ? "Analisar" : "Salvar"}
              <Sparkles style={{ width: 14, height: 14 }} />
            </button>
          </>
        )}

        {stage === "analyzing" && (
          <p style={{ flex: 1, fontSize: 13, color: MUTED, textAlign: "center", fontStyle: "italic", margin: 0 }}>
            Analisando sua refeição...
          </p>
        )}

        {stage === "results" && (
          <>
            <button
              onClick={skipAnalysis}
              style={{
                padding: "10px 14px", borderRadius: 12, border: `1px solid oklch(.28 .02 270 / .5)`,
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                background: "transparent", color: MUTED, flexShrink: 0,
              }}
            >
              Salvar sem análise
            </button>
            <button
              onClick={confirmAnalysis}
              disabled={saving}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 14, border: 0, cursor: "pointer",
                background: saving ? "oklch(.22 .015 270 / .6)" : PURPLE_HEX,
                color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: saving ? "none" : `0 4px 14px -4px ${PURPLE_HEX} / .5`,
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Salvando..." : "Confirmar e salvar"}
              <Check style={{ width: 14, height: 14, strokeWidth: 2.5 }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
