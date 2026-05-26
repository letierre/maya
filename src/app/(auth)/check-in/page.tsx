"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { MOOD_CHIPS, getMoodLabel } from "@/lib/checkin-moods";

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
  drank_water:                 { emoji: "💧", label: "Bebeu água hoje?",              a: "Sim", b: "Hoje não"  }, // substituído por WaterStep — mantido para EditCheckInView
  slept_well:                  { emoji: "😴", label: "Dormiu bem ontem?",             a: "Sim", b: "Não muito" },
  took_medication:             { emoji: "💊", label: "Tomou seus remédios?",          a: "Sim", b: "Esqueci"   },
  talked_to_someone:           { emoji: "🗣️", label: "Conversou pessoalmente com alguém?", a: "Sim", b: "Não hoje"  },
  meditation_prayer_breathing: { emoji: "🧘", label: "Meditou, orou ou respirou?",    a: "Sim", b: "Não"       },
  creative_activity:           { emoji: "🎨", label: "Fez algo criativo?",            a: "Sim", b: "Não"       },
  exercise_walk:               { emoji: "🏃", label: "Caminhou ou se exercitou?",     a: "Sim", b: "Não"       },
  did_something_enjoyable:     { emoji: "😊", label: "Fez algo que gosta?",           a: "Sim", b: "Não"       },
  worked_on_goals:             { emoji: "🎯", label: "Avançou nas tarefas de hoje?",  a: "Sim", b: "Não"       },
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
  mood_tags: string[];
  gratitude: string;
  gratitude_photos: string[];
  suicidal_thoughts: boolean;
  drank_water: boolean;
  water_cups: number;
  slept_well: boolean;
  sleep_quality: number | null;
  sleep_start_time: string;
  sleep_end_time: string;
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
    mood_tags: [],
    gratitude: "",
    gratitude_photos: [],
    suicidal_thoughts: false,
    drank_water: false,
    water_cups: 0,
    slept_well: false,
    sleep_quality: null,
    sleep_start_time: "",
    sleep_end_time: "",
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

function buildSteps(enabledKeys: string[], hasSuicidal: boolean, hasSleepLog: boolean): Step[] {
  const steps: Step[] = [{ kind: "feeling" }];
  for (const key of HABIT_ORDER) {
    if (key === "slept_well" && hasSleepLog) continue; // já registrou sono hoje
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

function EditCheckInView({ answers, setAnswers, enabledKeys, context, gender, onSave, onClose, saving }: {
  answers: CheckInAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<CheckInAnswers>>;
  enabledKeys: string[];
  context: Record<string, boolean>;
  gender: string;
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

  const habitsToShow = HABIT_ORDER.filter((key) => key !== "slept_well" && enabledKeys.includes(key));
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {MOOD_CHIPS.map((chip) => {
              const active = (answers.mood_tags ?? []).includes(chip.id);
              const pos = chip.valence === "positive";
              return (
                <button key={chip.id} type="button"
                  onClick={() => setAnswers((a) => {
                    const cur = a.mood_tags ?? [];
                    const next = cur.includes(chip.id) ? cur.filter((t) => t !== chip.id) : [...cur, chip.id];
                    return { ...a, mood_tags: next };
                  })}
                  style={{
                    padding: "7px 12px", borderRadius: 9999, border: 0, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "all .15s ease",
                    background: active
                      ? pos ? "oklch(.5 .12 160 / .18)" : "oklch(.72 .1 30 / .22)"
                      : "oklch(1 0 0 / .6)",
                    backdropFilter: "blur(8px)",
                    color: active
                      ? pos ? "oklch(.32 .1 160)" : "oklch(.35 .09 30)"
                      : "var(--foreground)",
                    outline: active
                      ? `2px solid ${pos ? "oklch(.5 .12 160 / .35)" : "oklch(.6 .1 30 / .35)"}`
                      : "1px solid oklch(.5 .12 160 / .1)",
                  }}>
                  <span style={{ fontSize: 15 }}>{chip.emoji}</span>
                  {getMoodLabel(chip, gender)}
                </button>
              );
            })}
          </div>
          <div
            ref={feelingRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Quer detalhar? (opcional)"
            onInput={(e) => setAnswers((a) => ({ ...a, feeling: (e.target as HTMLElement).innerText }))}
            style={{
              outline: "none", fontSize: 15, lineHeight: 1.55, fontWeight: 500,
              color: "var(--foreground)", minHeight: 44,
              padding: "11px 15px", borderRadius: 14,
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

                if (key === "drank_water") {
                  const cups = answers.water_cups ?? 0;
                  return (
                    <div key={key} style={{
                      padding: "11px 14px", borderRadius: 14,
                      background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
                      border: "1px solid oklch(.5 .12 160 / .12)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 21, flexShrink: 0, lineHeight: 1 }}>🥛</span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>Copos de água hoje</span>
                        <span style={{ fontSize: 12, fontWeight: 700,
                          color: cups >= WATER_GOAL ? "oklch(.35 .1 160)" : "var(--muted-foreground)" }}>
                          {cups}/{WATER_GOAL}{cups >= WATER_GOAL ? " ✓" : ""}
                        </span>
                      </div>
                      <WaterCupSelector
                        cups={cups}
                        size={42}
                        onAdd={() => setAnswers((a) => {
                          const n = Math.min((a.water_cups ?? 0) + 1, WATER_MAX);
                          return { ...a, water_cups: n, drank_water: n >= WATER_GOAL };
                        })}
                        onRemoveLast={() => setAnswers((a) => {
                          const n = Math.max((a.water_cups ?? 0) - 1, 0);
                          return { ...a, water_cups: n, drank_water: n >= WATER_GOAL };
                        })}
                      />
                    </div>
                  );
                }

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
      width: "100%", minHeight: "100dvh", overflowX: "hidden",
      fontFamily: "var(--font-sans)", color: "var(--foreground)",
      background: isDone
        ? `radial-gradient(ellipse 100% 80% at 50% 50%, oklch(.92 .07 160 / .8) 0%, oklch(.96 .015 160) 70%)`
        : `radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.95 .04 80 / .5) 0%, transparent 60%),
           linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.93 .03 160) 100%)`,
      position: "relative", transition: "background .6s ease",
    }}>
      {!isDone && (
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
      )}

      {!isDone && (
        <div style={{
          position: "fixed", top: 22, left: 64, right: 64, zIndex: 9,
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
          position: "fixed", top: 56, left: 0, right: 0, textAlign: "center", zIndex: 9,
          margin: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
          color: "var(--muted-foreground)", letterSpacing: ".16em", textTransform: "uppercase",
        }}>
          {String(progress).padStart(2, "0")} de {String(totalForProgress).padStart(2, "0")}
        </p>
      )}

      <div style={{
        minHeight: "100dvh", boxSizing: "border-box",
        padding: "110px 32px 130px",
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

function FeelingStep({ initialValue, initialMoodTags, gender, onChange, onMoodTagsChange, onNext, onPrev }: {
  initialValue: string;
  initialMoodTags: string[];
  gender: string;
  onChange: (v: string) => void;
  onMoodTagsChange: (tags: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<string[]>(initialMoodTags);

  useEffect(() => {
    if (ref.current && initialValue && !ref.current.innerText) ref.current.innerText = initialValue;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = (id: string) => {
    setTags((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      onMoodTagsChange(next);
      return next;
    });
  };

  return (
    <>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        Como você está?
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)" }}>
        Selecione o que faz sentido agora
      </p>

      {/* Emotion chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        {MOOD_CHIPS.map((chip) => {
          const active = tags.includes(chip.id);
          const pos = chip.valence === "positive";
          return (
            <button key={chip.id} type="button" onClick={() => toggleTag(chip.id)} style={{
              padding: "9px 14px", borderRadius: 9999, border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6,
              transition: "all .15s ease",
              background: active
                ? pos ? "oklch(.5 .12 160 / .18)" : "oklch(.72 .1 30 / .22)"
                : "oklch(1 0 0 / .6)",
              backdropFilter: "blur(8px)",
              color: active
                ? pos ? "oklch(.32 .1 160)" : "oklch(.35 .09 30)"
                : "var(--foreground)",
              outline: active
                ? `2px solid ${pos ? "oklch(.5 .12 160 / .35)" : "oklch(.6 .1 30 / .35)"}`
                : "1px solid oklch(.5 .12 160 / .1)",
              boxShadow: active ? "none" : "0 1px 3px oklch(.2 .02 160 / .06)",
            }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{chip.emoji}</span>
              {getMoodLabel(chip, gender)}
            </button>
          );
        })}
      </div>

      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
        Quer detalhar? (opcional)
      </p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        data-placeholder="Escreva em palavras próprias…"
        onInput={(e) => onChange((e.target as HTMLElement).innerText)}
        style={{
          outline: "none", fontSize: 16, lineHeight: 1.5, fontWeight: 500,
          color: "var(--foreground)", minHeight: 48,
          padding: "11px 14px", borderRadius: 14,
          background: "oklch(1 0 0 / .45)", backdropFilter: "blur(8px)",
          border: "1px solid oklch(.5 .12 160 / .12)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
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

// ── Sleep Step (shown only when no sleep log exists for today) ────────────────

const SLEEP_EMOJIS: { emoji: string; label: string; quality: number }[] = [
  { emoji: "😩", label: "Péssimo", quality: 1 },
  { emoji: "😕", label: "Ruim",    quality: 2 },
  { emoji: "😐", label: "Ok",      quality: 3 },
  { emoji: "🙂", label: "Bom",     quality: 4 },
  { emoji: "😊", label: "Ótimo",   quality: 5 },
];

const sleepTimeWrap: React.CSSProperties = {
  overflow: "hidden", minWidth: 0, borderRadius: 10,
  border: "1px solid oklch(.7 .04 160 / .3)",
  background: "oklch(1 0 0 / .55)", backdropFilter: "blur(8px)",
  height: 42, display: "flex", alignItems: "center",
};
const sleepTimeInput: React.CSSProperties = {
  flex: "1 1 0", width: "100%", maxWidth: "100%", boxSizing: "border-box",
  minWidth: 0, padding: "0 10px", border: "none", borderRadius: 0,
  fontFamily: "inherit", fontSize: 14, fontWeight: 600,
  background: "transparent", color: "var(--foreground)", outline: "none",
};

function SleepStep({ onAnswer, onPrev }: {
  onAnswer: (quality: number, startTime: string, endTime: string) => void;
  onPrev: () => void;
}) {
  const [quality, setQuality] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
      {text}
    </p>
  );

  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🌙</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        Como foi seu sono?
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
        Ainda não há registro de hoje — registre aqui
      </p>

      {/* Times */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <div style={{ flex: 1 }}>
          {label11("Fui dormir")}
          <div style={sleepTimeWrap}>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={sleepTimeInput} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {label11("Acordei")}
          <div style={sleepTimeWrap}>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={sleepTimeInput} />
          </div>
        </div>
      </div>

      {/* Quality */}
      <div style={{ marginTop: 20 }}>
        {label11("Qualidade")}
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          {SLEEP_EMOJIS.map(({ emoji, label, quality: q }) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "12px 2px", borderRadius: 14, border: 0, cursor: "pointer",
              background: quality === q ? "oklch(.5 .12 280 / .18)" : "oklch(1 0 0 / .45)",
              backdropFilter: "blur(8px)",
              outline: quality === q ? "2px solid oklch(.5 .12 280 / .5)" : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: quality === q ? "oklch(.35 .1 280)" : "var(--muted-foreground)" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => quality && onAnswer(quality, startTime, endTime)}
        disabled={!quality} style={{
          marginTop: 24, width: "100%", height: 50, borderRadius: 14, border: 0,
          cursor: quality ? "pointer" : "not-allowed",
          background: quality ? "var(--primary)" : "oklch(.88 .02 160)",
          color: quality ? "#fff" : "oklch(.6 .04 160)",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600,
          transition: "all .2s ease",
        }}>
        Registrar sono
      </button>

      <button type="button" onClick={onPrev} style={{
        position: "absolute", bottom: 28, left: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
      }}>← Voltar</button>

      <button type="button" onClick={() => onAnswer(3, "", "")} style={{
        position: "absolute", bottom: 28, right: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
        textDecoration: "underline",
      }}>Pular</button>
    </>
  );
}

// ── Water Step ────────────────────────────────────────────────────────────────

const WATER_GOAL = 4;  // 4 copos × 250ml = 1L
const WATER_MAX  = 12; // 12 copos × 250ml = 3L

function CupIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  const w = size * 0.85;
  const h = size;
  const fillColor = "oklch(.42 .13 160)";
  const emptyStroke = "oklch(.65 .06 160 / .45)";
  return (
    <svg width={w} height={h} viewBox="0 0 22 28" fill="none">
      <path d="M3 2 L5.5 22 H16.5 L19 2 H3Z"
        fill={filled ? "oklch(.5 .13 160 / .22)" : "oklch(.88 .02 160 / .4)"}
        stroke={filled ? fillColor : emptyStroke}
        strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M5.5 22 H16.5 L15.5 26 H6.5 Z"
        fill={filled ? "oklch(.5 .13 160 / .3)" : "oklch(.88 .02 160 / .4)"}
        stroke={filled ? fillColor : emptyStroke}
        strokeWidth="1.6" strokeLinejoin="round"
      />
      {filled && (
        <path d="M6.5 17 Q11 14 15.5 17 L16.5 22 H5.5 Z"
          fill="oklch(.5 .15 200 / .35)"
        />
      )}
    </svg>
  );
}

function WaterCupSelector({ cups, size, onAdd, onRemoveLast }: {
  cups: number;
  size?: number;
  onAdd: () => void;
  onRemoveLast: () => void;
}) {
  const displayCount = Math.max(cups, WATER_GOAL);
  const cupW = size ?? 52;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {Array.from({ length: displayCount }).map((_, i) => {
        const filled = i < cups;
        const isLastFilled = filled && i === cups - 1;
        return (
          <button key={i} type="button"
            onClick={isLastFilled ? onRemoveLast : undefined}
            style={{
              width: cupW, height: cupW * 1.15,
              borderRadius: 14, border: 0, cursor: isLastFilled ? "pointer" : "default",
              background: filled ? "oklch(.5 .12 160 / .1)" : "oklch(1 0 0 / .45)",
              backdropFilter: "blur(8px)",
              outline: isLastFilled
                ? "2.5px solid oklch(.5 .12 160 / .5)"
                : i === WATER_GOAL - 1 && filled
                  ? "2px solid oklch(.5 .12 160 / .25)"
                  : "1px solid oklch(.5 .12 160 / .1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s ease",
              position: "relative",
            }}>
            <CupIcon filled={filled} size={cupW * 0.58} />
            {isLastFilled && (
              <span style={{
                position: "absolute", top: 4, right: 5,
                fontSize: 9, color: "oklch(.5 .12 160)", fontWeight: 700, lineHeight: 1,
              }}>−</span>
            )}
          </button>
        );
      })}
      {cups < WATER_MAX && (
        <button type="button" onClick={onAdd} style={{
          width: cupW, height: cupW * 1.15,
          borderRadius: 14, border: "1.5px dashed oklch(.5 .12 160 / .3)",
          cursor: "pointer",
          background: "oklch(1 0 0 / .35)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .15s ease",
        }}>
          <span style={{ fontSize: 24, color: "oklch(.5 .12 160)", fontWeight: 300, lineHeight: 1 }}>+</span>
        </button>
      )}
    </div>
  );
}

function WaterStep({ initialCups, onAnswer, onPrev }: {
  initialCups: number;
  onAnswer: (cups: number) => void;
  onPrev: () => void;
}) {
  const [cups, setCups] = useState<number>(initialCups);

  return (
    <>
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        Quantos copos bebeu hoje?
      </h1>
      <p style={{ margin: "0 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        1 copo = 250ml · meta: {WATER_GOAL} copos (1L)
      </p>

      <WaterCupSelector
        cups={cups}
        onAdd={() => setCups((c) => Math.min(c + 1, WATER_MAX))}
        onRemoveLast={() => setCups((c) => Math.max(c - 1, 0))}
      />

      {cups > 0 && (
        <p style={{ marginTop: 16, fontSize: 14, fontWeight: 600,
          color: cups >= WATER_GOAL ? "oklch(.4 .12 160)" : "var(--muted-foreground)" }}>
          {cups >= WATER_GOAL
            ? `Meta atingida! ${cups} copo${cups === 1 ? "" : "s"} 🎉`
            : `${cups} copo${cups === 1 ? "" : "s"} · faltam ${WATER_GOAL - cups} para 1L`}
        </p>
      )}

      <button type="button" onClick={onPrev} style={{
        position: "absolute", bottom: 28, left: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
      }}>← Voltar</button>

      <button type="button" onClick={() => onAnswer(cups)} style={{
        position: "absolute", bottom: 28, right: 32,
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
        textDecoration: "underline",
      }}>{cups === 0 ? "Não bebi" : "Continuar"}</button>
    </>
  );
}

// ── Habit Step ────────────────────────────────────────────────────────────────

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
  const [gender, setGender] = useState<string>("nao_dizer");
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
      fetch(`/api/sleep?from=${today}&to=${today}&limit=1`).then((r) => r.json()).catch(() => []),
    ]).then(([prefs, existing, sleepLogs]) => {
      const enabled: string[] = prefs.enabled_questions ?? [];
      const ctx: Record<string, boolean> = prefs.context ?? {};
      const hasSleepLog = Array.isArray(sleepLogs) && sleepLogs.length > 0;
      setEnabledKeys(enabled);
      setContext(ctx);
      setGender((prefs.context?.gender as string) ?? "nao_dizer");
      setSteps(buildSteps(enabled, enabled.includes("suicidal_thoughts"), hasSleepLog));

      if (existing && existing.date === today) {
        setIsEditing(true);
        setAnswers((prev) => ({
          ...prev,
          feeling: existing.feeling ?? "",
          mood_tags: existing.mood_tags ?? [],
          gratitude: existing.gratitude ?? "",
          gratitude_photos: existing.gratitude_photos ?? [],
          water_cups: existing.water_cups ?? 0,
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

  const handleWaterAnswer = useCallback((cups: number) => {
    setAnswers((a) => ({ ...a, water_cups: cups, drank_water: cups >= WATER_GOAL }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 60);
  }, [steps.length]);

  const handleSleepAnswer = useCallback((quality: number, startTime: string, endTime: string) => {
    setAnswers((a) => ({
      ...a,
      slept_well: quality >= 3,
      sleep_quality: quality,
      sleep_start_time: startTime,
      sleep_end_time: endTime,
    }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 60);
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

    // Post sleep log separately if quality was captured
    if (data.sleep_quality !== null) {
      const sleepStart = data.sleep_start_time ? `${data.date}T${data.sleep_start_time}:00-03:00` : null;
      let sleepEnd: string | null = null;
      let durationMin: number | null = null;
      if (data.sleep_start_time && data.sleep_end_time) {
        const [sh, sm] = data.sleep_start_time.split(":").map(Number);
        const [eh, em] = data.sleep_end_time.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const crossMidnight = endMin <= startMin;
        const endDate = crossMidnight
          ? new Date(new Date(data.date + "T12:00:00").getTime() + 86400000).toISOString().split("T")[0]
          : data.date;
        sleepEnd = `${endDate}T${data.sleep_end_time}:00-03:00`;
        durationMin = crossMidnight ? (24 * 60 - startMin) + endMin : endMin - startMin;
      }
      fetch("/api/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          quality: data.sleep_quality,
          duration_min: durationMin,
          sleep_start: sleepStart,
          sleep_end: sleepEnd,
          source: "checkin",
        }),
      }).catch(() => {});
    }

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
        gender={gender}
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
        initialMoodTags={answers.mood_tags}
        gender={gender}
        onChange={(v) => setAnswers((a) => ({ ...a, feeling: v }))}
        onMoodTagsChange={(tags) => setAnswers((a) => ({ ...a, mood_tags: tags }))}
        onNext={goNext} onPrev={goPrev}
      />
    );
    if (cur.kind === "habit") {
      if (cur.habitKey === "slept_well") return (
        <SleepStep onAnswer={handleSleepAnswer} onPrev={goPrev} />
      );
      if (cur.habitKey === "drank_water") return (
        <WaterStep initialCups={answers.water_cups} onAnswer={handleWaterAnswer} onPrev={goPrev} />
      );
      return (
        <HabitStep habitKey={cur.habitKey} context={context}
          onAnswer={handleHabitAnswer} onSkip={goNext} onPrev={goPrev} />
      );
    }
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
