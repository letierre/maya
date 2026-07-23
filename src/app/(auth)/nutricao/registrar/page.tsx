"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/useTranslation";
import { getMealTypeFromHour, mealTypeLabel, mealTypeEmoji } from "@/lib/meal-utils";
import { compressImage, uploadToCloud } from "@/lib/photo-storage";
import { Camera, ImageIcon, X, Plus, Check, ChevronLeft, ChevronDown, Sparkles } from "lucide-react";
import type { MealType, MealItem, Macros, MealClassification } from "@/types";
import { toast } from "sonner";

const HUE = 30;
const MEAL_TYPES: MealType[] = ["cafe_da_manha", "almoco", "lanche", "jantar", "lanche_noturno"];

type Stage = "capture" | "analyzing" | "results";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const days = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} · ${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} · ${hh}:${mm}`;
}

function MacroTile({ label, value, hue }: { label: string; value: string | number; hue: number }) {
  return (
    <div
      className="rounded-2xl text-center border"
      style={{
        padding: "11px 8px",
        background: `linear-gradient(180deg, #fff, oklch(.97 .025 ${hue}))`,
        borderColor: `oklch(.5 .12 ${hue} / .15)`,
        boxShadow: "0 1px 2px oklch(.25 .02 270 / .04)",
      }}
    >
      <p
        className="m-0 text-lg font-extrabold tracking-tight leading-none tabular-nums"
        style={{ color: `oklch(.32 .14 ${hue})` }}
      >
        {value}
      </p>
      <p
        className="m-0 mt-1 text-[9.5px] font-bold tracking-wider uppercase"
        style={{ color: `oklch(.5 .12 ${hue})` }}
      >
        {label}
      </p>
    </div>
  );
}

const CLASSIFICATION_MAP: Record<string, { hue: number; emoji: string; label: string }> = {
  equilibrada:      { hue: 145, emoji: "✓",  label: "Equilibrada" },
  rica_em_proteina: { hue: 220, emoji: "💪", label: "Rica em proteína" },
  rica_em_carbo:    { hue: 85,  emoji: "🌾", label: "Rica em carboidrato" },
  leve:             { hue: 180, emoji: "🍃", label: "Leve" },
  pesada:           { hue: 30,  emoji: "🔥", label: "Pesada" },
  ultraprocessada:  { hue: 15,  emoji: "⚠️", label: "Ultraprocessada" },
  nao_identificada: { hue: 200, emoji: "❓", label: "Não identificada" },
};

export default function RegistrarRefeicaoPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // --- Capture state ---
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const MAX_PHOTOS = 3;
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
  const [newItemName, setNewItemName] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const handleFile = async (file: File) => {
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos por refeição`);
      return;
    }
    try {
      const compressed = await compressImage(file);
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
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("refeicao_atualizada"));
      router.push("/nutricao");
    } catch {
      toast.error(t("erro_salvar_refeicao"));
    } finally {
      setSaving(false);
    }
  };

  const skipAnalysis = () => router.push("/nutricao");

  const classInfo = analysisClass ? (CLASSIFICATION_MAP[analysisClass] ?? CLASSIFICATION_MAP.nao_identificada) : null;

  return (
    <div
      className="relative min-h-screen pb-28"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.58 .18 270 / .15) 0%, transparent 60%),
          linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
        `,
      }}
    >
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />

      {/* Floating back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-3.5 left-4 z-10 w-9 h-9 rounded-full flex items-center justify-center border-0"
        style={{ background: "oklch(.16 .012 270 / .65)", backdropFilter: "blur(12px)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="px-5 pt-16 pb-1">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Nutrição
        </p>
        <h1 className="mt-1 text-[30px] font-bold tracking-tight leading-[1.05]">
          {stage === "results" ? "Sua refeição" : "Nova refeição"}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
          {formatDateTime(dateTime)}
        </p>
      </div>

      {/* Meal type chip */}
      <div className="px-5 pt-3.5">
        <button
          onClick={() => setShowTypePicker(!showTypePicker)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 pl-2 rounded-full cursor-pointer border text-xs font-bold"
          style={{
            background: `oklch(.95 .04 ${HUE})`,
            borderColor: `oklch(.5 .14 ${HUE} / .2)`,
            color: `oklch(.32 .14 ${HUE})`,
          }}
        >
          <span className="text-base leading-none">{mealTypeEmoji(mealType)}</span>
          {mealTypeLabel(mealType)}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>

        {showTypePicker && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt}
                onClick={() => { setMealType(mt); setShowTypePicker(false); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${mt === mealType ? "bg-primary text-primary-foreground" : "bg-white/70 hover:bg-white"}`}
              >
                {mealTypeEmoji(mt)} {mealTypeLabel(mt)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── STAGE: capture ── */}
      {stage === "capture" && (
        <>
          {/* Hero photo */}
          <div className="px-3.5 pt-4">
            {photos.length === 0 ? (
              <div
                className="aspect-[4/3] rounded-[22px] relative overflow-hidden border-[1.5px] border-dashed
                           flex flex-col items-center justify-center cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, oklch(.95 .04 ${HUE}) 0%, oklch(.88 .08 ${HUE}) 100%)`,
                  borderColor: `oklch(.5 .14 ${HUE} / .4)`,
                }}
                onClick={() => cameraInputRef.current?.click()}
              >
                <div
                  className="absolute -right-5 -top-5 w-36 h-36 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, oklch(.5 .14 ${HUE} / .12), transparent 70%)` }}
                />
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-white"
                  style={{
                    background: `oklch(.5 .14 ${HUE})`,
                    boxShadow: `0 8px 24px -8px oklch(.5 .14 ${HUE} / .5)`,
                  }}
                >
                  <Camera className="w-7 h-7" strokeWidth={1.7} />
                </div>
                <p className="m-0 text-base font-bold tracking-tight" style={{ color: `oklch(.2 .04 ${HUE})` }}>
                  Tire uma foto
                </p>
                <p className="m-0 mt-1 text-xs text-center max-w-[220px]" style={{ color: `oklch(.42 .08 ${HUE})` }}>
                  A Maya identifica os ingredientes e estima os macros automaticamente
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                    className="px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold
                               inline-flex items-center gap-1.5 shadow-sm"
                    style={{ color: `oklch(.32 .14 ${HUE})` }}
                  >
                    <Camera className="w-3.5 h-3.5" /> Câmera
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="px-3.5 py-2 rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold
                               inline-flex items-center gap-1.5 shadow-sm"
                    style={{ color: `oklch(.32 .14 ${HUE})` }}
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Galeria
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                      <img src={p} alt={`Refeição ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/55 text-white
                                   flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[4/3] rounded-2xl border-[1.5px] border-dashed
                                 flex flex-col items-center justify-center gap-1 text-muted-foreground"
                      style={{ borderColor: `oklch(.5 .14 ${HUE} / .4)` }}
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[10px]">Adicionar</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-center text-muted-foreground mt-2">
                  {photos.length} de {MAX_PHOTOS} fotos
                </p>
              </>
            )}
          </div>

          {/* OR divider */}
          <div className="px-6 pt-5 flex items-center gap-2.5">
            <span className="flex-1 h-px" style={{ background: "oklch(.58 .18 270 / .15)" }} />
            <span className="text-[10px] font-bold tracking-[.16em] text-muted-foreground">OU DESCREVA</span>
            <span className="flex-1 h-px" style={{ background: "oklch(.58 .18 270 / .15)" }} />
          </div>

          {/* Description contenteditable */}
          <div className="px-6 pt-4">
            <div
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              onInput={(e) => setDescription((e.target as HTMLElement).innerText)}
              data-placeholder="Ex: salada com frango grelhado, arroz integral e abacate…"
              className="outline-none text-base leading-[1.55] font-medium tracking-tight
                         min-h-[60px] text-foreground
                         empty:before:content-[attr(data-placeholder)] empty:before:text-foreground/35"
            />
          </div>

          {/* Sticky save bar */}
          <div
            className="absolute bottom-0 inset-x-0 px-4 py-3 flex items-center gap-2.5"
            style={{
              background: `linear-gradient(180deg, transparent, oklch(.12 .012 270 / .85) 25%, oklch(.12 .012 270))`,
            }}
          >
            <span className="flex-1 text-[11px] text-muted-foreground font-mono">
              {photos.length > 0 && `${photos.length} foto${photos.length > 1 ? "s" : ""}`}
              {photos.length > 0 && description.trim() && " · "}
              {description.trim() && "1 descrição"}
              {!photos.length && !description.trim() && "Adicione foto ou descrição"}
            </span>
            <Button
              onClick={handleSave}
              disabled={saving || (!photos.length && !description.trim())}
              className="h-12 px-[22px] rounded-2xl text-sm font-semibold gap-1.5 border-0"
              style={{
                background: `oklch(.5 .14 ${HUE})`,
                boxShadow: `0 4px 14px -4px oklch(.5 .14 ${HUE} / .5)`,
              }}
            >
              {photos.length > 0 ? "Analisar" : "Salvar"}
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      )}

      {/* ── STAGE: analyzing ── */}
      {stage === "analyzing" && (
        <div className="px-6 pt-7">
          <div
            className="aspect-[4/3] rounded-[22px] overflow-hidden relative flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, oklch(.88 .08 ${HUE}) 0%, oklch(.75 .15 ${HUE}) 100%)`,
            }}
          >
            {photos[0] && (
              <img
                src={photos[0]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
                style={{ filter: "blur(8px) saturate(1.3)" }}
              />
            )}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / .35) 50%, transparent 100%)",
                animation: "shimmer 1.6s linear infinite",
              }}
            />
            <div className="relative text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-3 bg-white/90 backdrop-blur-md
                           flex items-center justify-center shadow-lg overflow-hidden"
              >
                <img
                  src="/Maya.png"
                  alt="Maya"
                  className="w-7 h-7 rounded-full object-cover border-2 border-white"
                  style={{ animation: "mealAnalyzePulse 2s ease-in-out infinite" }}
                />
              </div>
              <p
                className="m-0 text-sm font-semibold tracking-tight text-white"
                style={{ textShadow: "0 1px 4px oklch(.25 .02 270 / .35)" }}
              >
                Maya está olhando…
              </p>
            </div>
          </div>

          <p className="mt-5 text-[13px] text-center italic text-muted-foreground">
            Identificando ingredientes e estimando os macros
          </p>

          <div className="mt-6 grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl"
                style={{
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
        <>
          {/* Photo */}
          {photos.length > 0 && (
            <div className="px-3.5 pt-3.5">
              <div className="aspect-[4/3] rounded-[22px] overflow-hidden relative">
                <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                <span
                  className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold
                             tracking-[.08em] uppercase text-white inline-flex items-center gap-1"
                  style={{ background: "oklch(.58 .18 270)" }}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" /> Analisado
                </span>
              </div>
            </div>
          )}

          {/* Macro tiles */}
          <div className="px-3.5 pt-5">
            <p
              className="m-0 mb-2.5 ml-1.5 text-[10.5px] font-bold tracking-[.14em] uppercase"
              style={{ color: `oklch(.45 .14 ${HUE})` }}
            >
              Macros estimados
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <MacroTile label="Kcal" value={analysisMacros?.calorias_kcal ?? "—"} hue={30} />
              <MacroTile label="Carb" value={analysisMacros?.carboidratos_g != null ? `${analysisMacros.carboidratos_g}g` : "—"} hue={85} />
              <MacroTile label="Prot" value={analysisMacros?.proteinas_g != null ? `${analysisMacros.proteinas_g}g` : "—"} hue={220} />
              <MacroTile label="Gord" value={analysisMacros?.gorduras_g != null ? `${analysisMacros.gorduras_g}g` : "—"} hue={270} />
            </div>
          </div>

          {/* Items chips */}
          <div className="px-6 pt-6">
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="m-0 text-[10.5px] font-bold tracking-[.14em] uppercase text-muted-foreground">
                Identificados
              </p>
              <span className="text-[11px] text-muted-foreground">
                {analysisItems.length} {analysisItems.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysisItems.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full bg-white border text-[12.5px] font-medium"
                  style={{ borderColor: `oklch(.5 .14 ${HUE} / .15)` }}
                >
                  <input
                    value={item.nome}
                    onChange={(e) => updateItemName(idx, e.target.value)}
                    className="bg-transparent border-none outline-none text-[12.5px]"
                    style={{ minWidth: 60, width: `${Math.max(60, item.nome.length * 8)}px` }}
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(.58 .18 270 / .1)" }}
                  >
                    <X className="w-[9px] h-[9px] text-muted-foreground" />
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
                  className="px-3 py-1.5 rounded-full bg-white border outline-none text-[12.5px]"
                  style={{ borderColor: `oklch(.5 .14 ${HUE} / .35)` }}
                />
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="px-2.5 py-1.5 rounded-full border-[1.5px] border-dashed cursor-pointer
                             inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ borderColor: `oklch(.5 .14 ${HUE} / .35)`, color: `oklch(.42 .14 ${HUE})` }}
                >
                  <Plus className="w-2.5 h-2.5" /> Adicionar
                </button>
              )}
            </div>
          </div>

          {/* Classification badge */}
          {classInfo && (
            <div className="px-6 pt-5">
              <p className="m-0 mb-2 text-[10.5px] font-bold tracking-[.14em] uppercase text-muted-foreground">
                Classificação
              </p>
              <div
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border"
                style={{
                  background: `oklch(.93 .08 ${classInfo.hue})`,
                  borderColor: `oklch(.45 .14 ${classInfo.hue} / .25)`,
                }}
              >
                <span className="text-sm">{classInfo.emoji}</span>
                <span className="text-[13px] font-semibold" style={{ color: `oklch(.32 .14 ${classInfo.hue})` }}>
                  {classInfo.label}
                </span>
              </div>
              {analysisObs && (
                <p className="mt-2 text-[12px] text-muted-foreground leading-[1.45] italic">
                  {analysisObs}
                </p>
              )}
            </div>
          )}

          {/* Sticky dual bar */}
          <div
            className="absolute bottom-0 inset-x-0 px-4 py-3 flex items-center gap-2"
            style={{
              background: `linear-gradient(180deg, transparent, oklch(.12 .012 270 / .85) 25%, oklch(.12 .012 270))`,
            }}
          >
            <button
              onClick={skipAnalysis}
              className="h-11 px-3.5 rounded-xl bg-transparent border text-xs font-semibold text-muted-foreground flex-shrink-0"
              style={{ borderColor: "oklch(.28 .02 270 / .5)" }}
            >
              Salvar sem análise
            </button>
            <Button
              onClick={confirmAnalysis}
              disabled={saving}
              className="flex-1 h-[46px] rounded-2xl text-sm font-semibold gap-1.5 border-0"
              style={{
                background: `oklch(.5 .14 ${HUE})`,
                boxShadow: `0 4px 14px -4px oklch(.5 .14 ${HUE} / .5)`,
              }}
            >
              {saving ? "Salvando..." : "Confirmar e salvar"}
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
