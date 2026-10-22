"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLocalDate } from "@/lib/utils";
import { getLocale } from "@/lib/language";
import { SLEPT_WELL_MIN_QUALITY } from "@/lib/checkin-constants";
import { compressImage, uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { MOOD_CHIPS, getMoodLabel } from "@/lib/checkin-moods";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";
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
  HabitToggle,
  WaterCupSelector,
  WATER_GOAL,
  WATER_MAX,
  saveSleepLogFromAnswers,
  answersEqual,
} from "@/components/CheckInEditor";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | { kind: "feeling" }
  | { kind: "sleep" }
  | { kind: "water" }
  | { kind: "habits" }
  | { kind: "meditation" }
  | { kind: "exercise" }
  | { kind: "gratitude" }
  | { kind: "confirm" }
  | { kind: "done" };

// Hábitos simples (Sim/Não) que viram um único checklist, em vez de uma tela cada.
const SIMPLE_HABITS = [
  "took_medication", "talked_to_someone", "creative_activity",
  "read", "did_something_enjoyable", "bowel_movement", "felt_judged",
];

function buildSteps(enabledKeys: string[], hasSuicidal: boolean, hasSleepLog: boolean): Step[] {
  const has = (key: string) => enabledKeys.includes(key);
  const steps: Step[] = [{ kind: "feeling" }];

  // Sono antes da água: é sobre a noite passada, vem logo após "como você está".
  if (has("slept_well") && !hasSleepLog) steps.push({ kind: "sleep" });
  if (has("drank_water")) steps.push({ kind: "water" });

  if (SIMPLE_HABITS.some(has)) steps.push({ kind: "habits" });

  if (MEDITATION_KEYS.some(has)) steps.push({ kind: "meditation" });
  if (EXERCISE_KEYS.some(has)) steps.push({ kind: "exercise" });
  steps.push({ kind: "gratitude" });
  if (hasSuicidal) steps.push({ kind: "confirm" });
  steps.push({ kind: "done" });
  return steps;
}

// ── Shared loading screen ─────────────────────────────────────────────────────

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div style={{
      minHeight: "100dvh",
      background: "oklch(0.12 0.012 270)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <p style={{ color: "#e0d6ff", fontSize: 13 }}>{t("carregando")}</p>
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
  const { t } = useTranslation();
  const progress = Math.min(stepIdx + 1, totalForProgress);

  return (
    <div className="ck-root" style={{
      width: "100%", minHeight: "100dvh", overflowX: "hidden",
      fontFamily: "var(--font-sans)", color: "var(--foreground)",
      background: "oklch(0.12 0.012 270)",
      position: "relative", transition: "background .6s ease",
    }}>
      {!isDone && (
        <button type="button" onClick={onClose} aria-label={t("ck_fechar")} style={{
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
          {t("ck_step_of", { current: String(progress).padStart(2, "0"), total: String(totalForProgress).padStart(2, "0") })}
        </p>
      )}

      <div key={stepIdx} style={{
        minHeight: "100dvh", boxSizing: "border-box",
        padding: "110px 32px 130px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        animation: "ckScreenIn .3s ease",
      }}>
        {children}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes caret { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
        @keyframes ckScreenIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ckRingPulse { 0% { transform: scale(1); opacity: 0.65; } 100% { transform: scale(1.9); opacity: 0; } }
        .ck-root button { transition: transform .12s ease, opacity .12s ease; }
        .ck-root button:active { transform: scale(0.96); opacity: .85; }
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
  const { t } = useTranslation();
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
        }}>{t("voltar")}</button>
        {secondary}
        <div style={{ flex: 1 }} />
        {onNext && (
          <button type="button" onClick={onNext} disabled={nextDisabled} style={{
            height: 48, padding: "0 22px", borderRadius: 14, border: 0,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            background: nextDisabled ? "oklch(0.2 0.02 270)" : "#7C5CFF",
            color: nextDisabled ? "var(--text-muted)" : "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600, flexShrink: 0,
            boxShadow: nextDisabled ? "none" : "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
          }}>{nextLabel ?? t("ck_continuar")}</button>
        )}
      </div>
    </div>
  );
}

function FeelingStep({ initialValue, initialMoodTags, gender, name, onChange, onMoodTagsChange, onNext, onPrev }: {
  initialValue: string;
  initialMoodTags: string[];
  gender: string;
  name: string;
  onChange: (v: string) => void;
  onMoodTagsChange: (tags: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<string[]>(initialMoodTags);
  const [feelingText, setFeelingText] = useState(initialValue);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("ck_greeting_morning") : hour < 18 ? t("ck_greeting_afternoon") : t("ck_greeting_evening");
  const dateLabel = new Date().toLocaleDateString(getLocale(), { weekday: "long", day: "numeric", month: "long" });
  const canContinue = tags.length > 0 || feelingText.trim() !== "";

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
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#A78BFA" }}>
        {greeting}{name ? `, ${name}` : ""}
      </p>
      <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
        {dateLabel}
      </p>
      <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        {t("ck_feeling_title")}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)" }}>
        {t("ck_feeling_sub")}
      </p>

      {/* Emotion chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 22 }}>
        {MOOD_CHIPS.map((chip) => {
          const active = tags.includes(chip.id);
          const pos = chip.valence === "positive";
          return (
            <button key={chip.id} type="button" onClick={() => toggleTag(chip.id)} style={{
              padding: "9px 8px", borderRadius: 12, border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-start",
              minWidth: 0,
              transition: "all .15s ease",
              background: active
                ? pos ? "#7C5CFF" : "#FF5C5C"
                : "oklch(0.14 0.012 270)",
              backdropFilter: "blur(8px)",
              color: active ? "#fff" : "var(--foreground)",
              outline: active ? "none" : "1px solid oklch(0.5 0.12 270 / .1)",
              boxShadow: active ? "0 3px 10px -2px oklch(0.5 0.12 270 / .55)" : "none",
            }}>
              <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{chip.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {getMoodLabel(chip, gender)}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
        {t("ck_feeling_heart")}
      </p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        data-placeholder={t("ck_feeling_placeholder")}
        onInput={(e) => { const v = (e.target as HTMLElement).innerText; setFeelingText(v); onChange(v); }}
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
        }}>{t("voltar")}</button>
        <button type="button" onClick={onNext} disabled={!canContinue} style={{
          height: 48, padding: "0 24px", borderRadius: 14,
          background: canContinue ? "#7C5CFF" : "oklch(0.2 0.02 270)",
          color: canContinue ? "#fff" : "var(--text-muted)", border: 0,
          cursor: canContinue ? "pointer" : "not-allowed",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 6,
          boxShadow: canContinue ? "0 4px 14px -4px oklch(0.5 0.12 270 / .45)" : "none",
        }}>
          {t("ck_continuar")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ── Sleep Step (shown only when no sleep log exists for today) ────────────────

const SLEEP_EMOJIS: { emoji: string; labelKey: string; quality: number }[] = [
  { emoji: "😩", labelKey: "sono_qualidade_1", quality: 1 },
  { emoji: "😕", labelKey: "sono_qualidade_2", quality: 2 },
  { emoji: "😐", labelKey: "sono_qualidade_3", quality: 3 },
  { emoji: "🙂", labelKey: "sono_qualidade_4", quality: 4 },
  { emoji: "😊", labelKey: "sono_qualidade_5", quality: 5 },
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

function SleepStep({ answers, setAnswers, onNext, onSkip, onPrev }: {
  answers: CheckInAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<CheckInAnswers>>;
  onNext: () => void;
  onSkip: () => void;
  onPrev: () => void;
}) {
  const { t } = useTranslation();
  const quality = answers.sleep_quality;
  const startTime = answers.sleep_start_time;
  const endTime = answers.sleep_end_time;
  const interruptions = answers.sleep_interruptions;

  const setQuality = (q: number) => setAnswers((a) => ({ ...a, sleep_quality: q }));
  const setStartTime = (v: string) => setAnswers((a) => ({ ...a, sleep_start_time: v }));
  const setEndTime = (v: string) => setAnswers((a) => ({ ...a, sleep_end_time: v }));
  const setInterruptions = (n: number) => setAnswers((a) => ({ ...a, sleep_interruptions: n }));

  const label11 = (text: string) => (
    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
      {text}
    </p>
  );

  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🌙</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_sleep_title")}
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("ck_sleep_no_log")}
      </p>

      {/* Times */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <div style={{ flex: 1 }}>
          {label11(t("ck_fui_dormir"))}
          <div style={sleepTimeWrap}>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={sleepTimeInput} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {label11(t("ck_acordei"))}
          <div style={sleepTimeWrap}>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={sleepTimeInput} />
          </div>
        </div>
      </div>

      {/* Quality */}
      <div style={{ marginTop: 20 }}>
        {label11(t("sono_qualidade_label"))}
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          {SLEEP_EMOJIS.map(({ emoji, labelKey, quality: q }) => (
            <button key={q} type="button" onClick={() => setQuality(q)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "12px 2px", borderRadius: 14, border: 0, cursor: "pointer",
              background: quality === q ? "#7C5CFF" : "oklch(0.14 0.012 270)",
              backdropFilter: "blur(8px)",
              outline: quality === q ? "2px solid #7C5CFF" : "none",
              transition: "all .15s ease",
            }}>
              <span style={{ fontSize: 26 }}>{emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: quality === q ? "#fff" : "var(--muted-foreground)" }}>
                {t(labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Interruptions */}
      <div style={{ marginTop: 20 }}>
        {label11(t("sono_acordou_noite"))}
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setInterruptions(n)} style={{
              flex: 1, padding: "10px 4px", borderRadius: 12, border: 0, cursor: "pointer",
              background: interruptions === n ? "#7C5CFF" : "oklch(0.18 0.012 270)",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              color: interruptions === n ? "#fff" : "#A78BFA",
              transition: "all .15s ease",
            }}>
              {n === 4 ? "4+" : n === 0 ? t("nao") : `${n}×`}
            </button>
          ))}
        </div>
      </div>

      <StepFooter
        onPrev={onPrev}
        onNext={onNext}
        nextLabel={t("ck_sleep_log")}
        nextDisabled={!quality}
        secondary={
          <button type="button" onClick={onSkip} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
            textDecoration: "underline", padding: "8px 0", flexShrink: 0,
          }}>{t("ck_pular")}</button>
        }
      />
    </>
  );
}

// ── Water Step ────────────────────────────────────────────────────────────────

function WaterStep({ initialCups, onAnswer, onSkip, onPrev }: {
  initialCups: number;
  onAnswer: (cups: number) => void;
  onSkip: () => void;
  onPrev: () => void;
}) {
  const { t } = useTranslation();
  const [cups, setCups] = useState<number>(initialCups);

  return (
    <>
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_water_title")}
      </h1>
      <p style={{ margin: "0 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("ck_water_hint", { goal: String(WATER_GOAL) })}
      </p>

      <WaterCupSelector
        cups={cups}
        onChange={(n) => setCups(Math.max(0, Math.min(n, WATER_MAX)))}
      />

      <StepFooter
        onPrev={onPrev}
        onNext={() => onAnswer(cups)}
        nextLabel={cups === 0 ? t("ck_water_no") : t("ck_continuar")}
        secondary={
          <button type="button" onClick={onSkip} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, color: "var(--muted-foreground)",
            textDecoration: "underline", padding: "8px 0", flexShrink: 0,
          }}>{t("ck_pular")}</button>
        }
      />
    </>
  );
}

// ── Habits Checklist Step (vários Sim/Não numa única tela) ────────────────────

function HabitsChecklistStep({ habits, answers, context, onAnswer, onNext, onPrev }: {
  habits: string[];
  answers: CheckInAnswers;
  context: Record<string, boolean>;
  onAnswer: (key: string, value: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_habits_checklist_title")}
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("ck_habits_checklist_sub")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {habits.map((key) => {
          const base = HABIT_COPY[key] ?? { emoji: "•", labelKey: key, aKey: "sim", bKey: "nao" };
          const label = getHabitLabel(key, context);
          const value = (answers[key as keyof CheckInAnswers] as boolean) ?? false;
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 14,
              background: "oklch(0.16 0.012 270 / 0.7)", backdropFilter: "blur(8px)",
              border: "1px solid oklch(0.5 0.12 270 / .12)",
            }}>
              <span style={{ fontSize: 21, flexShrink: 0, lineHeight: 1 }}>{base.emoji}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
              <HabitToggle value={value} onChange={(v) => onAnswer(key, v)} aLabel={t(base.aKey)} bLabel={t(base.bKey)} />
            </div>
          );
        })}
      </div>

      <StepFooter onPrev={onPrev} onNext={onNext} />
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
  const { t } = useTranslation();
  const options = MEDITATION_OPTIONS.filter((o) => o.key !== "prayer" || hasFaith);
  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🧘</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_meditation_what")}
      </h1>
      <p style={{ margin: "6px 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("ck_mark_all")}
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
  const { t } = useTranslation();
  return (
    <>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🏃</div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_exercise_q")}
      </h1>
      <p style={{ margin: "6px 0 26px", fontSize: 13, color: "var(--muted-foreground)" }}>
        {t("ck_mark_all")}
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
  const { t } = useTranslation();
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
    } catch { toast.error(t("ck_erro_imagem")); }
  }, [onPhotosChange]);

  return (
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
        {t("ck_gratidao_question")}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)" }}>
        {t("ck_gratidao_placeholder")}
      </p>
      <div ref={textRef} contentEditable suppressContentEditableWarning
        data-placeholder={t("ck_gratidao_placeholder")}
        onInput={(e) => onChange((e.target as HTMLElement).innerText)}
        style={{
          outline: "none", fontSize: 16, lineHeight: 1.6, fontWeight: 400,
          color: "#e0d6ff", minHeight: 80,
          padding: "14px 16px", borderRadius: 16,
          background: "#1a1530",
          border: "1px solid rgba(167,139,250,0.25)",
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
          {t("ck_add_photo")}
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
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<boolean | null>(null);

  const choose = (v: boolean) => {
    if (chosen !== null) return;
    setChosen(v);
    onAnswer(v);
  };

  return (
    <>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {t("ck_confirm_label")}
      </p>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
        {t("ck_confirm_q")}
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
        {t("ck_confirm_sub")}
      </p>
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 8 }}>
        <button type="button" onClick={() => choose(false)} style={{
          height: 52, borderRadius: 14,
          background: chosen === false ? "#7C5CFF" : "rgba(124,92,255,0.1)",
          backdropFilter: "blur(8px)",
          border: chosen === false ? "none" : "1px solid rgba(167,139,250,0.2)",
          cursor: "pointer",
          fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: chosen === false ? "#fff" : "#7C5CFF", textAlign: "left", padding: "0 18px",
          opacity: chosen === true ? 0.4 : 1,
          boxShadow: chosen === false ? "0 4px 14px -4px oklch(0.5 0.12 270 / .5)" : "none",
          transition: "all .18s ease",
        }}>{t("ck_confirm_no")}</button>
        <button type="button" onClick={() => choose(true)} style={{
          height: 52, borderRadius: 14,
          background: chosen === true ? "rgba(255,77,77,0.35)" : "rgba(255,77,77,0.15)",
          border: "1px solid rgba(255,77,77,0.3)",
          cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 500,
          color: "#FF6B6B", textAlign: "left", padding: "0 18px",
          opacity: chosen === false ? 0.4 : 1,
          boxShadow: chosen === true ? "0 4px 14px -4px rgba(255,77,77,0.4)" : "none",
          transition: "all .18s ease",
        }}>{t("ck_confirm_yes")}</button>
      </div>
      <StepFooter onPrev={onPrev} />
    </>
  );
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 92, height: 92, marginBottom: 24 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 9999,
          background: "oklch(0.5 0.12 270 / .32)",
          animation: "ckRingPulse 1.8s ease-out infinite",
        }} />
        <div style={{
          position: "relative", width: 92, height: 92, borderRadius: 9999,
          background: "oklch(0.5 0.12 270 / .15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 12px oklch(0.5 0.12 270 / .07), 0 0 0 28px oklch(0.5 0.12 270 / .04)",
        }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none"
            stroke="#7C5CFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12 10 17 19 7" />
          </svg>
        </div>
      </div>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em" }}>{t("ck_done_title")}</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--muted-foreground)" }}>{t("ck_done_sub")}</p>
      <button type="button" onClick={onFinish} style={{
        marginTop: 28, height: 52, padding: "0 28px", borderRadius: 14,
        background: "#7C5CFF", color: "#fff", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 15, fontWeight: 600,
        boxShadow: "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
      }}>{t("ck_go_dashboard")}</button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckInPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [userName, setUserName] = useState("");

  const savedRef = useRef(false);
  const latestAnswers = useRef<CheckInAnswers>(defaultAnswers());
  latestAnswers.current = answers;
  // Snapshot do check-in carregado (para o botão "Salvar alterações" só habilitar
  // quando houver mudança real).
  const originalRef = useRef<CheckInAnswers>(defaultAnswers());

  useEffect(() => {
    const today = getLocalDate();
    Promise.all([
      fetch("/api/preferences").then((r) => r.json()).catch(() => ({})),
      fetch(`/api/check-ins?date=${today}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/sleep?from=${today}&to=${today}&limit=1`).then((r) => r.json()).catch(() => []),
      fetch(`/api/running?from=${today}&to=${today}`).then((r) => r.json()).catch(() => []),
      fetch("/api/profile").then((r) => r.json()).catch(() => ({})),
    ]).then(([prefs, existing, sleepLogs, runningSessions, profile]) => {
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
      setUserName((((profile?.name as string) || "").trim().split(/\s+/)[0]) ?? "");
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
        if (hasSleepLog) next.slept_well = (sleepLogs[0]?.quality ?? 0) >= SLEPT_WELL_MIN_QUALITY;
        originalRef.current = next; // base para detectar alterações
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
          t("ck_cvv"),
          { duration: 12000 }
        );
      }
      invalidateFetchCache("/api/check-ins");
      invalidateFetchCache("/api/maya");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("ck_erro_salvar"));
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

  // Marca/desmarca um hábito do checklist — não avança (o usuário marca vários).
  const handleHabitSet = useCallback((key: string, value: boolean) => {
    setAnswers((a) => ({ ...a, [key]: value }));
  }, []);

  // Toggle de chips multi-select (meditação/exercício) — não avança sozinho.
  const handleToggle = useCallback((key: string) => {
    setAnswers((a) => ({ ...a, [key]: !(a[key as keyof CheckInAnswers] as boolean) }));
  }, []);

  const handleWaterAnswer = useCallback((cups: number) => {
    setAnswers((a) => ({ ...a, water_cups: cups, drank_water: cups >= WATER_GOAL }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 150);
  }, [steps.length]);

  const handleSleepAnswer = useCallback(() => {
    setAnswers((a) => ({ ...a, slept_well: (a.sleep_quality ?? 0) >= SLEPT_WELL_MIN_QUALITY }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 150);
  }, [steps.length]);

  const handleSleepSkip = useCallback(() => {
    setAnswers((a) => ({ ...a, sleep_quality: 3, slept_well: false }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 150);
  }, [steps.length]);

  const handleConfirmAnswer = useCallback((value: boolean) => {
    setAnswers((a) => ({ ...a, suicidal_thoughts: value }));
    setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), 320);
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
          interruptions: data.sleep_interruptions ?? 0,
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
            t("ck_cvv"),
            { duration: 12000 }
          );
        }
      })
      .catch(() => {});

  }, [isDone]);

  // ── Render ──────────────────────────────────────────────────────────────────

  // Houve alguma alteração em relação ao check-in carregado?
  const dirty = !answersEqual(answers, originalRef.current);

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
        dirty={dirty}
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
        name={userName}
        onChange={(v) => setAnswers((a) => ({ ...a, feeling: v }))}
        onMoodTagsChange={(tags) => setAnswers((a) => ({ ...a, mood_tags: tags }))}
        onNext={goNext} onPrev={goPrev}
      />
    );
    if (cur.kind === "sleep") return (
      <SleepStep answers={answers} setAnswers={setAnswers} onNext={handleSleepAnswer} onSkip={handleSleepSkip} onPrev={goPrev} />
    );
    if (cur.kind === "water") return (
      <WaterStep initialCups={answers.water_cups} onAnswer={handleWaterAnswer} onSkip={goNext} onPrev={goPrev} />
    );
    if (cur.kind === "habits") return (
      <HabitsChecklistStep
        habits={SIMPLE_HABITS.filter((k) => enabledKeys.includes(k))}
        answers={answers}
        context={context}
        onAnswer={handleHabitSet}
        onNext={goNext}
        onPrev={goPrev}
      />
    );
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
    if (cur.kind === "done") return (
      <DoneStep onFinish={() => {
        invalidateFetchCache("/api/check-ins");
        invalidateFetchCache("/api/maya");
        router.push("/dashboard");
        router.refresh();
      }} />
    );
    return null;
  };

  return (
    <CheckInStage stepIdx={stepIdx} totalForProgress={totalForProgress}
      isDone={isDone} onClose={() => router.push("/dashboard")}>
      {renderStep()}
    </CheckInStage>
  );
}
