"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/useTranslation";
import { getMealTypeFromHour, mealTypeLabel, mealTypeEmoji, classificationLabel, classificationColor } from "@/lib/meal-utils";
import { compressImage, uploadToCloud } from "@/lib/photo-storage";
import { ArrowLeft, Camera, ImageIcon, X, Plus, Trash2, Loader2 } from "lucide-react";
import type { MealType, MealItem, Macros, MealClassification } from "@/types";
import { toast } from "sonner";

const MEAL_TYPES: MealType[] = ["cafe_da_manha", "almoco", "lanche", "jantar", "lanche_noturno"];

type Stage = "capture" | "analyzing" | "results";

export default function RegistrarRefeicaoPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // --- Capture state ---
  const [photos, setPhotos] = useState<string[]>([]);     // base64 previews
  const [photoPaths, setPhotoPaths] = useState<string[]>([]); // cloud paths
  const MAX_PHOTOS = 3;
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType>(() => getMealTypeFromHour(new Date().getHours()));
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [dateTime, setDateTime] = useState(() => {
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

  // Salva refeição e inicia análise se tiver foto
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
          status_analise: photoPaths.length > 0 ? "pendente" : "pendente",
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

  // Edição de itens
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

  // Confirma resultados da análise e atualiza refeição
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

  // Salvar com texto livre (sem análise)
  const skipAnalysis = () => {
    router.push("/nutricao");
  };

  // --- Loading da análise ---
  if (stage === "analyzing") {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">{t("analisando")}</p>
        {photos.length > 0 && (
          <img src={photos[0]} alt="Refeição" className="w-48 h-36 object-cover rounded-xl opacity-50" />
        )}
      </div>
    );
  }

  // --- Resultados da análise (editável) ---
  if (stage === "results") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ArrowLeft className="size-5" />
          <h1 className="text-xl font-bold">{t("registrar_refeicao")}</h1>
        </div>

        {photos.length > 0 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 2)}, 1fr)` }}>
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`Refeição ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-2xl" />
            ))}
          </div>
        )}

        {/* Itens identificados */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{t("itens_identificados")}</p>
            <div className="flex flex-wrap gap-1.5">
              {analysisItems.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs">
                  <input
                    value={item.nome}
                    onChange={(e) => updateItemName(idx, e.target.value)}
                    className="bg-transparent border-none outline-none w-20 text-xs"
                  />
                  <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t("adicionar_item")}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                className="h-8 text-xs rounded-lg"
              />
              <Button size="icon" variant="outline" className="size-8 rounded-lg shrink-0" onClick={addItem}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Macros */}
        {analysisMacros && (
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">{t("macros_estimados")}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(["carboidratos", "proteinas", "gorduras", "calorias"] as const).map((key) => {
                  const labelMap = { carboidratos: t("carboidratos"), proteinas: t("proteinas"), gorduras: t("gorduras"), calorias: t("calorias") };
                  const suffix = key === "calorias" ? " kcal" : "g";
                  const dbKey = key === "calorias" ? "calorias_kcal" : `${key}_g` as keyof Macros;
                  return (
                    <div key={key} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">{labelMap[key]}</span>
                      <span className="font-medium">{analysisMacros[dbKey]}{suffix}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classificação */}
        {analysisClass && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Classificação:</span>
            <Badge className={classificationColor(analysisClass)}>
              {t(analysisClass)}
            </Badge>
          </div>
        )}

        {/* Ações */}
        <div className="space-y-3">
          <Button className="w-full rounded-xl" onClick={confirmAnalysis} disabled={saving}>
            {saving ? t("salvando") : "Confirmar e salvar"}
          </Button>
          <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={skipAnalysis}>
            {t("salvar_sem_analise")}
          </Button>
        </div>
      </div>
    );
  }

  // --- Captura ---
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="size-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors -ml-1"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold">{t("registrar_refeicao")}</h1>
      </div>

      {/* Fotos (até 3) */}
      <Card className="rounded-2xl overflow-hidden">
        {photos.length > 0 ? (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt={`Refeição ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-2 right-2 size-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {/* Slot vazio para adicionar mais */}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground"
                >
                  <Plus className="size-5" />
                  <span className="text-[10px]">Adicionar</span>
                </button>
              )}
            </div>
            {photos.length < MAX_PHOTOS && (
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="size-3.5" /> Câmera
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="size-3.5" /> Galeria
                </Button>
              </div>
            )}
            <p className="text-[11px] text-center text-muted-foreground">
              {photos.length} de {MAX_PHOTOS} fotos
            </p>
          </div>
        ) : (
          <CardContent className="py-12 text-center space-y-4">
            <div className="text-5xl">📸</div>
            <p className="text-sm text-muted-foreground">{t("foto_refeicao")}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="size-4" /> Câmera
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="size-4" /> Galeria
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />

      {/* Tipo de refeição */}
      <div className="space-y-2">
        <button type="button" onClick={() => setShowTypePicker(!showTypePicker)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          {mealTypeEmoji(mealType)} {mealTypeLabel(mealType)}
          <span className="text-xs underline">{t("editar_tipo")}</span>
        </button>
        {showTypePicker && (
          <div className="flex gap-1.5 flex-wrap">
            {MEAL_TYPES.map((mt) => (
              <button
                key={mt} type="button"
                onClick={() => { setMealType(mt); setShowTypePicker(false); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mt === mealType ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
              >
                {mealTypeEmoji(mt)} {mealTypeLabel(mt)}
              </button>
            ))}
          </div>
        )}
      </div>

      <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="w-full rounded-xl border border-border bg-muted/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />

      <Textarea placeholder={t("descrever_refeicao")} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="resize-none rounded-xl" />

      {photos.length === 0 && (
        <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={handleSave} disabled={saving}>
          {t("adicionar_sem_foto")}
        </Button>
      )}

      <Button className="w-full rounded-xl" size="lg" onClick={handleSave} disabled={saving}>
        {saving ? t("salvando") : t("salvar")}
      </Button>
    </div>
  );
}
