"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { MOOD_CHIPS, getMoodLabel } from "@/lib/checkin-moods";
import { invalidateFetchCache } from "@/lib/fetch-cache";

// ── Constants ─────────────────────────────────────────────────────────────────

const HABIT_ORDER = [
  "drank_water",
  "slept_well",
  "took_medication",
  "talked_to_someone",
  "meditation",
  "prayer",
  "breathing",
  "creative_activity",
  "walked",
  "ran",
  "strength_training",
  "did_something_enjoyable",
  "worked_on_goals",
  "bowel_movement",
  "felt_judged",
] as const;

type HabitKey = typeof HABIT_ORDER[number];

// Grupos renderizados como passos multi-select (chips), não como pergunta Sim/Não.
const MEDITATION_KEYS = ["meditation", "prayer", "breathing"] as const;
const EXERCISE_KEYS = ["walked", "ran", "strength_training"] as const;

interface HabitCopy { emoji: string; label: string; a: string; b: string; }

const HABIT_COPY: Record<string, HabitCopy> = {
  drank_water:                 { emoji: "💧", label: "Bebeu água hoje?",              a: "Sim", b: "Hoje não"  }, // substituído por WaterStep — mantido para EditCheckInView
  slept_well:                  { emoji: "😴", label: "Dormiu bem ontem?",             a: "Sim", b: "Não muito" },
  took_medication:             { emoji: "💊", label: "Tomou seus remédios?",          a: "Sim", b: "Esqueci"   },
  talked_to_someone:           { emoji: "🗣️", label: "Conversou pessoalmente com alguém?", a: "Sim", b: "Não hoje"  },
  meditation:                  { emoji: "🧘", label: "Meditou",                       a: "Sim", b: "Não"       },
  prayer:                      { emoji: "🙏", label: "Orou",                          a: "Sim", b: "Não"       },
  breathing:                   { emoji: "🌬️", label: "Respirou intencionalmente",     a: "Sim", b: "Não"       },
  creative_activity:           { emoji: "🎨", label: "Fez algo criativo?",            a: "Sim", b: "Não"       },
  walked:                      { emoji: "🚶", label: "Caminhou",                      a: "Sim", b: "Não"       },
  ran:                         { emoji: "🏃", label: "Correu",                        a: "Sim", b: "Não"       },
  strength_training:           { emoji: "🏋️", label: "Musculação",                    a: "Sim", b: "Não"       },
  did_something_enjoyable:     { emoji: "😊", label: "Fez algo que gosta?",           a: "Sim", b: "Não"       },
  worked_on_goals:             { emoji: "🎯", label: "Avançou nas suas metas hoje?",  a: "Sim", b: "Não"       },
  bowel_movement:              { emoji: "🚽", label: "Funcionamento intestinal OK?",  a: "Sim", b: "Não"       },
  felt_judged:                 { emoji: "⚖️", label: "Sentiu que foi julgada hoje?",  a: "Sim", b: "Não"       },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | { kind: "feeling" }
  | { kind: "habit"; habitKey: string }
  | { kind: "meditation" }
  | { kind: "exercise" }
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
  meditation: boolean;
  prayer: boolean;
  breathing: boolean;
  creative_activity: boolean;
  walked: boolean;
  ran: boolean;
  strength_training: boolean;
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
    meditation: false,
    prayer: false,
    breathing: false,
    creative_activity: false,
    walked: false,
    ran: false,
    strength_training: false,
    did_something_enjoyable: false,
    worked_on_goals: false,
    bowel_movement: false,
    felt_judged: false,
    ate_well: false,
  };
}

function buildSteps(enabledKeys: string[], hasSuicidal: boolean, hasSleepLog: boolean): Step[] {
  const has = (key: string) => enabledKeys.includes(key);
  const autoKeys = new Set(["ate_well", "worked_on_goals"]);
  const pushHabit = (key: string) => {
    if (key === "slept_well" && hasSleepLog) return; // já registrou sono hoje
    if (autoKeys.has(key)) return; // auto-calculado pelo backend
    if (has(key)) steps.push({ kind: "habit", habitKey: key });
  };

  const steps: Step[] = [{ kind: "feeling" }];
  pushHabit("drank_water");
  pushHabit("slept_well");
  pushHabit("took_medication");
  pushHabit("talked_to_someone");
  if (MEDITATION_KEYS.some(has)) steps.push({ kind: "meditation" });
  pushHabit("creative_activity");
  if (EXERCISE_KEYS.some(has)) steps.push({ kind: "exercise" });
  pushHabit("did_something_enjoyable");
  // worked_on_goals é auto-calculado (nunca vira passo)
  pushHabit("bowel_movement");
  pushHabit("felt_judged");
  steps.push({ kind: "gratitude" });
  if (hasSuicidal) steps.push({ kind: "confirm" });
  steps.push({ kind: "done" });
  return steps;
}

function getHabitLabel(key: string, context: Record<string, boolean>): string {
  const base = HABIT_COPY[key]?.label ?? key;
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
      background: "oklch(0.12 0.012 270)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <p style={{ color: "#e0d6ff", fontSize: 13 }}>Carregando…</p>
    </div>
  );
}

// ── EditCheckInView — shown when editing an existing check-in ─────────────────

function EditCheckInView({ answers, setAnswers, enabledKeys, context, gender, onSave, onClose, saving, todaySleep }: {
  answers: CheckInAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<CheckInAnswers>>;
  enabledKeys: string[];
  context: Record<string, boolean>;
  gender: string;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  todaySleep: { quality: number | null; duration_min: number | null } | null;
}) {
  const feelingRef = useRef<HTMLDivElement>(null);
  const gratitudeRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (feelingRef.current && answers.feeling) feelingRef.current.innerText = answers.feeling;
    if (gratitudeRef.current && answers.gratitude) gratitudeRef.current.innerText = answers.gratitude;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calc fields: not shown as manual toggles
  const autoKeys = new Set(["slept_well", "ate_well", "worked_on_goals"]);
  // Grupos multi-select renderizados como chips (não como Sim/Não)
  const groupedKeys = new Set<string>([...MEDITATION_KEYS, ...EXERCISE_KEYS]);
  const habitsToShow = HABIT_ORDER.filter((key) => !autoKeys.has(key) && !groupedKeys.has(key) && enabledKeys.includes(key));
  const hasConfirm = enabledKeys.includes("suicidal_thoughts");

  // Score: all enabled habits minus suicidal/felt_judged
  const scoreKeys = enabledKeys.filter((k) => k !== "suicidal_thoughts" && k !== "felt_judged");
  const score = scoreKeys.filter((k) => answers[k as HabitKey] === true).length;
  const scoreTotal = scoreKeys.length;

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
        ? { background: "rgba(255,77,77,0.25)", color: "#FF6B6B" }
        : { background: "#7C5CFF", color: "#fff" }
      : { background: "rgba(124,92,255,0.12)", color: "#7C5CFF" }),
  });

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", overflowY: "auto",
      fontFamily: "var(--font-sans)", color: "var(--foreground)",
      background: "oklch(0.12 0.012 270)",
      paddingBottom: 100,
    }}>
      {/* Close */}
      <button type="button" onClick={onClose} aria-label="Fechar" style={{
        position: "fixed", top: 14, left: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
        background: "oklch(0.16 0.012 270 / 0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 3px oklch(0.28 0.02 270 / .06)",
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
                      ? pos ? "#7C5CFF" : "#FF5C5C"
                      : "oklch(0.14 0.012 270)",
                    backdropFilter: "blur(8px)",
                    color: active ? "#fff" : "var(--foreground)",
                    outline: active ? "none" : "1px solid oklch(0.5 0.12 270 / .1)",
                    boxShadow: active ? "0 3px 10px -2px oklch(0.5 0.12 270 / .55)" : "none",
                    transform: active ? "scale(1.03)" : "none",
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
              background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(0.5 0.12 270 / .12)",
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
                      background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
                      border: "1px solid oklch(0.5 0.12 270 / .12)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 21, flexShrink: 0, lineHeight: 1 }}>🥛</span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>Copos de água hoje</span>
                        <span style={{ fontSize: 12, fontWeight: 700,
                          color: cups >= WATER_GOAL ? "#e0d6ff" : "var(--muted-foreground)" }}>
                          {cups * ML_PER_CUP}ml{cups >= WATER_GOAL ? " ✓" : ""}
                        </span>
                      </div>
                      <WaterCupSelector
                        cups={cups}
                        size={42}
                        onChange={(n) => setAnswers((a) => {
                          const next = Math.max(0, Math.min(n, WATER_MAX));
                          return { ...a, water_cups: next, drank_water: next >= WATER_GOAL };
                        })}
                      />
                    </div>
                  );
                }

                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px", borderRadius: 14,
                    background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
                    border: "1px solid oklch(0.5 0.12 270 / .12)",
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

        {/* ── Meditação & respiração (multi-select) ── */}
        {MEDITATION_KEYS.some((k) => enabledKeys.includes(k)) && (
          <section>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Meditação & respiração
            </p>
            <HabitChipSelector
              options={MEDITATION_OPTIONS.filter((o) => o.key !== "prayer" || !!context.has_faith)}
              selected={{ meditation: answers.meditation, prayer: answers.prayer, breathing: answers.breathing }}
              onToggle={(key) => setAnswers((a) => ({ ...a, [key]: !(a[key as keyof CheckInAnswers] as boolean) }))}
            />
          </section>
        )}

        {/* ── Exercício (multi-select) ── */}
        {EXERCISE_KEYS.some((k) => enabledKeys.includes(k)) && (
          <section>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
              Exercício
            </p>
            <HabitChipSelector
              options={EXERCISE_OPTIONS}
              selected={{ walked: answers.walked, ran: answers.ran, strength_training: answers.strength_training }}
              onToggle={(key) => setAnswers((a) => ({ ...a, [key]: !(a[key as keyof CheckInAnswers] as boolean) }))}
            />
          </section>
        )}

        {/* ── Resumo automático ── */}
        <section>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#A78BFA" }}>
            📋 Seu dia até agora: {score}/{scoreTotal}
          </p>
          <div style={{
            padding: "14px 16px", borderRadius: 14,
            background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
            border: "1px solid oklch(0.28 0.02 270 / 0.4)",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {scoreKeys.map((key) => {
              const done = answers[key as HabitKey] === true;
              const cups = answers.water_cups ?? 0;
              const waterGoal = 4;
              let emoji = "•";
              let label = key;
              let hint = "";
              if (key === "ate_well") {
                emoji = "🍽️"; label = "Comeu bem";
                hint = done ? "Refeições equilibradas hoje" : "Registre pelo menos 2 refeições no dia";
              } else if (key === "worked_on_goals") {
                emoji = "🎯"; label = "Metas";
                hint = done ? "Avançou hoje" : "Conclua uma tarefa do plano";
              } else if (key === "slept_well") {
                emoji = "😴"; label = "Sono";
                if (done) hint = "Boa noite de sono";
                else if (todaySleep?.quality != null) hint = `Qualidade ${todaySleep.quality}/5 — não atingiu o mínimo`;
                else hint = "Registre seu sono";
              } else if (key === "drank_water") {
                emoji = "💧"; label = "Água";
                const falta = waterGoal - cups;
                hint = done ? `${cups} copos ✓` : falta > 1 ? `Faltam só ${falta} copos` : falta === 1 ? "Falta só 1 copo" : "Marque seus copos";
              } else {
                const base = HABIT_COPY[key];
                emoji = base?.emoji ?? "•";
                label = base?.label ?? key;
              }
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 12.5, color: done ? "#e0d6ff" : "#9e96b5",
                  opacity: done ? 1 : 0.55,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{done ? "✅" : "⬜"}</span>
                  <span style={{ flexShrink: 0 }}>{emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
                  {hint ? <span style={{ fontSize: 10, color: "#9e96b5", textAlign: "right", whiteSpace: "nowrap" }}>{hint}</span> : null}
                </div>
              );
            })}
          </div>
        </section>

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
              background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(0.5 0.12 270 / .12)",
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
              borderRadius: 9999, background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(0.5 0.12 270 / .2)", cursor: "pointer",
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
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
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
                background: answers.suicidal_thoughts === false ? "#7C5CFF" : "rgba(124,92,255,0.1)",
                border: answers.suicidal_thoughts === false ? "none" : "1px solid rgba(167,139,250,0.2)",
                color: answers.suicidal_thoughts === false ? "#fff" : "#7C5CFF",
              }}>
                Não, hoje não.
              </button>
              <button type="button" onClick={() => setAnswers((a) => ({ ...a, suicidal_thoughts: true }))} style={{
                height: 48, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                fontSize: 14, fontWeight: 500, textAlign: "left", padding: "0 18px",
                transition: "all .15s ease",
                background: answers.suicidal_thoughts === true ? "rgba(255,77,77,0.25)" : "rgba(255,77,77,0.1)",
                border: "1px solid rgba(255,77,77,0.3)",
                color: answers.suicidal_thoughts === true ? "#FF6B6B" : "#FF6B6B",
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
        background: "linear-gradient(180deg, transparent 0%, oklch(0.12 0.012 270 / .92) 30%, oklch(0.12 0.012 270) 100%)",
      }}>
        <button type="button" onClick={onSave} disabled={saving} style={{
          width: "100%", height: 52, borderRadius: 16, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: "#7C5CFF", color: "#fff",
          fontFamily: "inherit", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
          boxShadow: "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
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
      background: "oklch(0.12 0.012 270)",
      position: "relative", transition: "background .6s ease",
    }}>
      {!isDone && (
        <button type="button" onClick={onClose} aria-label="Fechar" style={{
          position: "fixed", top: 14, left: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
          background: "oklch(0.16 0.012 270 / 0.85)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 3px oklch(0.28 0.02 270 / .06)",
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
              background: i < progress ? "var(--primary)" : "oklch(0.5 0.12 270 / .15)",
              transition: "background .3s ease",
            }} />
          ))}
        </div>
      )}

      {!isDone && (
        <p style={{
          position: "fixed", top: 56, left: 0, right: 0, textAlign: "center", zIndex: 9,
          margin: 0, fontFamily: "var(--font-sans)", fontSize: 10,
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

// Barra de ações fixa no rodapé — mantém Voltar/Continuar sempre visíveis,
// mesmo quando o conteúdo cresce (ex.: muitos copos de água).
function StepFooter({ onPrev, onNext, nextLabel, nextDisabled, secondary }: {
  onPrev: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      padding: "12px 24px calc(18px + env(safe-area-inset-bottom))",
      background: "linear-gradient(180deg, transparent 0%, oklch(0.12 0.012 270 / .92) 30%, oklch(0.12 0.012 270) 100%)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={onPrev} style={{
          background: "transparent", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
          padding: "8px 0", flexShrink: 0,
        }}>← Voltar</button>
        {secondary}
        <div style={{ flex: 1 }} />
        {onNext && (
          <button type="button" onClick={onNext} disabled={nextDisabled} style={{
            height: 48, padding: "0 22px", borderRadius: 14, border: 0,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            background: nextDisabled ? "oklch(0.2 0.02 270)" : "#7C5CFF",
            color: nextDisabled ? "oklch(0.55 0.03 270)" : "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600, flexShrink: 0,
            boxShadow: nextDisabled ? "none" : "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
          }}>{nextLabel ?? "Continuar"}</button>
        )}
      </div>
    </div>
  );
}

// Chips multi-select de hábito (usados nos grupos de meditação e exercício).
function HabitChipSelector({ options, selected, onToggle }: {
  options: { key: string; emoji: string; label: string }[];
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 8 }}>
      {options.map((o) => {
        const active = !!selected[o.key];
        return (
          <button key={o.key} type="button" onClick={() => onToggle(o.key)} style={{
            padding: "14px 6px", borderRadius: 14, border: 0, cursor: "pointer",
            fontFamily: "inherit", minWidth: 0,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            transition: "all .15s ease",
            background: active ? "#7C5CFF" : "oklch(0.14 0.012 270)",
            color: active ? "#fff" : "var(--foreground)",
            outline: active ? "2px solid oklch(0.5 0.12 270 / .5)" : "1px solid oklch(0.5 0.12 270 / .1)",
            boxShadow: active ? "0 3px 10px -2px oklch(0.5 0.12 270 / .5)" : "none",
          }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{o.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, textAlign: "center" }}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
                ? pos ? "#7C5CFF" : "#FF5C5C"
                : "oklch(0.14 0.012 270)",
              backdropFilter: "blur(8px)",
              color: active ? "#fff" : "var(--foreground)",
              outline: active ? "none" : "1px solid oklch(0.5 0.12 270 / .1)",
              boxShadow: active ? "0 3px 10px -2px oklch(0.5 0.12 270 / .55)" : "0 1px 3px oklch(0.2 0.02 270 / .06)",
              transform: active ? "scale(1.03)" : "none",
            }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{chip.emoji}</span>
              {getMoodLabel(chip, gender)}
            </button>
          );
        })}
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
        💬 Como está seu coração hoje?
      </p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        data-placeholder="Escreva como você está se sentindo... use suas próprias palavras"
        onInput={(e) => onChange((e.target as HTMLElement).innerText)}
        style={{
          outline: "none", fontSize: 16, lineHeight: 1.6, fontWeight: 400,
          color: "#e0d6ff", minHeight: 80,
          padding: "14px 16px", borderRadius: 16,
          background: "#1a1530",
          border: "1px solid rgba(167,139,250,0.25)",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
        <button type="button" onClick={onPrev} style={{
          background: "transparent", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, color: "var(--muted-foreground)",
        }}>← Voltar</button>
        <button type="button" onClick={onNext} style={{
          height: 48, padding: "0 24px", borderRadius: 14,
          background: "#7C5CFF", color: "#fff", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
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
  border: "1px solid oklch(0.5 0.04 270 / .3)",
  background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
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
              background: quality === q ? "oklch(0.5 0.12 270 / .18)" : "oklch(0.14 0.012 270)",
              backdropFilter: "blur(8px)",
              outline: quality === q ? "2px solid oklch(0.5 0.12 270 / .5)" : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: quality === q ? "#e0d6ff" : "var(--muted-foreground)" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <StepFooter
        onPrev={onPrev}
        onNext={() => quality && onAnswer(quality, startTime, endTime)}
        nextLabel="Registrar sono"
        nextDisabled={!quality}
        secondary={
          <button type="button" onClick={() => onAnswer(3, "", "")} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
            textDecoration: "underline", padding: "8px 0", flexShrink: 0,
          }}>Pular</button>
        }
      />
    </>
  );
}

// ── Water Step ────────────────────────────────────────────────────────────────

const WATER_GOAL   = 4;   // 4 copos × 250ml = 1L
const WATER_MAX    = 12;  // 12 copos × 250ml = 3L
const ML_PER_CUP   = 250;

function CupIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  const w = size * 0.85;
  const h = size;
  const fillColor = "#7C5CFF";
  const emptyStroke = "oklch(0.5 0.06 270 / .45)";
  return (
    <svg width={w} height={h} viewBox="0 0 22 28" fill="none">
      <path d="M3 2 L5.5 22 H16.5 L19 2 H3Z"
        fill={filled ? "oklch(0.5 0.13 270 / .22)" : "oklch(0.28 0.02 270 / .4)"}
        stroke={filled ? fillColor : emptyStroke}
        strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M5.5 22 H16.5 L15.5 26 H6.5 Z"
        fill={filled ? "oklch(0.5 0.13 270 / .3)" : "oklch(0.28 0.02 270 / .4)"}
        stroke={filled ? fillColor : emptyStroke}
        strokeWidth="1.6" strokeLinejoin="round"
      />
      {filled && (
        <path d="M6.5 17 Q11 14 15.5 17 L16.5 22 H5.5 Z"
          fill="oklch(0.5 0.15 270 / .35)"
        />
      )}
    </svg>
  );
}

function WaterCupSelector({ cups, size, onChange }: {
  cups: number;
  size?: number;
  onChange: (n: number) => void;
}) {
  const displayCount = Math.max(cups, WATER_GOAL);
  const cupW = size ?? 52;
  const totalMl = cups * ML_PER_CUP;
  const goalMl  = WATER_GOAL * ML_PER_CUP;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {Array.from({ length: displayCount }).map((_, i) => {
          const filled = i < cups;
          const isLastFilled = filled && i === cups - 1;
          // click empty cup → fill up to that cup; click last filled → remove it
          const handleClick = isLastFilled
            ? () => onChange(cups - 1)
            : !filled
              ? () => onChange(i + 1)
              : undefined;
          return (
            <button key={i} type="button"
              onClick={handleClick}
              style={{
                width: cupW, height: cupW * 1.15,
                borderRadius: 14, border: 0, cursor: handleClick ? "pointer" : "default",
                background: filled ? "oklch(0.5 0.12 270 / .1)" : "oklch(0.14 0.012 270)",
                backdropFilter: "blur(8px)",
                outline: isLastFilled
                  ? "2.5px solid oklch(0.5 0.12 270 / .5)"
                  : i === WATER_GOAL - 1 && filled
                    ? "2px solid oklch(0.5 0.12 270 / .25)"
                    : "1px solid oklch(0.5 0.12 270 / .1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s ease",
                position: "relative",
              }}>
              <CupIcon filled={filled} size={cupW * 0.58} />
              {isLastFilled && (
                <span style={{
                  position: "absolute", top: 4, right: 5,
                  fontSize: 9, color: "#7C5CFF", fontWeight: 700, lineHeight: 1,
                }}>−</span>
              )}
            </button>
          );
        })}
        {cups < WATER_MAX && (
          <button type="button" onClick={() => onChange(cups + 1)} style={{
            width: cupW, height: cupW * 1.15,
            borderRadius: 14, border: "1.5px dashed oklch(0.5 0.12 270 / .3)",
            cursor: "pointer",
            background: "oklch(0.14 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background .15s ease",
          }}>
            <span style={{ fontSize: 24, color: "#7C5CFF", fontWeight: 300, lineHeight: 1 }}>+</span>
          </button>
        )}
      </div>
      <p style={{
        margin: "10px 0 0", fontSize: 13,
        color: cups >= WATER_GOAL ? "#e0d6ff" : "var(--muted-foreground)",
      }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{totalMl}ml</span>
        {" · 250ml por copo · "}
        {cups >= WATER_GOAL
          ? "meta atingida 🎉"
          : `faltam ${goalMl - totalMl}ml para 1L`}
      </p>
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
        onChange={(n) => setCups(Math.max(0, Math.min(n, WATER_MAX)))}
      />

      <StepFooter onPrev={onPrev} onNext={() => onAnswer(cups)} nextLabel={cups === 0 ? "Não bebi" : "Continuar"} />
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
          background: "#7C5CFF", color: "#fff",
          fontFamily: "inherit", fontSize: 16, fontWeight: 600, letterSpacing: "-0.005em",
          boxShadow: "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
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
          background: "rgba(167,139,250,0.1)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 16, fontWeight: 500,
          color: "#e0d6ff", letterSpacing: "-0.005em",
        }}>{base.b}</button>
      </div>
      <button type="button" onClick={onSkip} style={{
        marginTop: 14, background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
        textDecoration: "underline", alignSelf: "center",
      }}>Prefiro não responder</button>
      <StepFooter onPrev={onPrev} />
    </>
  );
}

// ── Meditation Step (multi-select: meditou / orou / respirou) ─────────────────

const MEDITATION_OPTIONS = [
  { key: "meditation", emoji: "🧘", label: "Meditei" },
  { key: "prayer", emoji: "🙏", label: "Orei" },
  { key: "breathing", emoji: "🌬️", label: "Respirei intencionalmente" },
];

function MeditationStep({ selected, hasFaith, onToggle, onNext, onPrev }: {
  selected: Record<string, boolean>;
  hasFaith: boolean;
  onToggle: (key: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const options = MEDITATION_OPTIONS.filter((o) => o.key !== "prayer" || hasFaith);
  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🧘</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        O que você fez hoje?
      </h1>
      <p style={{ margin: "6px 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        Marque tudo o que se aplicar
      </p>
      <HabitChipSelector options={options} selected={selected} onToggle={onToggle} />
      <StepFooter onPrev={onPrev} onNext={onNext} />
    </>
  );
}

// ── Exercise Step (multi-select: caminhou / correu / musculação) ──────────────

const EXERCISE_OPTIONS = [
  { key: "walked", emoji: "🚶", label: "Caminhei" },
  { key: "ran", emoji: "🏃", label: "Corri" },
  { key: "strength_training", emoji: "🏋️", label: "Musculação" },
];

function ExerciseStep({ selected, onToggle, onNext, onPrev }: {
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🏃</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        Você se exercitou hoje?
      </h1>
      <p style={{ margin: "6px 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        Marque tudo o que se aplicar
      </p>
      <HabitChipSelector options={EXERCISE_OPTIONS} selected={selected} onToggle={onToggle} />
      <StepFooter onPrev={onPrev} onNext={onNext} />
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
          borderRadius: 9999, background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
          border: "1px solid oklch(0.5 0.12 270 / .2)", cursor: "pointer",
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
      <StepFooter onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function ConfirmStep({ onAnswer, onPrev }: { onAnswer: (v: boolean) => void; onPrev: () => void; }) {
  return (
    <>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
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
          background: "rgba(124,92,255,0.1)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: "#7C5CFF", textAlign: "left", padding: "0 18px",
        }}>Não, hoje não.</button>
        <button type="button" onClick={() => onAnswer(true)} style={{
          height: 52, borderRadius: 14,
          background: "rgba(255,77,77,0.15)", border: "1px solid rgba(255,77,77,0.3)",
          cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: "#FF6B6B", textAlign: "left", padding: "0 18px",
        }}>Sim, tive esse pensamento.</button>
      </div>
      <StepFooter onPrev={onPrev} />
    </>
  );
}

function DoneStep() {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 92, height: 92, borderRadius: 9999, marginBottom: 24,
        background: "oklch(0.5 0.12 270 / .15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 0 12px oklch(0.5 0.12 270 / .07), 0 0 0 28px oklch(0.5 0.12 270 / .04)",
        animation: "pulse 2s ease-in-out infinite",
      }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none"
          stroke="#7C5CFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  const [todaySleep, setTodaySleep] = useState<{ quality: number | null; duration_min: number | null } | null>(null);

  const savedRef = useRef(false);
  const latestAnswers = useRef<CheckInAnswers>(defaultAnswers());
  latestAnswers.current = answers;

  useEffect(() => {
    const today = getLocalDate();
    Promise.all([
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/check-ins?date=${today}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/sleep?from=${today}&to=${today}&limit=1`).then((r) => r.json()).catch(() => []),
      fetch(`/api/running?from=${today}&to=${today}`).then((r) => r.json()).catch(() => []),
    ]).then(([prefs, existing, sleepLogs, runningSessions]) => {
      const enabled: string[] = prefs.enabled_questions ?? [];
      const ctx: Record<string, boolean> = prefs.context ?? {};
      const hasSleepLog = Array.isArray(sleepLogs) && sleepLogs.length > 0;
      const hasRunningSession = Array.isArray(runningSessions) && runningSessions.length > 0;
      if (hasSleepLog) {
        setTodaySleep({ quality: sleepLogs[0].quality ?? null, duration_min: sleepLogs[0].duration_min ?? null });
      }
      setEnabledKeys(enabled);
      setContext(ctx);
      setGender((prefs.context?.gender as string) ?? "nao_dizer");
      setSteps(buildSteps(enabled, enabled.includes("suicidal_thoughts"), hasSleepLog));

      const isExisting = !!existing && existing.date === today;
      if (isExisting) setIsEditing(true);
      setAnswers((prev) => {
        const next = { ...prev };
        if (hasRunningSession) next.ran = true;
        if (hasSleepLog) next.slept_well = (sleepLogs[0]?.quality ?? 0) >= 3;
        if (isExisting) {
          next.feeling = existing.feeling ?? "";
          next.mood_tags = existing.mood_tags ?? [];
          next.gratitude = existing.gratitude ?? "";
          next.gratitude_photos = existing.gratitude_photos ?? [];
          next.water_cups = existing.water_cups ?? 0;
          Object.assign(next, Object.fromEntries(
            [...HABIT_ORDER, "suicidal_thoughts", "ate_well"].map((k) => [k, existing[k] ?? false])
          ));
        }
        return next;
      });
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
        body: JSON.stringify({ ...answers }),
      });
      if (answers.suicidal_thoughts) {
        toast.warning(
          "Se estiver passando por um momento difícil, o CVV pode ajudar. Ligue 188 ou acesse cvv.org.br — é gratuito e sigiloso.",
          { duration: 12000 }
        );
      }
      invalidateFetchCache("/api/check-ins");
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

  // Toggle de chips multi-select (meditação/exercício) — não avança sozinho.
  const handleToggle = useCallback((key: string) => {
    setAnswers((a) => ({ ...a, [key]: !(a[key as keyof CheckInAnswers] as boolean) }));
  }, []);

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
    const data = { ...latestAnswers.current };

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

    const timer = setTimeout(() => { invalidateFetchCache("/api/check-ins"); router.push("/dashboard"); router.refresh(); }, 1800);
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
        todaySleep={todaySleep}
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
          onAnswer={handleHabitAnswer}
          onSkip={goNext}
          onPrev={goPrev} />
      );
    }
    if (cur.kind === "meditation") return (
      <MeditationStep
        selected={{ meditation: answers.meditation, prayer: answers.prayer, breathing: answers.breathing }}
        hasFaith={!!context.has_faith}
        onToggle={handleToggle}
        onNext={goNext} onPrev={goPrev}
      />
    );
    if (cur.kind === "exercise") return (
      <ExerciseStep
        selected={{ walked: answers.walked, ran: answers.ran, strength_training: answers.strength_training }}
        onToggle={handleToggle}
        onNext={goNext} onPrev={goPrev}
      />
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
