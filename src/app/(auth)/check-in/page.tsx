"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";

// ── Constants ─────────────────────────────────────────────────────────────────

const HABIT_ORDER = [
  "drank_water",
  "slept_well",
  "took_medication",
  "talked_to_someone",
  "meditation_prayer_breathing",
  "creative_activity",
  "exercise_walk",
  "did_something_enjoyable",
  "worked_on_goals",
  "bowel_movement",
  "felt_judged",
] as const;

type HabitKey = typeof HABIT_ORDER[number];

interface HabitCopy { emoji: string; label: string; a: string; b: string; }

const HABIT_COPY: Record<string, HabitCopy> = {
  drank_water:                 { emoji: "💧", label: "Bebeu água hoje?",              a: "Sim", b: "Hoje não"  },
  slept_well:                  { emoji: "😴", label: "Dormiu bem ontem?",             a: "Sim", b: "Não muito" },
  took_medication:             { emoji: "💊", label: "Tomou seus remédios?",          a: "Sim", b: "Esqueci"   },
  talked_to_someone:           { emoji: "🗣️", label: "Conversou com alguém?",         a: "Sim", b: "Não hoje"  },
  meditation_prayer_breathing: { emoji: "🧘", label: "Meditou, orou ou respirou?",    a: "Sim", b: "Não"       },
  creative_activity:           { emoji: "🎨", label: "Fez algo criativo?",            a: "Sim", b: "Não"       },
  exercise_walk:               { emoji: "🏃", label: "Caminhou ou se exercitou?",     a: "Sim", b: "Não"       },
  did_something_enjoyable:     { emoji: "😊", label: "Fez algo que gosta?",           a: "Sim", b: "Não"       },
  worked_on_goals:             { emoji: "🎯", label: "Trabalhou nas suas metas?",     a: "Sim", b: "Não"       },
  bowel_movement:              { emoji: "🚽", label: "Funcionamento intestinal OK?",  a: "Sim", b: "Não"       },
  felt_judged:                 { emoji: "⚖️", label: "Sentiu que foi julgada hoje?",  a: "Sim", b: "Não"       },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | { kind: "feeling" }
  | { kind: "habit"; habitKey: string }
  | { kind: "gratitude" }
  | { kind: "confirm" }
  | { kind: "done" };

interface CheckInAnswers {
  date: string;
  feeling: string;
  gratitude: string;
  gratitude_photos: string[];
  suicidal_thoughts: boolean;
  drank_water: boolean;
  slept_well: boolean;
  took_medication: boolean;
  talked_to_someone: boolean;
  meditation_prayer_breathing: boolean;
  creative_activity: boolean;
  exercise_walk: boolean;
  did_something_enjoyable: boolean;
  worked_on_goals: boolean;
  bowel_movement: boolean;
  felt_judged: boolean;
  ate_well: boolean;
}

function defaultAnswers(): CheckInAnswers {
  return {
    date: getLocalDate(),
    feeling: "",
    gratitude: "",
    gratitude_photos: [],
    suicidal_thoughts: false,
    drank_water: false,
    slept_well: false,
    took_medication: false,
    talked_to_someone: false,
    meditation_prayer_breathing: false,
    creative_activity: false,
    exercise_walk: false,
    did_something_enjoyable: false,
    worked_on_goals: false,
    bowel_movement: false,
    felt_judged: false,
    ate_well: false,
  };
}

function buildSteps(enabledKeys: string[], hasSuicidal: boolean): Step[] {
  const steps: Step[] = [{ kind: "feeling" }];
  for (const key of HABIT_ORDER) {
    if (enabledKeys.includes(key)) steps.push({ kind: "habit", habitKey: key });
  }
  steps.push({ kind: "gratitude" });
  if (hasSuicidal) steps.push({ kind: "confirm" });
  steps.push({ kind: "done" });
  return steps;
}

function getHabitLabel(key: string, context: Record<string, boolean>): string {
  const base = HABIT_COPY[key]?.label ?? key;
  if (key === "meditation_prayer_breathing") {
    return context.has_faith ? "Meditou, orou ou respirou?" : "Meditou ou respirou?";
  }
  if (key === "creative_activity") {
    return context.has_creative_hobby ? "Trabalhou no seu hobby criativo?" : "Fez algo criativo?";
  }
  return base;
}

// ── Shared loading screen ─────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .5) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Carregando…</p>
    </div>
  );
}

// ── EditCheckInView — shown when editing an existing check-in ─────────────────

function EditCheckInView({ answers, setAnswers, enabledKeys, context, onSave, onClose, saving }: {
  answers: CheckInAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<CheckInAnswers>>;
  enabledKeys: string[];
  context: Record<string, boolean>;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const feelingRef = useRef<HTMLDivElement>(null);
  const gratitudeRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (feelingRef.current && answers.feeling) feelingRef.current.innerText = answers.feeling;
    if (gratitudeRef.current && answers.gratitude) gratitudeRef.current.innerText = answers.gratitude;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const habitsToShow = HABIT_ORDER.filter((key) => enabledKeys.includes(key));
  const hasConfirm = enabledKeys.includes("suicidal_thoughts");

  const handlePhotoAdd = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setAnswers((a) => ({ ...a, gratitude_photos: [...a.gratitude_photos, path] }));
    } catch {
      toast.error("Erro ao processar imagem");
    }
  };

  const btn = (active: boolean, warm = false) => ({
    height: 36, padding: "0 14px", borderRadius: 10,
    border: 0, cursor: "pointer", fontFamily: "inherit",
    fontSize: 13, fontWeight: 600,
    transition: "background .15s ease, color .15s ease",
    ...(active
      ? warm
        ? { background: "oklch(.72 .1 30 / .35)", color: "oklch(.35 .08 30)" }
        : { background: "var(--primary)", color: "#fff" }
      : { background: "oklch(.5 .12 160 / .1)", color: "var(--muted-foreground)" }),
  });

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", overflowY: "auto",
      fontFamily: "var(--font-sans)", color: "var(--foreground)",
      background: `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .5) 0%, transparent 60%),
                   linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      paddingBottom: 100,
    }}>
      {/* Close */}
      <button type="button" onClick={onClose} aria-label="Fechar" style={{
        position: "fixed", top: 14, left: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
        background: "oklch(1 0 0 / .72)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 3px oklch(.25 .02 160 / .06)",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Header */}
      <div style={{ padding: "72px 28px 24px" }}>
        <p style={{
          margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em",
          textTransform: "uppercase", color: "var(--muted-foreground)",
        }}>
          Editar check-in de hoje
        </p>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
          O que mudou?
        </h1>
      </div>

      <div style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Sentimento ── */}
        <section>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Como você está
          </p>
          <div
            ref={feelingRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Escreva como você está sentindo…"
            onInput={(e) => setAnswers((a) => ({ ...a, feeling: (e.target as HTMLElement).innerText }))}
            style={{
              outline: "none", fontSize: 16, lineHeight: 1.55, fontWeight: 500,
              color: "var(--foreground)", minHeight: 52,
              padding: "13px 15px", borderRadius: 14,
              background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(.5 .12 160 / .12)",
            }}
          />
        </section>

        {/* ── Hábitos ── */}
        {habitsToShow.length > 0 && (
          <section>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Hábitos de hoje
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {habitsToShow.map((key) => {
                const base = HABIT_COPY[key]!;
                const label = getHabitLabel(key, context);
                const value = answers[key as HabitKey];

                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px", borderRadius: 14,
                    background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
                    border: "1px solid oklch(.5 .12 160 / .12)",
                  }}>
                    <span style={{ fontSize: 21, flexShrink: 0, lineHeight: 1 }}>{base.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button type="button" style={btn(value === true)}
                        onClick={() => setAnswers((a) => ({ ...a, [key]: true }))}>{base.a}</button>
                      <button type="button" style={btn(value === false, true)}
                        onClick={() => setAnswers((a) => ({ ...a, [key]: false }))}>{base.b}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Gratidão ── */}
        <section>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
            Gratidão
          </p>
          <div
            ref={gratitudeRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Uma palavra, um momento, alguém…"
            onInput={(e) => setAnswers((a) => ({ ...a, gratitude: (e.target as HTMLElement).innerText }))}
            style={{
              outline: "none", fontSize: 16, lineHeight: 1.55, fontStyle: "italic",
              color: "var(--foreground)", minHeight: 52,
              padding: "13px 15px", borderRadius: 14,
              background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(.5 .12 160 / .12)",
            }}
          />

          {/* Photo strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            {answers.gratitude_photos.map((p) => (
              <div key={p} style={{
                position: "relative", width: 54, height: 54, borderRadius: 10, overflow: "hidden", flexShrink: 0,
              }}>
                <img src={photoUrl(p)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button"
                  onClick={() => setAnswers((a) => ({ ...a, gratitude_photos: a.gratitude_photos.filter((x) => x !== p) }))}
                  style={{
                    position: "absolute", top: 2, right: 2, width: 16, height: 16,
                    borderRadius: 9999, background: "rgba(0,0,0,.55)", border: 0,
                    color: "#fff", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 10,
                  }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => photoInputRef.current?.click()} style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px",
              borderRadius: 9999, background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(.5 .12 160 / .2)", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, color: "var(--foreground)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Foto
            </button>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]); e.target.value = ""; }}
          />
        </section>

        {/* ── Pensamentos (suicidal_thoughts) ── */}
        {hasConfirm && (
          <section>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(.45 .02 160)" }}>
              Só pra confirmar
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.4 }}>
              Hoje você sentiu vontade de se machucar ou de se ir?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <button type="button" onClick={() => setAnswers((a) => ({ ...a, suicidal_thoughts: false }))} style={{
                height: 48, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, fontWeight: 500, textAlign: "left", padding: "0 18px",
                transition: "all .15s ease",
                background: answers.suicidal_thoughts === false ? "var(--primary)" : "oklch(1 0 0 / .55)",
                backdropFilter: "blur(8px)",
                border: answers.suicidal_thoughts === false ? "none" : "1px solid oklch(.5 .12 160 / .2)",
                color: answers.suicidal_thoughts === false ? "#fff" : "var(--foreground)",
              }}>
                Não, hoje não.
              </button>
              <button type="button" onClick={() => setAnswers((a) => ({ ...a, suicidal_thoughts: true }))} style={{
                height: 48, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, fontWeight: 500, textAlign: "left", padding: "0 18px",
                transition: "all .15s ease",
                background: answers.suicidal_thoughts === true ? "oklch(.72 .1 30 / .35)" : "oklch(.85 .04 30 / .15)",
                border: "1px solid oklch(.6 .1 30 / .3)",
                color: "oklch(.35 .07 30)",
              }}>
                Sim, tive esse pensamento.
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Fixed save */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: "12px 24px 32px",
        background: "linear-gradient(180deg, transparent 0%, oklch(.98 .005 160 / .92) 30%, oklch(.98 .005 160) 100%)",
      }}>
        <button type="button" onClick={onSave} disabled={saving} style={{
          width: "100%", height: 52, borderRadius: 16, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: "var(--primary)", color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
          boxShadow: "0 4px 14px -4px oklch(.5 .12 160 / .45)",
          opacity: saving ? 0.7 : 1, transition: "opacity .15s ease",
        }}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}

// ── Stage wrapper (ritual) ────────────────────────────────────────────────────

function CheckInStage({ stepIdx, totalForProgress, isDone, onClose, children }: {
  stepIdx: number;
  totalForProgress: number;
  isDone: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const progress = Math.min(stepIdx + 1, totalForProgress);

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", overflow: "hidden",
      fontFamily: "var(--font-sans)", color: "var(--foreground)",
      background: isDone
        ? `radial-gradient(ellipse 100% 80% at 50% 50%, oklch(.92 .07 160 / .8) 0%, oklch(.96 .015 160) 70%)`
        : `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .5) 0%, transparent 60%),
           linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      position: "relative", transition: "background .6s ease",
    }}>
      {!isDone && (
        <button type="button" onClick={onClose} aria-label="Fechar" style={{
          position: "absolute", top: 14, left: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
          background: "oklch(1 0 0 / .55)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px oklch(.25 .02 160 / .06)",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {!isDone && (
        <div style={{
          position: "absolute", top: 22, left: 64, right: 64, zIndex: 9,
          display: "flex", gap: 4, alignItems: "center",
        }}>
          {Array.from({ length: totalForProgress }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 9999,
              background: i < progress ? "var(--primary)" : "oklch(.5 .12 160 / .15)",
              transition: "background .3s ease",
            }} />
          ))}
        </div>
      )}

      {!isDone && (
        <p style={{
          position: "absolute", top: 56, left: 0, right: 0, textAlign: "center", zIndex: 9,
          margin: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
          color: "var(--muted-foreground)", letterSpacing: ".16em", textTransform: "uppercase",
        }}>
          {String(progress).padStart(2, "0")} de {String(totalForProgress).padStart(2, "0")}
        </p>
      )}

      <div style={{
        position: "absolute", inset: 0, padding: "110px 32px 130px",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        {children}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes caret { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Ritual steps ──────────────────────────────────────────────────────────────

function FeelingStep({ initialValue, onChange, onNext, onPrev }: {
  initialValue: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && initialValue && !ref.current.innerText) ref.current.innerText = initialValue;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        Como você está?
      </h1>
      <p style={{ margin: "0 0 30px", fontSize: 14, color: "var(--muted-foreground)" }}>
        Em uma frase, do jeito que vier
      </p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        data-placeholder="Escreva como você está sentindo…"
        onInput={(e) => onChange((e.target as HTMLElement).innerText)}
        style={{
          outline: "none", fontSize: 22, lineHeight: 1.4, fontWeight: 500,
          letterSpacing: "-0.01em", minHeight: 100, color: "var(--foreground)",
        }}
      />
      <div style={{
        position: "absolute", bottom: 28, left: 32, right: 32,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button type="button" onClick={onPrev} style={{
          background: "transparent", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
        }}>← Voltar</button>
        <button type="button" onClick={onNext} style={{
          height: 48, padding: "0 24px", borderRadius: 14,
          background: "var(--primary)", color: "#fff", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 14px -4px oklch(.5 .12 160 / .45)",
        }}>
          Continuar
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}

function HabitStep({ habitKey, context, onAnswer, onSkip, onPrev }: {
  habitKey: string;
  context: Record<string, boolean>;
  onAnswer: (key: string, value: boolean) => void;
  onSkip: () => void;
  onPrev: () => void;
}) {
  const base = HABIT_COPY[habitKey] ?? { emoji: "•", label: habitKey, a: "Sim", b: "Não" };
  const label = getHabitLabel(habitKey, context);

  return (
    <>
      <div style={{ fontSize: 84, lineHeight: 1, marginBottom: 20 }}>{base.emoji}</div>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {label}
      </h1>
      <div style={{ marginTop: 36, display: "flex", gap: 10 }}>
        <button type="button" onClick={() => onAnswer(habitKey, true)} style={{
          flex: 1, height: 56, borderRadius: 16, border: 0, cursor: "pointer",
          background: "var(--primary)", color: "#fff",
          fontFamily: "inherit", fontSize: 16, fontWeight: 600, letterSpacing: "-0.005em",
          boxShadow: "0 4px 14px -4px oklch(.5 .12 160 / .45)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12 10 17 19 7" />
          </svg>
          {base.a}
        </button>
        <button type="button" onClick={() => onAnswer(habitKey, false)} style={{
          flex: 1, height: 56, borderRadius: 16,
          background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
          border: "1px solid oklch(.5 .12 160 / .15)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 16, fontWeight: 500,
          color: "var(--foreground)", letterSpacing: "-0.005em",
        }}>{base.b}</button>
      </div>
      <button type="button" onClick={onSkip} style={{
        marginTop: 14, background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
        textDecoration: "underline", alignSelf: "center",
      }}>Prefiro não responder</button>
      <button type="button" onClick={onPrev} style={{
        position: "absolute", bottom: 28, left: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
      }}>← Voltar</button>
    </>
  );
}

function GratitudeStep({ initialValue, initialPhotos, onChange, onPhotosChange, onNext, onPrev }: {
  initialValue: string;
  initialPhotos: string[];
  onChange: (v: string) => void;
  onPhotosChange: (photos: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  useEffect(() => {
    if (textRef.current && initialValue && !textRef.current.innerText) textRef.current.innerText = initialValue;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoAdd = useCallback(async (file: File) => {
    try {
      const compressed = await compressImage(file);
      const path = await uploadToCloud(compressed, "diary");
      setPhotos((prev) => { const next = [...prev, path]; onPhotosChange(next); return next; });
    } catch { toast.error("Erro ao processar imagem"); }
  }, [onPhotosChange]);

  return (
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        Pelo que você foi grata hoje?
      </h1>
      <p style={{ margin: "0 0 26px", fontSize: 14, color: "var(--muted-foreground)" }}>
        Uma palavra, um momento, alguém…
      </p>
      <div ref={textRef} contentEditable suppressContentEditableWarning data-placeholder="…"
        onInput={(e) => onChange((e.target as HTMLElement).innerText)}
        style={{
          outline: "none", fontSize: 20, lineHeight: 1.5, color: "var(--foreground)",
          minHeight: 90, fontStyle: "italic",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => photoInputRef.current?.click()} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
          borderRadius: 9999, background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
          border: "1px solid oklch(.5 .12 160 / .2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 12, color: "var(--foreground)",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" />
          </svg>
          Adicionar foto
        </button>
        {photos.map((p) => (
          <div key={p} style={{ position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
            <img src={photoUrl(p)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button type="button" onClick={() => { const next = photos.filter((x) => x !== p); setPhotos(next); onPhotosChange(next); }}
              style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: 9999, background: "rgba(0,0,0,.55)", border: 0, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>×</button>
          </div>
        ))}
      </div>
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handlePhotoAdd(e.target.files[0]); e.target.value = ""; }} />
      <div style={{ position: "absolute", bottom: 28, left: 32, right: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="button" onClick={onPrev} style={{ background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)" }}>← Voltar</button>
        <button type="button" onClick={onNext} style={{
          height: 48, padding: "0 24px", borderRadius: 14,
          background: "var(--primary)", color: "#fff", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 14px -4px oklch(.5 .12 160 / .45)",
        }}>
          Continuar
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}

function ConfirmStep({ onAnswer, onPrev }: { onAnswer: (v: boolean) => void; onPrev: () => void; }) {
  return (
    <>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "oklch(.45 .02 160)" }}>
        Só pra confirmar
      </p>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
        Hoje você sentiu vontade de se machucar ou de se ir?
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        Pergunto pra cuidar de você. Tudo que você responde aqui fica entre nós.
      </p>
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={() => onAnswer(false)} style={{
          height: 52, borderRadius: 14,
          background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
          border: "1px solid oklch(.5 .12 160 / .2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: "var(--foreground)", textAlign: "left", padding: "0 18px",
        }}>Não, hoje não.</button>
        <button type="button" onClick={() => onAnswer(true)} style={{
          height: 52, borderRadius: 14,
          background: "oklch(.85 .04 30 / .15)", border: "1px solid oklch(.6 .1 30 / .3)",
          cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: "oklch(.35 .07 30)", textAlign: "left", padding: "0 18px",
        }}>Sim, tive esse pensamento.</button>
      </div>
      <button type="button" onClick={onPrev} style={{
        position: "absolute", bottom: 28, left: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
      }}>← Voltar</button>
    </>
  );
}

function DoneStep() {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 92, height: 92, borderRadius: 9999, marginBottom: 24,
        background: "oklch(.5 .12 160 / .15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 0 12px oklch(.5 .12 160 / .07), 0 0 0 28px oklch(.5 .12 160 / .04)",
        animation: "pulse 2s ease-in-out infinite",
      }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none"
          stroke="oklch(.45 .15 160)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12 10 17 19 7" />
        </svg>
      </div>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em" }}>Registrado.</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--muted-foreground)" }}>Até amanhã.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [enabledKeys, setEnabledKeys] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, boolean>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<CheckInAnswers>(defaultAnswers);
  const [saving, setSaving] = useState(false);

  const savedRef = useRef(false);
  const latestAnswers = useRef<CheckInAnswers>(defaultAnswers());
  latestAnswers.current = answers;

  useEffect(() => {
    const today = getLocalDate();
    Promise.all([
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/check-ins?date=${today}`).then((r) => r.json()).catch(() => null),
    ]).then(([prefs, existing]) => {
      const enabled: string[] = prefs.enabled_questions ?? [];
      const ctx: Record<string, boolean> = prefs.context ?? {};
      setEnabledKeys(enabled);
      setContext(ctx);
      setSteps(buildSteps(enabled, enabled.includes("suicidal_thoughts")));

      if (existing && existing.date === today) {
        setIsEditing(true);
        setAnswers((prev) => ({
          ...prev,
          feeling: existing.feeling ?? "",
          gratitude: existing.gratitude ?? "",
          gratitude_photos: existing.gratitude_photos ?? [],
          ...Object.fromEntries(
            [...HABIT_ORDER, "suicidal_thoughts", "ate_well"].map((k) => [k, existing[k] ?? false])
          ),
        }));
      }
      setLoading(false);
    });
  }, []);

  // ── Edit mode save ──────────────────────────────────────────────────────────

  const handleEditSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (answers.suicidal_thoughts) {
        toast.warning(
          "Se estiver passando por um momento difícil, o CVV pode ajudar. Ligue 188 ou acesse cvv.org.br — é gratuito e sigiloso.",
          { duration: 12000 }
        );
      }
      const achievData = await fetch("/api/achievements", { method: "POST" })
        .then((r) => r.json()).catch(() => ({}));
      achievData?.new_achievements?.forEach((a: { icon: string; label: string }) => {
        toast.success(`${a.icon} ${a.label} desbloqueado`, { duration: 4000 });
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar alterações");
      setSaving(false);
    }
  }, [answers, router]);

  // ── Ritual navigation ───────────────────────────────────────────────────────

  const cur = steps[stepIdx];
  const isDone = cur?.kind === "done";
  const totalForProgress = steps.filter((s) => s.kind !== "done").length;

  const goNext = useCallback(
    () => setStepIdx((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length]
  );

  const goPrev = useCallback(() => {
    if (stepIdx === 0) { router.push("/dashboard"); return; }
    setStepIdx((i) => i - 1);
  }, [stepIdx, router]);

  const handleHabitAnswer = useCallback((key: string, value: boolean) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 180);
  }, [steps.length]);

  const handleConfirmAnswer = useCallback((value: boolean) => {
    setAnswers((a) => ({ ...a, suicidal_thoughts: value }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 180);
  }, [steps.length]);

  // ── Save on Done ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDone || savedRef.current) return;
    savedRef.current = true;
    const data = latestAnswers.current;

    fetch("/api/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(() => {
        if (data.suicidal_thoughts) {
          toast.warning(
            "Se estiver passando por um momento difícil, o CVV pode ajudar. Ligue 188 ou acesse cvv.org.br — é gratuito e sigiloso.",
            { duration: 12000 }
          );
        }
        return fetch("/api/achievements", { method: "POST" }).then((r) => r.json());
      })
      .then((achievData) => {
        achievData?.new_achievements?.forEach((a: { icon: string; label: string }) => {
          toast.success(`${a.icon} ${a.label} desbloqueado`, { duration: 4000 });
        });
      })
      .catch(() => {});

    const timer = setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1800);
    return () => clearTimeout(timer);
  }, [isDone, router]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  // Edit mode: compact overview for existing check-in
  if (isEditing) {
    return (
      <EditCheckInView
        answers={answers}
        setAnswers={setAnswers}
        enabledKeys={enabledKeys}
        context={context}
        onSave={handleEditSave}
        onClose={() => router.push("/dashboard")}
        saving={saving}
      />
    );
  }

  // First-time ritual
  if (steps.length === 0) return <LoadingScreen />;

  const renderStep = () => {
    if (cur.kind === "feeling") return (
      <FeelingStep
        initialValue={answers.feeling}
        onChange={(v) => setAnswers((a) => ({ ...a, feeling: v }))}
        onNext={goNext} onPrev={goPrev}
      />
    );
    if (cur.kind === "habit") return (
      <HabitStep habitKey={cur.habitKey} context={context}
        onAnswer={handleHabitAnswer} onSkip={goNext} onPrev={goPrev} />
    );
    if (cur.kind === "gratitude") return (
      <GratitudeStep
        initialValue={answers.gratitude} initialPhotos={answers.gratitude_photos}
        onChange={(v) => setAnswers((a) => ({ ...a, gratitude: v }))}
        onPhotosChange={(photos) => setAnswers((a) => ({ ...a, gratitude_photos: photos }))}
        onNext={goNext} onPrev={goPrev}
      />
    );
    if (cur.kind === "confirm") return (
      <ConfirmStep onAnswer={handleConfirmAnswer} onPrev={goPrev} />
    );
    if (cur.kind === "done") return <DoneStep />;
    return null;
  };

  return (
    <CheckInStage stepIdx={stepIdx} totalForProgress={totalForProgress}
      isDone={isDone} onClose={() => router.push("/dashboard")}>
      {renderStep()}
    </CheckInStage>
  );
}
