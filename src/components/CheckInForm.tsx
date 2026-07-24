"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { getLocalDate } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { ateWellFromMeals, sumMacros } from "@/lib/meal-utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { Camera, X } from "lucide-react";
import type { CheckIn, Meal } from "@/types";

const MAX_GRATITUDE_PHOTOS = 5;

type FormData = Omit<CheckIn, "id" | "user_id" | "created_at" | "updated_at">;

interface CheckInFormProps {
  existingCheckIn?: CheckIn | null;
}

const QUESTION_EMOJI: Record<string, string> = {
  exercise_walk: "🏃",
  drank_water: "💧",
  slept_well: "😴",
  took_medication: "💊",
  meditation_prayer_breathing: "🧘",
  talked_to_someone: "🗣️",
  did_something_enjoyable: "😊",
  worked_on_goals: "🎯",
  creative_activity: "🎨",
  bowel_movement: "🚽",
  felt_judged: "⚖️",
  suicidal_thoughts: "⚠️",
};

const QUESTION_HINT_KEY: Record<string, string> = {
  exercise_walk: "q_exercicio_hint",
  drank_water: "q_agua_hint",
  slept_well: "q_dormiu_hint",
  took_medication: "q_remedios_hint",
  meditation_prayer_breathing: "q_meditacao_hint",
  talked_to_someone: "q_conversou_hint",
  did_something_enjoyable: "q_gostou_hint",
  worked_on_goals: "q_metas_hint",
  creative_activity: "q_criatividade_hint",
  bowel_movement: "q_coco_hint",
};

function getQuestionLabel(key: string, ctx: Record<string, boolean>, t: (k: string) => string): string {
  if (key === "meditation_prayer_breathing") {
    return ctx.has_faith ? t("q_meditacao_fe") : t("q_meditacao");
  }
  if (key === "creative_activity") {
    return ctx.has_creative_hobby ? t("q_criatividade_hobby") : t("q_criatividade_geral");
  }
  const labelMap: Record<string, string> = {
    felt_judged: "q_julgada",
    took_medication: "q_remedios",
    talked_to_someone: "q_conversou",
    ate_well: "q_comeu_bem",
    bowel_movement: "q_coco",
    exercise_walk: "q_exercicio",
    drank_water: "q_agua",
    slept_well: "q_dormiu",
    suicidal_thoughts: "q_suicida_label",
    did_something_enjoyable: "q_gostou",
    worked_on_goals: "q_metas",
  };
  const k = labelMap[key];
  return k ? t(k) : key;
}

export function CheckInForm({ existingCheckIn }: CheckInFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean>>({});
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [mealsLoaded, setMealsLoaded] = useState(false);
  const [form, setForm] = useState<FormData>({
    date: getLocalDate(),
    felt_judged: false,
    took_medication: false,
    talked_to_someone: false,
    meditation_prayer_breathing: false,
    creative_activity: false,
    ate_well: false,
    bowel_movement: false,
    exercise_walk: false,
    drank_water: false,
    slept_well: false,
    suicidal_thoughts: false,
    did_something_enjoyable: false,
    worked_on_goals: false,
    feeling: "",
    mood_tags: [] as string[],
    gratitude: "",
    gratitude_photos: [] as string[],
  });

  useEffect(() => {
    fetch("/api/preferences")
      .then((res) => res.json())
      .then((data) => {
        setEnabledKeys(data.enabled_questions || []);
        setContext(data.context || {});
      })
      .catch(() => {});

    const today = getLocalDate();
    fetch(`/api/meals?date=${today}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTodayMeals(data);
        setMealsLoaded(true);
      })
      .catch(() => setMealsLoaded(true));
  }, []);

  useEffect(() => {
    if (existingCheckIn) {
      setForm({
        date: existingCheckIn.date,
        felt_judged: existingCheckIn.felt_judged,
        took_medication: existingCheckIn.took_medication,
        talked_to_someone: existingCheckIn.talked_to_someone,
        meditation_prayer_breathing: existingCheckIn.meditation_prayer_breathing,
        creative_activity: existingCheckIn.creative_activity,
        ate_well: existingCheckIn.ate_well,
        bowel_movement: existingCheckIn.bowel_movement,
        exercise_walk: existingCheckIn.exercise_walk,
        drank_water: existingCheckIn.drank_water,
        slept_well: existingCheckIn.slept_well,
        suicidal_thoughts: existingCheckIn.suicidal_thoughts,
        did_something_enjoyable: existingCheckIn.did_something_enjoyable,
        worked_on_goals: existingCheckIn.worked_on_goals,
        feeling: existingCheckIn.feeling,
        mood_tags: existingCheckIn.mood_tags ?? [],
        gratitude: existingCheckIn.gratitude,
        gratitude_photos: existingCheckIn.gratitude_photos || [],
      });
    }
  }, [existingCheckIn]);

  const isFirstRender = useRef(true);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  const autoSave = useCallback(async (data: FormData) => {
    try {
      const res = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) setSaved(true);
    } catch {
      // silent fail on auto-save
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaved(false);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => autoSave(form), 1500);
    return () => clearTimeout(autoSaveRef.current);
  }, [form, autoSave]);

  const gratitudePhotoRef = useRef<HTMLInputElement>(null);

  const handleCheck = (key: keyof FormData, checked: boolean) => {
    setForm((prev) => ({ ...prev, [key]: checked }));
  };

  const handleGratitudePhotoAdd = async (file: File) => {
    if (form.gratitude_photos.length >= MAX_GRATITUDE_PHOTOS) {
      toast.error(`Máximo de ${MAX_GRATITUDE_PHOTOS} fotos`);
      return;
    }
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "meals");
      setForm((prev) => ({ ...prev, gratitude_photos: [...prev.gratitude_photos, path] }));
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const removeGratitudePhoto = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      gratitude_photos: prev.gratitude_photos.filter((_, i) => i !== idx),
    }));
  };

  // Auto-calcula "ate_well" baseado nas refeições do dia (background, sem UI interativa)
  useEffect(() => {
    if (!mealsLoaded || todayMeals.length === 0) return;
    const calculated = ateWellFromMeals(todayMeals);
    if (!existingCheckIn || existingCheckIn.ate_well !== calculated) {
      setForm((prev) => ({ ...prev, ate_well: calculated }));
    }
  }, [mealsLoaded, todayMeals, existingCheckIn]);

  // Filtra ate_well das perguntas visíveis — é auto-calculado, não interativo
  const visibleKeys = enabledKeys.filter((k) => k !== "ate_well");

  const activeQuestions = visibleKeys.map((key) => ({
    key,
    label: getQuestionLabel(key, context, t),
    emoji: QUESTION_EMOJI[key] || "•",
    hintKey: QUESTION_HINT_KEY[key],
  }));

  const score = enabledKeys.filter(
    (q) => q !== "suicidal_thoughts" && q !== "felt_judged" && form[q as keyof FormData] === true
  ).length;
  const total = enabledKeys.filter((q) => q !== "suicidal_thoughts" && q !== "felt_judged").length;

  // Dados de refeição para o card informativo (passivo, sem interação)
  const analyzedMeals = todayMeals.filter((m) => m.macros && m.status_analise === "analisado");
  const mealsTotal = sumMacros(analyzedMeals);
  const hasMealData = analyzedMeals.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.suicidal_thoughts) {
      toast.warning(t("cvv_warning"));
    }

    setLoading(true);

    const res = await fetch("/api/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      toast.error(t("erro_salvar"));
      setLoading(false);
      return;
    }

    toast.success(
      existingCheckIn
        ? t("checkin_atualizado")
        : `${t("checkin_registrado")} Você marcou ${score} de ${total} hábitos positivos. 🌱`
    );

    fetch("/api/achievements", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.new_achievements?.length > 0) {
          data.new_achievements.forEach((a: { icon: string; label: string }) => {
            toast.success(`${a.icon} ${a.label} ${t("desbloqueado")}`, {
              duration: 4000,
            });
          });
        }
      })
      .catch(() => {});

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Maya caption */}
      <p className="text-center text-xs text-muted-foreground">
        Atualiza aqui. Maya absorve tudo.
      </p>

      {/* 1. Sentimento primeiro */}
      <Card className="rounded-2xl" style={{ background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg" style={{ color: "#e0d6ff" }}>💬 Como está seu coração hoje?</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="feeling"
            placeholder="Escreva como você está se sentindo... use suas próprias palavras"
            rows={3}
            value={form.feeling}
            onChange={(e) => setForm((prev) => ({ ...prev, feeling: e.target.value }))}
            className="resize-none rounded-xl"
            style={{ background: "#0F0F14", border: "1px solid rgba(167,139,250,0.25)", color: "#e0d6ff", fontSize: 15, lineHeight: 1.6 }}
          />
        </CardContent>
      </Card>

      {/* 2. Hábitos */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {t("seus_habitos")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("nenhuma_pergunta")}{" "}
              <a href="/configurações" className="text-primary underline">
                {t("configure_diario")}
              </a>
            </p>
          ) : (
            activeQuestions.map((q) => {
              const value = form[q.key as keyof FormData];
              const isSuicidal = q.key === "suicidal_thoughts";

              // Para pensamento suicida, SIM = vermelho (alerta) e NÃO = verde (conquista)
              const cardBg = isSuicidal
                ? (value === true
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    : value === false
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : "bg-muted/30 border-transparent")
                : (value === true
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : value === false
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "bg-muted/30 border-transparent");

              const cardBorder = `${cardBg} border`;

              return (
                <div key={q.key} className={`p-3.5 rounded-xl ${cardBorder}`}>
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <span className="text-lg leading-none mt-0.5">{q.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          isSuicidal
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "font-medium"
                        }`}
                      >
                        {q.label}
                      </p>
                      {q.hintKey && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t(q.hintKey)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCheck(q.key as keyof FormData, true)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        value === true
                          ? isSuicidal
                            ? "bg-red-500 text-white"
                            : "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                      }`}
                    >
                      ✓ {t("sim")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheck(q.key as keyof FormData, false)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        value === false
                          ? isSuicidal
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-amber-100 dark:hover:bg-amber-950/50"
                      }`}
                    >
                      ✗ {t("nao")}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Card informativo de refeições (passivo, sem interação) */}
          {hasMealData && (
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-start gap-2.5 mb-2">
                <span className="text-lg leading-none">🍽️</span>
                <div>
                  <p className="text-sm font-medium">{t("comeu_bem_auto", { n: String(analyzedMeals.length) })}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{mealsTotal.calorias_kcal} kcal</span>
                    <span>C: {mealsTotal.carboidratos_g}g</span>
                    <span>P: {mealsTotal.proteinas_g}g</span>
                    <span>G: {mealsTotal.gorduras_g}g</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/nutricao")}
                className="text-xs text-primary underline hover:opacity-80"
              >
                {t("ver_refeicoes")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Reflexão rápida */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">💭 Reflexão rápida</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Como foi seu dia?"
            rows={2}
            value={""}
            onChange={() => {}}
            className="resize-none rounded-xl"
          />
        </CardContent>
      </Card>

      {/* 4. Gratidão */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">🙏 {t("gratidao_momento")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Textarea
              id="gratitude"
              placeholder={t("gratidao_placeholder")}
              rows={2}
              value={form.gratitude}
              onChange={(e) => setForm((prev) => ({ ...prev, gratitude: e.target.value }))}
              className="resize-none rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => gratitudePhotoRef.current?.click()}
              className="absolute bottom-2 right-2 size-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors text-muted-foreground"
              aria-label={t("adicionar_foto")}
            >
              <Camera className="size-3.5" />
            </button>
            <input
              ref={gratitudePhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleGratitudePhotoAdd(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          {form.gratitude_photos.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {form.gratitude_photos.map((path, i) => {
                const src = photoUrl(path);
                return src ? (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGratitudePhoto(i)}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : null;
              })}
              {form.gratitude_photos.length < MAX_GRATITUDE_PHOTOS && (
                <button
                  type="button"
                  onClick={() => gratitudePhotoRef.current?.click()}
                  className="aspect-square rounded-lg border border-dashed border-border hover:bg-muted/30 transition-colors flex items-center justify-center text-muted-foreground"
                >
                  <Camera className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Save */}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="flex-1 rounded-xl" disabled={loading}>
          {loading
            ? t("salvando")
            : existingCheckIn
            ? t("atualizar_checkin")
            : t("salvar_checkin")}
        </Button>
        {saved && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {t("salvo_automaticamente")} ✓
          </span>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground -mt-3">
        Maya vai conectar os pontos.
      </p>
    </form>
  );
}
