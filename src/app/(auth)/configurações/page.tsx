"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";

const CONTEXT_QUESTIONS = [
  { id: "has_medication",          qKey: "q_medicacao",   dKey: "q_medicacao_desc"   },
  { id: "has_faith",               qKey: "q_fe",          dKey: "q_fe_desc"          },
  { id: "has_creative_hobby",      qKey: "q_criatividade", dKey: "q_criatividade_desc" },
  { id: "track_suicidal_thoughts", qKey: "q_suicida",     dKey: "q_suicida_desc"     },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { t }  = useTranslation();

  const [answers,  setAnswers]  = useState<Record<string, boolean>>({});
  const [loading,  setLoading]  = useState(true);

  const userEdited = useRef(false);
  const autoSaveRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        const ctx = data.context || {};
        setAnswers({
          has_medication: false,
          has_faith: false,
          has_creative_hobby: false,
          track_suicidal_thoughts: true,
          ...ctx,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    userEdited.current = true;
    setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!userEdited.current) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const enabled = [
        "felt_judged", "talked_to_someone", "meditation", "breathing",
        "creative_activity", "ate_well", "bowel_movement",
        "walked", "ran", "strength_training",
        "drank_water", "slept_well", "did_something_enjoyable", "worked_on_goals",
      ];
      if (answers.has_medication)          enabled.push("took_medication");
      if (answers.has_faith)               enabled.push("prayer");
      if (answers.track_suicidal_thoughts) enabled.push("suicidal_thoughts");
      try {
        const res = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled_questions: enabled, context: { ...answers } }),
        });
        if (res.ok) toast.success("Alterações salvas");
      } catch { /* silent */ }
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [answers]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "oklch(0.12 0.012 270)",
      }}>
        <p style={{ color: "#A78BFA", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "oklch(0.12 0.012 270)",
      fontFamily: "var(--font-sans)",
      color: "#e0d6ff",
      paddingBottom: 100,
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "32px 0 24px",
        }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid rgba(167,139,250,0.3)",
              background: "rgba(124,92,255,0.12)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0, color: "#A78BFA",
            }}
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: "#e0d6ff" }}>
              {t("config_title")}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#9e96b5" }}>
              {t("config_subtitle")}
            </p>
          </div>
        </div>

        {/* Context questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CONTEXT_QUESTIONS.map((q) => (
            <div key={q.id} style={{
              background: "oklch(0.16 0.012 270 / 0.7)",
              borderRadius: 20,
              border: "1px solid rgba(167,139,250,0.25)",
              padding: "18px 18px 16px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>
                {t(q.qKey)}
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#9e96b5", lineHeight: 1.5 }}>
                {t(q.dKey)}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { if (!answers[q.id]) toggle(q.id); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 11, border: 0,
                    cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, fontWeight: 700,
                    transition: "all .15s ease",
                    background: answers[q.id] ? "#7C5CFF" : "#1e1840",
                    color: answers[q.id] ? "#fff" : "#7C5CFF",
                  }}
                >
                  {t("sim")}
                </button>
                <button
                  type="button"
                  onClick={() => { if (answers[q.id]) toggle(q.id); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 11, border: 0,
                    cursor: "pointer", fontFamily: "inherit",
                    fontSize: 13, fontWeight: 700,
                    transition: "all .15s ease",
                    background: !answers[q.id] ? "#FF5C5C" : "#1e1840",
                    color: !answers[q.id] ? "#fff" : "#7C5CFF",
                  }}
                >
                  {t("nao")}
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
