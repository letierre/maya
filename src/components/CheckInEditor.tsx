"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { MOOD_CHIPS, getMoodLabel } from "@/lib/checkin-moods";

// ── Constants ─────────────────────────────────────────────────────────────────

export const HABIT_ORDER = [
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
export const MEDITATION_KEYS = ["meditation", "prayer", "breathing"] as const;
export const EXERCISE_KEYS = ["walked", "ran", "strength_training"] as const;

interface HabitCopy { emoji: string; label: string; a: string; b: string; }

export const HABIT_COPY: Record<string, HabitCopy> = {
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

export interface CheckInAnswers {
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

export function defaultAnswers(): CheckInAnswers {
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

export function getHabitLabel(key: string, context: Record<string, boolean>): string {
  const base = HABIT_COPY[key]?.label ?? key;
  if (key === "creative_activity") {
    return context.has_creative_hobby ? "Trabalhou no seu hobby criativo?" : "Fez algo criativo?";
  }
  return base;
}

// ── Water widgets ─────────────────────────────────────────────────────────────

export const WATER_GOAL   = 4;   // 4 copos × 250ml = 1L
export const WATER_MAX    = 12;  // 12 copos × 250ml = 3L
export const ML_PER_CUP   = 250;

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

export function WaterCupSelector({ cups, size, onChange }: {
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

// ── Chips multi-select ────────────────────────────────────────────────────────

export const MEDITATION_OPTIONS = [
  { key: "meditation", emoji: "🧘", label: "Meditei" },
  { key: "prayer", emoji: "🙏", label: "Orei" },
  { key: "breathing", emoji: "🌬️", label: "Respirei intencionalmente" },
];

export const EXERCISE_OPTIONS = [
  { key: "walked", emoji: "🚶", label: "Caminhei" },
  { key: "ran", emoji: "🏃", label: "Corri" },
  { key: "strength_training", emoji: "🏋️", label: "Musculação" },
];

export function HabitChipSelector({ options, selected, onToggle }: {
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

// ── EditCheckInView — editor do check-in (mesmo dia ou histórico) ─────────────

export function EditCheckInView({ answers, setAnswers, enabledKeys, context, gender, onSave, onClose, saving, todaySleep, eyebrow = "Editar check-in de hoje", title = "O que mudou?" }: {
  answers: CheckInAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<CheckInAnswers>>;
  enabledKeys: string[];
  context: Record<string, boolean>;
  gender: string;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  todaySleep: { quality: number | null; duration_min: number | null } | null;
  eyebrow?: string;
  title?: string;
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
          {eyebrow}
        </p>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
          {title}
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
