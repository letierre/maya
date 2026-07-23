"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";

const CURRENCIES = [
  { code: "BRL", label: "Real (R$)" },
  { code: "USD", label: "Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "Pound (£)" },
  { code: "ARS", label: "Peso AR" },
  { code: "CLP", label: "Peso CL" },
  { code: "MXN", label: "Peso MX" },
];

const CONTEXT_QUESTIONS = [
  { id: "has_medication",          qKey: "q_medicacao",   dKey: "q_medicacao_desc"   },
  { id: "has_faith",               qKey: "q_fe",          dKey: "q_fe_desc"          },
  { id: "has_creative_hobby",      qKey: "q_criatividade", dKey: "q_criatividade_desc" },
  { id: "track_suicidal_thoughts", qKey: "q_suicida",     dKey: "q_suicida_desc"     },
];

const P  = "#7C5CFF";
const PL = "oklch(0.24 0.05 272)";
const PB = "1px solid oklch(0.32 0.06 272 / 0.6)";

const cardBg = "oklch(0.18 0.035 272 / 0.95)";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { t }  = useTranslation();

  const [answers,  setAnswers]  = useState<Record<string, boolean>>({});
  const [currency, setCurrencyState] = useState("BRL");
  const [loading,  setLoading]  = useState(true);
  const [saved,    setSaved]    = useState(false);

  const isFirstRender = useRef(true);
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
        if (ctx.currency) setCurrencyState(ctx.currency);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSaved(false);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const enabled = [
        "felt_judged", "talked_to_someone", "meditation_prayer_breathing",
        "creative_activity", "ate_well", "bowel_movement", "exercise_walk",
        "drank_water", "slept_well", "did_something_enjoyable", "worked_on_goals",
      ];
      if (answers.has_medication)          enabled.push("took_medication");
      if (answers.track_suicidal_thoughts) enabled.push("suicidal_thoughts");
      try {
        const res = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled_questions: enabled, context: { ...answers, currency } }),
        });
        if (res.ok) setSaved(true);
      } catch { /* silent */ }
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [answers, currency]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "oklch(0.12 0.012 270)",
      }}>
        <p style={{ color: "oklch(0.55 0.03 270)", fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.47 .18 270 / .15) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)`,
      fontFamily: "var(--font-sans)",
      color: "#e0d6ff",
      paddingBottom: 100,
    }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "56px 0 28px",
        }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              border: PB, background: cardBg,
              backdropFilter: "blur(8px)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em" }}>
              {t("config_title")}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "oklch(0.55 0.03 270)" }}>
              {t("config_subtitle")}
            </p>
          </div>
          {saved && (
            <span style={{ fontSize: 11.5, color: P, fontWeight: 600, flexShrink: 0 }}>
              Salvo ✓
            </span>
          )}
        </div>

        {/* ── Perguntas de contexto ────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CONTEXT_QUESTIONS.map((q) => (
            <div key={q.id} style={{
              background: cardBg,
              backdropFilter: "blur(12px)",
              borderRadius: 20,
              border: PB,
              padding: "18px 18px 16px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>
                {t(q.qKey)}
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "oklch(0.55 0.03 270)", lineHeight: 1.5 }}>
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
                    background: answers[q.id] ? P : PL,
                    color: answers[q.id] ? "#fff" : "#e0d6ff",
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
                    background: !answers[q.id] ? "oklch(.55 .1 15 / .15)" : PL,
                    color: !answers[q.id] ? "oklch(.4 .1 15)" : "#e0d6ff",
                  }}
                >
                  {t("nao")}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Moeda ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 10 }}>
          <div style={{
            background: cardBg,
            backdropFilter: "blur(12px)",
            borderRadius: 20,
            border: PB,
            padding: "18px 18px 16px",
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>
              {t("fin_moeda")}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "oklch(0.55 0.03 270)", lineHeight: 1.5 }}>
              {t("fin_moeda_desc")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrencyState(c.code)}
                  style={{
                    padding: "8px 14px", borderRadius: 10, border: 0, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    transition: "all .15s ease",
                    background: currency === c.code ? P : PL,
                    color: currency === c.code ? "#fff" : "#e0d6ff",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
