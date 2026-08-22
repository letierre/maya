"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { MOOD_CHIPS, getMoodLabel } from "@/lib/checkin-moods";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import {
  EditCheckInView,
  CheckInAnswers,
  defaultAnswers,
  HABIT_ORDER,
  HABIT_COPY,
  getHabitLabel,
  MEDITATION_KEYS,
  EXERCISE_KEYS,
  MEDITATION_OPTIONS,
  EXERCISE_OPTIONS,
  HabitChipSelector,
  WaterCupSelector,
  WATER_GOAL,
  WATER_MAX,
  saveSleepLogFromAnswers,
} from "@/components/CheckInEditor";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | { kind: "feeling" }
  | { kind: "habit"; habitKey: string }
  | { kind: "meditation" }
  | { kind: "exercise" }
  | { kind: "gratitude" }
  | { kind: "confirm" }
  | { kind: "done" };

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
  pushHabit("read");
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
        Escolha mais de um humor que tenha feito sentido até esse momento
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

      const isExisting = !!existing && existing.date === today &&
        ((existing.mood_tags?.length ?? 0) > 0 ||
         ((existing.feeling ?? "").trim() !== "") ||
         ((existing.gratitude ?? "").trim() !== ""));
      if (isExisting) setIsEditing(true);
      setAnswers((prev) => {
        const next = { ...prev };
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
        // Fonte de verdade: uma corrida/ sono do dia sempre sobrescreve o valor salvo.
        if (hasRunningSession) next.ran = true;
        if (hasSleepLog) next.slept_well = (sleepLogs[0]?.quality ?? 0) >= 3;
        return next;
      });
      setLoading(false);
    });
  }, []);

  // ── Edit mode save ──────────────────────────────────────────────────────────

  const handleEditSave = useCallback(async () => {
    setSaving(true);
    try {
      // Se o usuário preencheu o sono no editor, salva o log de sono primeiro
      saveSleepLogFromAnswers(answers);
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
