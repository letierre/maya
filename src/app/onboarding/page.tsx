"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { LANG_OPTIONS } from "@/lib/i18n";

const GENDER_OPTIONS = [
  { id: "masculino", label: "Masculino", emoji: "⚡" },
  { id: "feminino", label: "Feminino", emoji: "🌸" },
  { id: "nao_dizer", label: "Prefiro não dizer", emoji: "🌱" },
] as const;

const CONTEXT_QUESTIONS = [
  { id: "has_medication", qKey: "q_medicacao", dKey: "q_medicacao_desc" },
  { id: "has_faith", qKey: "q_fe", dKey: "q_fe_desc" },
  { id: "has_creative_hobby", qKey: "q_criatividade", dKey: "q_criatividade_desc" },
  { id: "track_suicidal_thoughts", qKey: "q_suicida", dKey: "q_suicida_desc", defaultVal: true },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, boolean>>({
    has_medication: false,
    has_faith: false,
    has_creative_hobby: false,
    track_suicidal_thoughts: true,
  });
  const [gender, setGender] = useState<string>("nao_dizer");
  const [language, setLanguage] = useState<string>("pt");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data.onboarding_completed) {
          router.push("/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);

  const toggle = (id: string) => {
    setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    setLoading(true);

    const enabled = [
      "felt_judged",
      "talked_to_someone",
      "meditation_prayer_breathing",
      "creative_activity",
      "ate_well",
      "bowel_movement",
      "exercise_walk",
      "drank_water",
      "slept_well",
      "did_something_enjoyable",
      "worked_on_goals",
    ];

    if (answers.has_medication) enabled.push("took_medication");
    if (answers.track_suicidal_thoughts) enabled.push("suicidal_thoughts");

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled_questions: enabled,
          context: { ...answers, gender, language },
          onboarding_completed: true,
        }),
      });

      if (!res.ok) {
        toast.error(t("erro_salvar"));
        setLoading(false);
        return;
      }

      toast.success(t("diario_personalizado"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("erro_salvar"));
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-start overflow-y-auto p-6 pt-10 pb-12 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl">🌱</div>
          <h1 className="text-2xl font-bold">{t("vamos_conhecer")}</h1>
          <p className="text-muted-foreground text-sm">{t("onboarding_subtitle")}</p>
        </div>

        {/* Language selector */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Idioma / Language</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLanguage(opt.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    language === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.flag} {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gender question */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("pergunta_genero")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t("genero_subtitle_onboarding")}
            </p>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGender(opt.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    gender === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {CONTEXT_QUESTIONS.map((q) => (
          <Card key={q.id} className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t(q.qKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{t(q.dKey)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle(q.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    answers[q.id]
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("sim")}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(q.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    !answers[q.id]
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t("nao")}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          size="lg"
          className="w-full rounded-xl"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? t("salvando") : t("comecar")}
        </Button>
      </div>
    </main>
  );
}
