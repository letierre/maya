"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import {
  mealTypeEmoji,
  mealTypeLabel,
  classificationLabel,
} from "@/lib/meal-utils";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { ArrowLeft, Camera, ImageIcon, X, Trash2, Plus, Loader2, Sparkles, Star } from "lucide-react";
import type { MealType, MealItem, Macros, MealClassification, Meal } from "@/types";

const MEAL_TYPES: MealType[] = [
  "cafe_da_manha",
  "almoco",
  "lanche",
  "jantar",
  "lanche_noturno",
];

const MAX_PHOTOS = 3;

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const PURPLE_HEX = "#7C5CFF";
const RED = "oklch(0.50 0.15 15)";
const FOREGROUND = "#e0d6ff";

const CLASSIFICATION_STYLE: Record<string, { bg: string; text: string }> = {
  equilibrada:         { bg: "oklch(0.45 0.15 160 / 0.12)", text: "oklch(0.45 0.15 160)" },
  leve_proteina:       { bg: "oklch(0.60 0.12 70 / 0.12)",  text: "oklch(0.60 0.12 70)" },
  alta_acucar:         { bg: "oklch(0.50 0.15 15 / 0.12)",  text: "oklch(0.50 0.15 15)" },
  alta_gordura:        { bg: "oklch(0.55 0.15 45 / 0.12)",  text: "oklch(0.55 0.15 45)" },
  alta_sal:            { bg: "oklch(0.58 0.18 270 / 0.12)", text: "oklch(0.58 0.18 270)" },
  vegetais_baixo:      { bg: "oklch(0.50 0.12 220 / 0.12)", text: "oklch(0.50 0.12 220)" },
  nao_identificada:    { bg: "oklch(0.5 0 0 / 0.08)",       text: "#9e96b5" },
};

const BG_GRADIENT: React.CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 55% at 80% 0%, oklch(.58 .18 270 / .15) 0%, transparent 55%),
    radial-gradient(ellipse 70% 40% at 0% 100%, oklch(.58 .18 270 / .1) 0%, transparent 50%),
    linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
  `,
  fontFamily: "var(--font-sans)",
  color: FOREGROUND,
};

// ── Button style helpers ───────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 12, border: 0, cursor: "pointer",
  background: PURPLE_HEX, color: "#fff", fontSize: 13, fontWeight: 600,
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
};

const btnOutline: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 12, border: `1px solid ${BORDER}`,
  cursor: "pointer", background: "transparent", color: FOREGROUND,
  fontSize: 13, fontWeight: 500, fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const btnSm: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 10, border: `1px solid ${BORDER}`,
  cursor: "pointer", background: "transparent", color: FOREGROUND,
  fontSize: 12, fontWeight: 500, fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 4,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "oklch(.17 .015 270 / .6)",
  border: `1px solid ${BORDER}`,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: FOREGROUND,
};

const inputBase: React.CSSProperties = {
  width: "100%", borderRadius: 12, border: `1px solid ${BORDER}`,
  background: "oklch(.18 .015 270 / .5)", color: FOREGROUND,
  fontSize: 14, fontFamily: "inherit", padding: "10px 14px",
  outline: "none", boxSizing: "border-box",
};

const mutedText: React.CSSProperties = {
  fontSize: 11, color: MUTED,
};

// ── Helpers ────────────────────────────────────────────────────

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocal(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Page ───────────────────────────────────────────────────────

export default function MealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Edit form state
  const [mealType, setMealType] = useState<MealType>("almoco");
  const [dateTime, setDateTime] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [items, setItems] = useState<MealItem[]>([]);
  const [macros, setMacros] = useState<Macros | null>(null);
  const [classif, setClassif] = useState<MealClassification | null>(null);
  const [obs, setObs] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/meals?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.id) {
          setMeal(data);
          setMealType(data.tipo_refeicao);
          setDateTime(toDatetimeLocal(data.data_hora));
          setDescription(data.texto_livre || "");
          setPhotoPaths(data.fotos || []);
          setItems(data.itens || []);
          setMacros(data.macros);
          setClassif(data.classificacao);
          setObs(data.observacao || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const toggleFavorite = async () => {
    if (!meal) return;
    const newFav = !meal.favorited;
    // Optimistic update
    setMeal((prev) => prev ? { ...prev, favorited: newFav } : prev);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id, favorited: newFav }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback
      setMeal((prev) => prev ? { ...prev, favorited: !newFav } : prev);
      toast.error("Erro ao favoritar");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/meals?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Erro ao deletar refeição");
        return;
      }
      toast.success("Refeição deletada");
      invalidateFetchCache("/api/meals");
      router.push("/nutricao");
    } catch {
      toast.error("Erro ao deletar refeição");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAnalyze = async () => {
    if (!meal) return;
    setAnalyzing(true);
    try {
      const hasPhotos = meal.fotos && meal.fotos.length > 0;
      let photosBase64: string[] = [];
      if (hasPhotos) {
        const loaded: string[] = [];
        for (const path of meal.fotos!) {
          const url = photoUrl(path);
          if (url) {
            try {
              const resp = await fetch(url);
              const blob = await resp.blob();
              const b64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              loaded.push(b64);
            } catch { /* skip photo that fails to load */ }
          }
        }
        photosBase64 = loaded;
      }

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealId: meal.id,
          ...(photosBase64.length > 0 ? { photosBase64 } : {}),
          description: meal.texto_livre || "",
          items: (meal.itens || []).map((i) => i.nome),
        }),
      });

      if (!res.ok) throw new Error();
      const analyzed = await res.json();
      setMeal((prev) =>
        prev
          ? {
              ...prev,
              itens: analyzed.itens || [],
              macros: analyzed.macros || null,
              classificacao: analyzed.classificacao || "nao_identificada",
              observacao: analyzed.observacao || "",
              status_analise: "analisado",
            }
          : prev
      );
      setItems(analyzed.itens || []);
      setMacros(analyzed.macros || null);
      setClassif(analyzed.classificacao || "nao_identificada");
      setObs(analyzed.observacao || "");
      toast.success("Refeição analisada!");
    } catch {
      toast.error("Erro ao analisar refeição");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          data_hora: new Date(dateTime).toISOString(),
          tipo_refeicao: mealType,
          foto_path: photoPaths.length > 0 ? photoPaths[0] : null,
          fotos: photoPaths,
          texto_livre: description.trim(),
          itens: items,
          macros,
          classificacao: classif,
          observacao: obs,
          status_analise: meal?.status_analise || "pendente",
        }),
      });

      if (!res.ok) throw new Error();
      toast.success("Refeição atualizada");
      setEditing(false);
      setMeal((prev) =>
        prev
          ? {
              ...prev,
              tipo_refeicao: mealType,
              data_hora: new Date(dateTime).toISOString(),
              texto_livre: description.trim(),
              foto_path: photoPaths.length > 0 ? photoPaths[0] : null,
              fotos: photoPaths,
              itens: items,
              macros,
              classificacao: classif,
              observacao: obs,
            }
          : prev
      );
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoAdd = async (file: File) => {
    if (photos.length + photoPaths.length >= MAX_PHOTOS) {
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

  const addItem = () => {
    const nome = newItemName.trim();
    if (!nome) return;
    setItems((prev) => [...prev, { nome }]);
    setNewItemName("");
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItemName = (idx: number, nome: string) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, nome } : item)));
  };

  // ── Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", ...BG_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: MUTED, fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  if (!meal) {
    return (
      <div style={{ minHeight: "100dvh", ...BG_GRADIENT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 48 }}>🍽️</div>
        <p style={{ color: MUTED }}>Refeição não encontrada</p>
        <button type="button" style={btnPrimary} onClick={() => router.push("/nutricao")}>
          Voltar
        </button>
      </div>
    );
  }

  const displayPhotos = photos.length > 0
    ? photos
    : photoPaths.map((p) => photoUrl(p)).filter(Boolean) as string[];

  return (
    <div style={{ minHeight: "100dvh", ...BG_GRADIENT, paddingBottom: 40 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, padding: "24px 16px" }}>

        {/* ── Top bar ────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => router.push("/nutricao")}
              aria-label="Voltar"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: 0, cursor: "pointer", color: FOREGROUND,
              }}
            >
              <ArrowLeft style={{ width: 20, height: 20 }} />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: FOREGROUND }}>
                {mealTypeEmoji(meal.tipo_refeicao)} {mealTypeLabel(meal.tipo_refeicao)}
              </h1>
              <p style={{ fontSize: 13, color: MUTED }}>
                {formatDateTime(meal.data_hora)}
              </p>
            </div>
          </div>

          {editing ? (
            <button type="button" style={btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={toggleFavorite}
                style={{
                  background: "none", border: 0, cursor: "pointer", padding: 4, display: "flex",
                }}
                aria-label={meal.favorited ? "Desfavoritar" : "Favoritar"}
              >
                <Star style={{
                  width: 20, height: 20,
                  color: meal.favorited ? "#fbbf24" : MUTED,
                  fill: meal.favorited ? "#fbbf24" : "none",
                }} />
              </button>
              {meal.status_analise === "pendente" && (
                <button
                  type="button"
                  style={{ ...btnPrimary, background: "oklch(.22 .015 270 / .6)", color: PURPLE_HEX, border: `1px solid ${BORDER}` }}
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
                  Analisar
                </button>
              )}
              <button type="button" style={btnSm} onClick={() => setEditing(true)}>
                Editar
              </button>
              <button type="button" style={{ ...btnSm, color: RED, borderColor: "oklch(0.50 0.15 15 / 0.25)" }} onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}
        </div>

        {/* ── EDIT MODE ─────────────────────────────────────── */}
        {editing ? (
          <>
            {/* Photos */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              {displayPhotos.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {displayPhotos.map((p, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={p} alt={`Refeição ${i + 1}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12 }} />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          style={{
                            position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%",
                            background: "rgba(0,0,0,0.5)", border: 0, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <X style={{ width: 14, height: 14, color: "#fff" }} />
                        </button>
                      </div>
                    ))}
                    {displayPhotos.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          aspectRatio: "4/3", borderRadius: 12, border: `2px dashed ${BORDER}`,
                          background: "transparent", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                          fontFamily: "inherit", color: MUTED,
                        }}
                      >
                        <Plus style={{ width: 20, height: 20 }} />
                        <span style={{ fontSize: 10 }}>Adicionar</span>
                      </button>
                    )}
                  </div>
                  {displayPhotos.length < MAX_PHOTOS && (
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <button type="button" style={{ ...btnSm, fontSize: 11 }} onClick={() => cameraInputRef.current?.click()}>
                        <Camera style={{ width: 14, height: 14 }} /> Câmera
                      </button>
                      <button type="button" style={{ ...btnSm, fontSize: 11 }} onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon style={{ width: 14, height: 14 }} /> Galeria
                      </button>
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                    {displayPhotos.length} de {MAX_PHOTOS} fotos
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 48 }}>📸</div>
                  <p style={{ fontSize: 13, color: MUTED }}>Adicionar foto</p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button type="button" style={btnOutline} onClick={() => cameraInputRef.current?.click()}>
                      <Camera style={{ width: 16, height: 16 }} /> Câmera
                    </button>
                    <button type="button" style={btnOutline} onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon style={{ width: 16, height: 16 }} /> Galeria
                    </button>
                  </div>
                </div>
              )}
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handlePhotoAdd(e.target.files[0])} />
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]); e.target.value = ""; }} />

            {/* Tipo de refeição */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowTypePicker(!showTypePicker)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED,
                  background: "none", border: 0, cursor: "pointer", fontFamily: "inherit",
                  padding: 0,
                }}
              >
                {mealTypeEmoji(mealType)} {mealTypeLabel(mealType)}
                <span style={{ fontSize: 11, textDecoration: "underline" }}>Alterar tipo</span>
              </button>
              {showTypePicker && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MEAL_TYPES.map((mt) => (
                    <button
                      key={mt} type="button"
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

            {/* DateTime — fix horizontal overflow */}
            <div style={{ overflow: "hidden" }}>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                style={{
                  ...inputBase,
                  width: "100%", maxWidth: "100%", boxSizing: "border-box",
                  minWidth: 0, WebkitAppearance: "none",
                }}
              />
            </div>

            {/* Description */}
            <textarea
              placeholder="Descreva a refeição..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputBase, resize: "none", minHeight: 80 }}
            />

            {/* Itens */}
            <div style={cardStyle}>
              <p style={sectionTitle}>Itens</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((item, idx) => (
                  <span key={idx} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 9999, fontSize: 12,
                    background: "oklch(.22 .015 270 / .5)",
                  }}>
                    <input
                      value={item.nome}
                      onChange={(e) => updateItemName(idx, e.target.value)}
                      style={{
                        background: "transparent", border: "none", outline: "none",
                        width: 80, fontSize: 12, color: FOREGROUND, fontFamily: "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{
                        background: "none", border: 0, cursor: "pointer",
                        color: MUTED, padding: 0, display: "flex",
                      }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="Adicionar item"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  style={{
                    flex: 1, height: 32, borderRadius: 10, border: `1px solid ${BORDER}`,
                    background: "oklch(.18 .015 270 / .5)", color: FOREGROUND,
                    fontSize: 12, fontFamily: "inherit", padding: "0 12px", outline: "none",
                  }}
                />
                <button type="button" style={{ ...btnSm, flexShrink: 0 }} onClick={addItem}>
                  Adicionar
                </button>
              </div>
            </div>

            {/* Macros */}
            {macros && (
              <div style={cardStyle}>
                <p style={sectionTitle}>Macros</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                  {([
                    { key: "carboidratos_g", label: "Carboidratos", suffix: "g" },
                    { key: "proteinas_g", label: "Proteínas", suffix: "g" },
                    { key: "gorduras_g", label: "Gorduras", suffix: "g" },
                    { key: "calorias_kcal", label: "Calorias", suffix: " kcal" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderRadius: 10, padding: "8px 12px",
                      background: "oklch(.22 .015 270 / .3)",
                    }}>
                      <span style={mutedText}>{label}</span>
                      <input
                        type="number"
                        value={macros[key] ?? ""}
                        onChange={(e) => setMacros((prev) => prev ? { ...prev, [key]: Number(e.target.value) } : prev)}
                        style={{
                          width: 64, textAlign: "right", background: "transparent",
                          border: "none", outline: "none", fontSize: 13, fontWeight: 500,
                          color: FOREGROUND, fontFamily: "inherit",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classificação */}
            {classif && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: MUTED }}>Classificação:</span>
                {(() => {
                  const s = CLASSIFICATION_STYLE[classif] || CLASSIFICATION_STYLE.nao_identificada;
                  return (
                    <span style={{
                      display: "inline-flex", alignItems: "center", padding: "3px 10px",
                      borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: s.bg, color: s.text,
                    }}>
                      {classificationLabel(classif as Meal["classificacao"] & string)}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Cancel */}
            <button
              type="button"
              style={{ ...btnOutline, width: "100%", justifyContent: "center" }}
              onClick={() => {
                setEditing(false);
                if (meal) {
                  setMealType(meal.tipo_refeicao);
                  setDateTime(toDatetimeLocal(meal.data_hora));
                  setDescription(meal.texto_livre || "");
                  setPhotos([]);
                  setPhotoPaths(meal.fotos || []);
                  setItems(meal.itens || []);
                  setMacros(meal.macros);
                  setClassif(meal.classificacao);
                  setObs(meal.observacao || "");
                }
              }}
            >
              Cancelar
            </button>
          </>
        ) : (
          /* ── VIEW MODE ──────────────────────────────────── */
          <>
            {/* Photos */}
            {meal.fotos && meal.fotos.length > 0 && (
              <div style={{
                display: "grid", gap: 8,
                gridTemplateColumns: meal.fotos.length === 1 ? "1fr" : "1fr 1fr",
              }}>
                {meal.fotos.map((p, i) => {
                  const src = photoUrl(p);
                  return src ? (
                    <img key={i} src={src} alt={`Refeição ${i + 1}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 16 }} />
                  ) : null;
                })}
              </div>
            )}

            {/* Meal type + classification */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>{mealTypeEmoji(meal.tipo_refeicao)}</span>
              <span style={{ fontWeight: 500, color: FOREGROUND }}>{mealTypeLabel(meal.tipo_refeicao)}</span>
              {meal.classificacao && (
                (() => {
                  const s = CLASSIFICATION_STYLE[meal.classificacao] || CLASSIFICATION_STYLE.nao_identificada;
                  return (
                    <span style={{
                      display: "inline-flex", alignItems: "center", padding: "3px 10px",
                      borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: s.bg, color: s.text,
                    }}>
                      {classificationLabel(meal.classificacao)}
                    </span>
                  );
                })()
              )}
            </div>

            {/* Items */}
            {meal.itens && meal.itens.length > 0 && (
              <div style={cardStyle}>
                <p style={sectionTitle}>Itens</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {meal.itens.map((item, i) => (
                    <span key={i} style={{
                      padding: "4px 10px", borderRadius: 9999, fontSize: 12,
                      background: "oklch(.22 .015 270 / .5)", color: MUTED,
                    }}>
                      {item.nome}
                      {item.quantidade ? ` (${item.quantidade})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Macros */}
            {meal.macros && (
              <div style={cardStyle}>
                <p style={sectionTitle}>Macros</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, padding: "8px 12px", background: "oklch(.22 .015 270 / .3)" }}>
                    <span style={{ color: MUTED }}>Carboidratos</span>
                    <span style={{ fontWeight: 500, color: FOREGROUND }}>{meal.macros.carboidratos_g}g</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, padding: "8px 12px", background: "oklch(.22 .015 270 / .3)" }}>
                    <span style={{ color: MUTED }}>Proteínas</span>
                    <span style={{ fontWeight: 500, color: FOREGROUND }}>{meal.macros.proteinas_g}g</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, padding: "8px 12px", background: "oklch(.22 .015 270 / .3)" }}>
                    <span style={{ color: MUTED }}>Gorduras</span>
                    <span style={{ fontWeight: 500, color: FOREGROUND }}>{meal.macros.gorduras_g}g</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 10, padding: "8px 12px", background: "oklch(.22 .015 270 / .3)" }}>
                    <span style={{ color: MUTED }}>Calorias</span>
                    <span style={{ fontWeight: 500, color: FOREGROUND }}>{meal.macros.calorias_kcal} kcal</span>
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {meal.texto_livre && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {meal.texto_livre.split("\n").map((line, i) => (
                  <p key={i} style={{ color: "oklch(.95 0 0 / .9)", lineHeight: 1.6, fontSize: 14 }}>
                    {line || " "}
                  </p>
                ))}
              </div>
            )}

            {/* Observation */}
            {meal.observacao && (
              <p style={{
                fontSize: 13, color: MUTED, fontStyle: "italic",
                background: "oklch(.22 .015 270 / .3)", borderRadius: 12, padding: 12,
              }}>
                {meal.observacao}
              </p>
            )}

            {!meal.itens?.length && !meal.macros && !meal.texto_livre && (
              <p style={{ color: MUTED, fontStyle: "italic", textAlign: "center", padding: "32px 0" }}>
                Nenhum detalhe registrado
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ──────────────────────── */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 340, borderRadius: 20,
              background: "#151520", border: `1px solid ${BORDER}`,
              padding: 24, display: "flex", flexDirection: "column", gap: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 40 }}>🗑️</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: FOREGROUND, margin: "8px 0 4px" }}>
                Deletar refeição
              </h3>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                Tem certeza que deseja deletar esta refeição? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  border: `1px solid ${BORDER}`, background: "transparent",
                  color: FOREGROUND, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: 0,
                  background: "oklch(0.50 0.15 15)", color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", opacity: deleting ? 0.6 : 1,
                }}>
                {deleting ? "Deletando..." : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
