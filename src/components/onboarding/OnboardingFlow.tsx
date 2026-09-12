"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUserTimezone } from "@/lib/utils";
import { defaultAnswers, WaterCupSelector, WATER_GOAL, ML_PER_CUP } from "@/components/CheckInEditor";
import { requestPushSubscription } from "@/lib/push-utils";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { useInstallPrompt, IosGuide } from "@/components/InstallAppCard";
import { LANG_OPTIONS, t as translate, type Lang } from "@/lib/i18n";
import { setLanguage } from "@/lib/language";

// ── Design tokens (mesmos do check-in) ────────────────────────────────────────

const ACCENT = "#7C5CFF";
const ACCENT_2 = "#A78BFA";
const BG = "oklch(0.12 0.012 270)";
const CARD = "oklch(0.16 0.012 270)";
const BORDER = "oklch(0.28 0.02 270 / 0.5)";
const MUTED = "oklch(0.55 0.03 270)";
const TEXT = "#e0d6ff";

const tr = (lang: string, key: string, vars?: Record<string, string>) =>
  translate(lang as Lang, key, vars);

// ── Conteúdo do questionário ──────────────────────────────────────────────────

const GOALS = [
  { id: "sono", emoji: "😴", labelKey: "ob_goal_sono" },
  { id: "leveza", emoji: "😌", labelKey: "ob_goal_leveza" },
  { id: "alimentacao", emoji: "🥗", labelKey: "ob_goal_alimentacao" },
  { id: "meta", emoji: "🎯", labelKey: "ob_goal_meta" },
  { id: "dinheiro", emoji: "💰", labelKey: "ob_goal_dinheiro" },
  { id: "movimento", emoji: "🏃", labelKey: "ob_goal_movimento" },
  { id: "equilibrio", emoji: "🌱", labelKey: "ob_goal_equilibrio" },
];

const PAINS = [
  { id: "nao_sei", emoji: "🤷", labelKey: "ob_pain_nao_sei" },
  { id: "espalhado", emoji: "🧩", labelKey: "ob_pain_espalhado" },
  { id: "sem_tempo", emoji: "⏰", labelKey: "ob_pain_sem_tempo" },
  { id: "desisto", emoji: "🔁", labelKey: "ob_pain_desisto" },
  { id: "sem_rumo", emoji: "🧭", labelKey: "ob_pain_sem_rumo" },
  { id: "sem_progresso", emoji: "📉", labelKey: "ob_pain_sem_progresso" },
  { id: "sozinho", emoji: "🕳️", labelKey: "ob_pain_sozinho" },
];

const TINDER_CARDS = ["ob_tinder_1", "ob_tinder_2", "ob_tinder_3", "ob_tinder_4"];

const AREAS = [
  { id: "sono", emoji: "😴", labelKey: "ob_area_sono" },
  { id: "humor", emoji: "😊", labelKey: "ob_area_humor" },
  { id: "habitos", emoji: "✅", labelKey: "ob_area_habitos" },
  { id: "metas", emoji: "🎯", labelKey: "ob_area_metas" },
  { id: "dinheiro", emoji: "💰", labelKey: "ob_area_dinheiro" },
  { id: "alimentacao", emoji: "🥗", labelKey: "ob_area_alimentacao" },
  { id: "movimento", emoji: "🏃", labelKey: "ob_area_movimento" },
  { id: "leitura", emoji: "📖", labelKey: "ob_area_leitura" },
];

// Hábitos do check-in de demonstração (mapeiam para campos reais do CheckInAnswers).
const DEMO_HABITS = [
  { key: "slept_well", emoji: "😴", labelKey: "ob_demo_slept_well" },
  { key: "meditation", emoji: "🧘", labelKey: "ob_demo_meditation" },
  { key: "walked", emoji: "🏃", labelKey: "ob_demo_walked" },
  { key: "creative_activity", emoji: "🎨", labelKey: "ob_demo_creative" },
  { key: "read", emoji: "📖", labelKey: "ob_demo_read" },
  { key: "did_something_enjoyable", emoji: "😊", labelKey: "ob_demo_enjoyable" },
];

const GENDER_OPTIONS = [
  { id: "masculino", labelKey: "ob_gender_masc", emoji: "⚡" },
  { id: "feminino", labelKey: "ob_gender_fem", emoji: "🌸" },
  { id: "nao_dizer", labelKey: "ob_gender_nao_dizer", emoji: "🌱" },
] as const;

const CONTEXT_QUESTIONS = [
  { id: "has_medication", qKey: "q_medicacao", dKey: "q_medicacao_desc" },
  { id: "has_faith", qKey: "q_fe", dKey: "q_fe_desc" },
  { id: "has_creative_hobby", qKey: "q_criatividade", dKey: "q_criatividade_desc" },
  { id: "track_suicidal_thoughts", qKey: "q_suicida", dKey: "q_suicida_desc", defaultVal: true },
];

const STEPS = [
  "welcome", "goal", "pain", "social", "tinder", "solution", "comparison",
  "preferences", "about", "processing", "demo", "value", "notifications", "install",
] as const;

// ── Shared UI ─────────────────────────────────────────────────────────────────

function ProgressBar({ stepIdx, total, lang }: { stepIdx: number; total: number; lang: string }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30, padding: "16px 24px 0" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", maxWidth: 460, margin: "0 auto" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 9999,
            background: i <= stepIdx ? ACCENT : "oklch(0.5 0.12 270 / .15)",
            transition: "background .3s ease",
          }} />
        ))}
      </div>
      <p style={{
        margin: "8px 0 0", textAlign: "center", fontSize: 10,
        color: MUTED, letterSpacing: ".16em", textTransform: "uppercase",
      }}>
        {String(stepIdx + 1).padStart(2, "0")} {tr(lang, "ob_de")} {String(total).padStart(2, "0")}
      </p>
    </div>
  );
}

function BackButton({ lang, onClick }: { lang: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={tr(lang, "ob_back")} style={{
      position: "fixed", top: 44, left: 16, zIndex: 31,
      width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
      background: "oklch(0.16 0.012 270 / 0.85)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: TEXT, boxShadow: "0 1px 3px oklch(0.28 0.02 270 / .06)",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

function Footer({ lang, onPrev, onNext, nextLabel, nextDisabled, secondary }: {
  lang: string;
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  secondary?: React.ReactNode;
}) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      padding: "12px 24px calc(18px + env(safe-area-inset-bottom))",
      background: `linear-gradient(180deg, transparent 0%, ${BG} 30%, ${BG} 100%)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 460, margin: "0 auto" }}>
        {onPrev && (
          <button type="button" onClick={onPrev} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: MUTED, padding: "8px 0", flexShrink: 0,
          }}>{tr(lang, "voltar")}</button>
        )}
        {secondary}
        <div style={{ flex: 1 }} />
        {onNext && (
          <button type="button" onClick={onNext} disabled={nextDisabled} style={{
            height: 48, padding: "0 22px", borderRadius: 14, border: 0,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            background: nextDisabled ? "oklch(0.2 0.02 270)" : `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`,
            color: nextDisabled ? MUTED : "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 700, flexShrink: 0,
            boxShadow: nextDisabled ? "none" : "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
          }}>{nextLabel ?? tr(lang, "ob_continue")}</button>
        )}
      </div>
    </div>
  );
}

function OptionButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      width: "100%", minHeight: 54, borderRadius: 14, border: 0, cursor: "pointer",
      fontFamily: "inherit", fontSize: 14.5, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
      textAlign: "left", transition: "all .15s ease",
      background: active ? "oklch(0.5 0.12 270 / .18)" : CARD,
      backdropFilter: "blur(8px)",
      color: active ? TEXT : "oklch(0.85 0.02 270)",
      outline: active ? `2px solid oklch(0.5 0.12 270 / .5)` : `1px solid ${BORDER}`,
      boxShadow: active ? "0 3px 10px -2px oklch(0.5 0.12 270 / .55)" : "0 1px 3px oklch(0.2 0.02 270 / .06)",
    }}>
      {children}
    </button>
  );
}

function Section({ eyebrow, title, sub, children }: {
  eyebrow?: string;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      {eyebrow && <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED }}>{eyebrow}</p>}
      <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, color: TEXT }}>{title}</h1>
      {sub && <p style={{ margin: "0 0 22px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{sub}</p>}
      {children}
    </div>
  );
}

// ── Telas ─────────────────────────────────────────────────────────────────────

function WelcomeScreen({ lang, setLang, onNext }: {
  lang: string;
  setLang: (l: string) => void;
  onNext: () => void;
}) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontSize: 84, lineHeight: 1 }}>🪷</div>
      <h1 style={{ margin: "4px 0 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1,
        background: `linear-gradient(135deg, ${ACCENT_2}, #5EEAD4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        {tr(lang, "ob_welcome_title_a")}<br />{tr(lang, "ob_welcome_title_b")}
      </h1>
      <p style={{ margin: "0", fontSize: 15, color: TEXT, lineHeight: 1.65 }}>
        {tr(lang, "ob_welcome_sub")}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        {LANG_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" onClick={() => setLang(opt.id)} style={{
            padding: "9px 16px", borderRadius: 9999, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            background: lang === opt.id ? ACCENT : CARD,
            color: lang === opt.id ? "#fff" : MUTED,
            transition: "all .15s ease",
          }}>{opt.flag} {opt.label}</button>
        ))}
      </div>

      <button type="button" onClick={onNext} style={{
        marginTop: 26, width: "100%", height: 54, borderRadius: 16, border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 15.5, fontWeight: 700,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff",
        boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
      }}>{tr(lang, "comecar")}</button>
    </div>
  );
}

function GoalScreen({ lang, goal, setGoal, onNext, onPrev }: {
  lang: string; goal: string; setGoal: (g: string) => void; onNext: () => void; onPrev: () => void;
}) {
  return (
    <>
      <Section title={tr(lang, "ob_goal_title")} sub={tr(lang, "ob_goal_sub")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GOALS.map((g) => (
          <OptionButton key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>
            <span style={{ fontSize: 20 }}>{g.emoji}</span>{tr(lang, g.labelKey)}
          </OptionButton>
        ))}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={goal ? onNext : undefined} nextDisabled={!goal} />
    </>
  );
}

function PainScreen({ lang, pains, togglePain, onNext, onPrev }: {
  lang: string;
  pains: string[];
  togglePain: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <Section title={tr(lang, "ob_pain_title")} sub={tr(lang, "ob_pain_sub")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PAINS.map((p) => (
          <OptionButton key={p.id} active={pains.includes(p.id)} onClick={() => togglePain(p.id)}>
            <span style={{ fontSize: 20 }}>{p.emoji}</span>{tr(lang, p.labelKey)}
          </OptionButton>
        ))}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function SocialScreen({ lang, onNext, onPrev }: { lang: string; onNext: () => void; onPrev: () => void }) {
  const testimonials = [
    { text: tr(lang, "ob_social_t1_text"), name: "Marina, 34", tag: tr(lang, "ob_social_t1_tag") },
    { text: tr(lang, "ob_social_t2_text"), name: "Diego, 41", tag: tr(lang, "ob_social_t2_tag") },
    { text: tr(lang, "ob_social_t3_text"), name: "Camila, 27", tag: tr(lang, "ob_social_t3_tag") },
  ];
  return (
    <>
      <Section title={tr(lang, "ob_social_title")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {testimonials.map((t) => (
          <div key={t.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14.5, color: TEXT, lineHeight: 1.5 }}>“{t.text}”</p>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: ACCENT_2 }}>{t.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: MUTED }}>{t.tag}</p>
          </div>
        ))}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function TinderScreen({ lang, idx, onAgree, onDismiss, onPrev }: {
  lang: string;
  idx: number;
  onAgree: () => void;
  onDismiss: () => void;
  onPrev: () => void;
}) {
  const total = TINDER_CARDS.length;
  if (idx >= total) return null;
  return (
    <>
      <Section
        eyebrow={`${idx + 1} ${tr(lang, "ob_de")} ${total}`}
        title={tr(lang, "ob_tinder_title")}
        sub={tr(lang, "ob_tinder_sub")}
      />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "28px 24px", minHeight: 160, display: "flex", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TEXT, lineHeight: 1.5 }}>
          “{tr(lang, TINDER_CARDS[idx])}”
        </p>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
        <button type="button" onClick={onDismiss} style={{
          flex: 1, height: 56, borderRadius: 16, border: `1px solid ${BORDER}`, cursor: "pointer",
          background: CARD, color: MUTED, fontSize: 26, fontFamily: "inherit",
        }}>✗</button>
        <button type="button" onClick={onAgree} style={{
          flex: 1, height: 56, borderRadius: 16, border: 0, cursor: "pointer",
          background: ACCENT, color: "#fff", fontSize: 26, fontFamily: "inherit",
          boxShadow: "0 4px 14px -4px oklch(0.5 0.12 270 / .45)",
        }}>✓</button>
      </div>
      <Footer lang={lang} onPrev={onPrev} />
    </>
  );
}

function SolutionScreen({ lang, pains, onNext, onPrev }: {
  lang: string;
  pains: string[];
  onNext: () => void;
  onPrev: () => void;
}) {
  const solutions: Record<string, { emoji: string; pain: string; fix: string }> = {
    nao_sei: { emoji: "🤷", pain: "ob_sol_nao_sei_pain", fix: "ob_sol_nao_sei_fix" },
    desisto: { emoji: "🔁", pain: "ob_sol_desisto_pain", fix: "ob_sol_desisto_fix" },
    espalhado: { emoji: "🧩", pain: "ob_sol_espalhado_pain", fix: "ob_sol_espalhado_fix" },
    sem_rumo: { emoji: "🧭", pain: "ob_sol_sem_rumo_pain", fix: "ob_sol_sem_rumo_fix" },
    sem_tempo: { emoji: "⏰", pain: "ob_sol_sem_tempo_pain", fix: "ob_sol_sem_tempo_fix" },
    sem_progresso: { emoji: "📉", pain: "ob_sol_sem_progresso_pain", fix: "ob_sol_sem_progresso_fix" },
    sozinho: { emoji: "🕳️", pain: "ob_sol_sozinho_pain", fix: "ob_sol_sozinho_fix" },
  };
  const keys = pains.length > 0 ? pains : ["nao_sei", "desisto", "espalhado", "sem_rumo"];
  return (
    <>
      <Section title={tr(lang, "ob_solution_title")} sub={tr(lang, "ob_solution_sub")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {keys.filter((k) => solutions[k]).map((k) => {
          const s = solutions[k];
          return (
            <div key={k} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: MUTED }}>{s.emoji} {tr(lang, s.pain)}</p>
              <p style={{ margin: 0, fontSize: 14.5, color: TEXT, fontWeight: 600, lineHeight: 1.45 }}>{tr(lang, s.fix)}</p>
            </div>
          );
        })}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function ComparisonScreen({ lang, onNext, onPrev }: { lang: string; onNext: () => void; onPrev: () => void }) {
  const rows = [
    { withMaya: "ob_compare_r1_with", without: "ob_compare_r1_without" },
    { withMaya: "ob_compare_r2_with", without: "ob_compare_r2_without" },
    { withMaya: "ob_compare_r3_with", without: "ob_compare_r3_without" },
    { withMaya: "ob_compare_r4_with", without: "ob_compare_r4_without" },
  ];
  return (
    <>
      <Section title={tr(lang, "ob_compare_title")} />
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#5EEAD4" }}>{tr(lang, "ob_compare_with")}</div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: MUTED }}>{tr(lang, "ob_compare_without")}</div>
      </div>
      {rows.map((r) => (
        <div key={r.withMaya} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, background: "oklch(0.5 0.12 270 / .12)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#5EEAD4", fontWeight: 800 }}>✓</span>
            <span style={{ fontSize: 13.5, color: TEXT }}>{tr(lang, r.withMaya)}</span>
          </div>
          <div style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "oklch(0.72 0.1 30)", fontWeight: 800 }}>✗</span>
            <span style={{ fontSize: 13.5, color: MUTED }}>{tr(lang, r.without)}</span>
          </div>
        </div>
      ))}
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function PreferencesScreen({ lang, areas, toggleArea, onNext, onPrev }: {
  lang: string;
  areas: string[];
  toggleArea: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <Section title={tr(lang, "ob_prefs_title")} sub={tr(lang, "ob_prefs_sub")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {AREAS.map((a) => (
          <button key={a.id} type="button" onClick={() => toggleArea(a.id)} style={{
            minHeight: 74, borderRadius: 14, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 8px", transition: "all .15s ease",
            background: areas.includes(a.id) ? "oklch(0.5 0.12 270 / .18)" : CARD,
            color: areas.includes(a.id) ? TEXT : MUTED,
            outline: areas.includes(a.id) ? `2px solid oklch(0.5 0.12 270 / .5)` : `1px solid ${BORDER}`,
          }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>{a.emoji}</span>
            <span>{tr(lang, a.labelKey)}</span>
          </button>
        ))}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} nextDisabled={areas.length === 0} />
    </>
  );
}

function AboutScreen({ gender, setGender, ctx, setCtxValue, lang, onNext, onPrev }: {
  gender: string;
  setGender: (g: string) => void;
  ctx: Record<string, boolean>;
  setCtxValue: (id: string, value: boolean) => void;
  lang: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <Section title={tr(lang, "ob_about_title")} sub={tr(lang, "ob_about_sub")} />

      <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: TEXT }}>{tr(lang, "ob_about_gender")}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {GENDER_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" onClick={() => setGender(opt.id)} style={{
            flex: 1, padding: "12px 6px", borderRadius: 12, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
            background: gender === opt.id ? ACCENT : CARD,
            color: gender === opt.id ? "#fff" : MUTED,
            outline: gender === opt.id ? "none" : `1px solid ${BORDER}`,
            transition: "all .15s ease",
          }}>{opt.emoji} {tr(lang, opt.labelKey)}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CONTEXT_QUESTIONS.map((q) => (
          <div key={q.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: TEXT }}>{translate(lang as Lang, q.qKey)}</p>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{translate(lang as Lang, q.dKey)}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setCtxValue(q.id, true)} style={{
                flex: 1, height: 40, borderRadius: 10, border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                background: ctx[q.id] ? ACCENT : CARD, color: ctx[q.id] ? "#fff" : ACCENT,
                outline: ctx[q.id] ? "none" : `1px solid ${BORDER}`,
              }}>{translate(lang as Lang, "sim")}</button>
              <button type="button" onClick={() => setCtxValue(q.id, false)} style={{
                flex: 1, height: 40, borderRadius: 10, border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                background: !ctx[q.id] ? "#FF5C5C" : CARD,
                color: !ctx[q.id] ? "#fff" : ACCENT,
                outline: `1px solid ${BORDER}`,
              }}>{translate(lang as Lang, "nao")}</button>
            </div>
          </div>
        ))}
      </div>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function ProcessingScreen({ lang }: { lang: string }) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{
        width: 92, height: 92, borderRadius: 9999,
        background: "oklch(0.5 0.12 270 / .15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 0 12px oklch(0.5 0.12 270 / .07), 0 0 0 28px oklch(0.5 0.12 270 / .04)",
        animation: "obPulse 2s ease-in-out infinite",
      }}>
        <span style={{ fontSize: 38 }}>✨</span>
      </div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>{tr(lang, "ob_processing_title")}</h1>
      <p style={{ margin: 0, fontSize: 14, color: MUTED }}>{tr(lang, "ob_processing_sub")}</p>
      <style>{`@keyframes obPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
    </div>
  );
}

function DemoStep({ lang, selected, toggle, waterCups, setWaterCups, onNext, onPrev }: {
  lang: string;
  selected: Set<string>;
  toggle: (key: string) => void;
  waterCups: number;
  setWaterCups: (n: number) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const n = selected.size;
  return (
    <>
      <Section title={tr(lang, "ob_demo_title")} sub={tr(lang, "ob_demo_sub")} />

      {/* Água em copos */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 21, flexShrink: 0, lineHeight: 1 }}>🥛</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: TEXT }}>{tr(lang, "ob_demo_water_label")}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: waterCups >= WATER_GOAL ? "#5EEAD4" : MUTED }}>
            {waterCups * ML_PER_CUP}ml{waterCups >= WATER_GOAL ? " ✓" : ""}
          </span>
        </div>
        <WaterCupSelector cups={waterCups} size={42} onChange={setWaterCups} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DEMO_HABITS.map((h) => {
          const active = selected.has(h.key);
          return (
            <button key={h.key} type="button" onClick={() => toggle(h.key)} style={{
              minHeight: 76, borderRadius: 14, border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 8px", transition: "all .15s ease",
              background: active ? "oklch(0.5 0.12 270 / .18)" : CARD,
              color: active ? TEXT : MUTED,
              outline: active ? `2px solid oklch(0.5 0.12 270 / .5)` : `1px solid ${BORDER}`,
            }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>{h.emoji}</span>
              <span>{tr(lang, h.labelKey)}</span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13, color: MUTED }}>
        {n > 0 || waterCups > 0 ? tr(lang, "ob_demo_ready") : tr(lang, "ob_demo_sub")}
      </p>
      <Footer lang={lang} onPrev={onPrev} onNext={onNext} nextLabel={tr(lang, "ob_demo_done")} />
    </>
  );
}

function ValueStep({ lang, selected, waterCups, onNext }: {
  lang: string;
  selected: Set<string>;
  waterCups: number;
  onNext: () => void;
}) {
  const items = DEMO_HABITS.filter((h) => selected.has(h.key));
  if (waterCups > 0) items.unshift({ key: "drank_water", emoji: "🥛", labelKey: "ob_demo_water" });
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🎉</div>
      <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", color: TEXT }}>
        {tr(lang, items.length === 1 ? "ob_value_one" : "ob_value_many", { n: String(items.length) })}
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        {tr(lang, "ob_value_sub")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        {items.map((h) => (
          <span key={h.key} style={{ padding: "8px 14px", borderRadius: 9999, background: CARD, border: `1px solid ${BORDER}`, fontSize: 13.5, color: TEXT }}>
            {h.emoji} {tr(lang, h.labelKey)}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" onClick={onNext} style={{
          width: "100%", height: 54, borderRadius: 16, border: 0, cursor: "pointer",
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff",
          fontFamily: "inherit", fontSize: 15.5, fontWeight: 700,
          boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
        }}>{tr(lang, "ob_continue")}</button>
      </div>
    </div>
  );
}

function NotificationsStep({ lang, onEnable, onSkip, loading }: {
  lang: string;
  onEnable: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  return (
    <>
      <Section title={tr(lang, "ob_notif_title")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
        {[
          ["🔔", "ob_notif_1"],
          ["💛", "ob_notif_2"],
          ["🚫", "ob_notif_3"],
        ].map(([e, txt]) => (
          <div key={txt} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{e}</span>
            <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{tr(lang, txt)}</span>
          </div>
        ))}
      </div>
      <Footer
        lang={lang}
        onNext={onEnable}
        nextLabel={loading ? tr(lang, "ob_notif_activating") : tr(lang, "ob_notif_enable")}
        nextDisabled={loading}
        secondary={
          <button type="button" onClick={onSkip} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: MUTED, padding: "8px 0", flexShrink: 0,
          }}>{tr(lang, "ob_now_not")}</button>
        }
      />
    </>
  );
}

function InstallStep({ lang, onNext }: { lang: string; onNext: () => void }) {
  const { deferred, ios, installed, handleInstall } = useInstallPrompt();
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);

  // Já instalado (aberto em modo standalone) → pula automaticamente.
  useEffect(() => {
    if (installed) onNext();
  }, [installed, onNext]);

  const primary = async () => {
    if (ios) { setShowGuide(true); return; }
    if (deferred) {
      setLoading(true);
      await handleInstall();
      setLoading(false);
      onNext();
      return;
    }
    onNext();
  };

  const label = ios ? tr(lang, "ob_install_how") : deferred ? tr(lang, "ob_install_app") : tr(lang, "ob_continue");

  return (
    <>
      <Section title={tr(lang, "ob_install_title")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
        {[
          ["📱", "ob_install_1"],
          ["⚡", "ob_install_2"],
          ["🔔", "ob_install_3"],
        ].map(([e, txt]) => (
          <div key={txt} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{e}</span>
            <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{tr(lang, txt)}</span>
          </div>
        ))}
      </div>
      <Footer
        lang={lang}
        onNext={primary}
        nextLabel={loading ? tr(lang, "ob_install_installing") : label}
        nextDisabled={loading}
        secondary={
          <button type="button" onClick={onNext} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: MUTED, padding: "8px 0", flexShrink: 0,
          }}>{tr(lang, "ob_now_not")}</button>
        }
      />
      {showGuide && <IosGuide onClose={() => setShowGuide(false)} onDone={onNext} />}
    </>
  );
}

// ── Fluxo principal ───────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const [goal, setGoal] = useState("");
  const [pains, setPains] = useState<string[]>([]);
  const [tinderIdx, setTinderIdx] = useState(0);
  const [tinderAgreed, setTinderAgreed] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [gender, setGender] = useState("nao_dizer");
  const [lang, setLang] = useState("pt");
  const [ctx, setCtx] = useState<Record<string, boolean>>({
    has_medication: false,
    has_faith: false,
    has_creative_hobby: false,
    track_suicidal_thoughts: true,
  });
  const [demo, setDemo] = useState<Set<string>>(new Set());
  const [waterCups, setWaterCups] = useState(0);
  const savedRef = useRef(false);

  const step = STEPS[stepIdx];

  // Redireciona se já completou o onboarding
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.onboarding_completed) router.push("/dashboard");
      })
      .catch(() => {});
  }, [router]);

  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), []);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);

  const togglePain = (id: string) => setPains((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleArea = (id: string) => setAreas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const toggleDemo = (key: string) => setDemo((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const setCtxValue = (id: string, value: boolean) => setCtx((c) => ({ ...c, [id]: value }));

  // Cards Tinder: avançam automaticamente até esgotar
  const handleTinderAgree = () => {
    setTinderAgreed((a) => (a.includes(TINDER_CARDS[tinderIdx]) ? a : [...a, TINDER_CARDS[tinderIdx]]));
    if (tinderIdx >= TINDER_CARDS.length - 1) goNext();
    else setTinderIdx((i) => i + 1);
  };
  const handleTinderDismiss = () => {
    if (tinderIdx >= TINDER_CARDS.length - 1) goNext();
    else setTinderIdx((i) => i + 1);
  };

  // Processamento: avança sozinho
  useEffect(() => {
    if (step !== "processing") return;
    const t = setTimeout(goNext, 1800);
    return () => clearTimeout(t);
  }, [step, goNext]);

  const handleEnableNotifications = async () => {
    setNotifLoading(true);
    try {
      const { sub } = await requestPushSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...sub.toJSON(), timezone: getUserTimezone() }),
        });
        toast.success("Lembretes ativados! 🔔");
      }
    } catch {}
    setNotifLoading(false);
    goNext();
  };

  // Salva o check-in da demo quando o usuário conclui a etapa 11 (demo).
  const saveDemoCheckIn = useCallback(() => {
    if (savedRef.current || (demo.size === 0 && waterCups === 0)) return;
    savedRef.current = true;
    const answers = defaultAnswers();
    for (const h of DEMO_HABITS) {
      if (demo.has(h.key)) (answers as unknown as Record<string, boolean>)[h.key] = true;
    }
    answers.water_cups = waterCups;
    answers.drank_water = waterCups >= WATER_GOAL;
    fetch("/api/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    }).catch(() => {});
  }, [demo, waterCups]);

  // Completa o onboarding: salva, inicia o trial local (7 dias, sem cartão) e entra no dashboard.
  const handleFinish = async () => {
    // 1. Garante o check-in da demo salvo
    saveDemoCheckIn();

    // 2. Monta enabled_questions (mesmo padrão do onboarding anterior)
    const enabled = [
      "felt_judged", "talked_to_someone", "meditation", "breathing", "creative_activity",
      "ate_well", "bowel_movement", "walked", "ran", "strength_training", "read",
      "drank_water", "slept_well", "did_something_enjoyable", "worked_on_goals",
    ];
    if (ctx.has_medication) enabled.push("took_medication");
    if (ctx.has_faith) enabled.push("prayer");
    if (ctx.track_suicidal_thoughts) enabled.push("suicidal_thoughts");

    const context = {
      ...ctx,
      gender,
      language: lang,
      community_name: `Anônimo${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const onboarding = {
      goal,
      pain_points: pains,
      tinder_agreed: tinderAgreed,
      area_preferences: areas,
      gender,
      language: lang,
      ...ctx,
      // TODO: capturar utm_source/utm_campaign do cadastro quando houver atribuição de anúncios
    };

    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled_questions: enabled,
        context,
        onboarding_completed: true,
        onboarding,
      }),
    });

    if (!res.ok) throw new Error("save");

    // 3. Inicia o trial local (sem cartão) — best-effort: se falhar, o gate mostra o paywall.
    try {
      await fetch("/api/subscription/trial", { method: "POST" });
    } catch {}

    setLanguage(lang as Lang);
    invalidateFetchCache("/api/check-ins");
    router.push("/dashboard");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const showProgress = step !== "welcome";
  const showBack = stepIdx > 0 && step !== "processing" && step !== "value" && step !== "notifications" && step !== "install";

  return (
    <main style={{
      minHeight: "100dvh", background: BG, color: TEXT,
      fontFamily: "var(--font-sans)", overflowX: "hidden", position: "relative",
    }}>
      {showProgress && <ProgressBar stepIdx={stepIdx} total={STEPS.length} lang={lang} />}
      {showBack && <BackButton lang={lang} onClick={goPrev} />}

      <div style={{
        minHeight: "100dvh", boxSizing: "border-box", maxWidth: 460, margin: "0 auto",
        padding: "110px 26px 140px",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        {step === "welcome" && <WelcomeScreen lang={lang} setLang={setLang} onNext={goNext} />}
        {step === "goal" && <GoalScreen lang={lang} goal={goal} setGoal={setGoal} onNext={goNext} onPrev={goPrev} />}
        {step === "pain" && <PainScreen lang={lang} pains={pains} togglePain={togglePain} onNext={goNext} onPrev={goPrev} />}
        {step === "social" && <SocialScreen lang={lang} onNext={goNext} onPrev={goPrev} />}
        {step === "tinder" && (
          <TinderScreen lang={lang} idx={tinderIdx} onAgree={handleTinderAgree} onDismiss={handleTinderDismiss} onPrev={goPrev} />
        )}
        {step === "solution" && <SolutionScreen lang={lang} pains={pains} onNext={goNext} onPrev={goPrev} />}
        {step === "comparison" && <ComparisonScreen lang={lang} onNext={goNext} onPrev={goPrev} />}
        {step === "preferences" && <PreferencesScreen lang={lang} areas={areas} toggleArea={toggleArea} onNext={goNext} onPrev={goPrev} />}
        {step === "about" && (
          <AboutScreen
            gender={gender} setGender={setGender} ctx={ctx} setCtxValue={setCtxValue}
            lang={lang} onNext={goNext} onPrev={goPrev}
          />
        )}
        {step === "processing" && <ProcessingScreen lang={lang} />}
        {step === "demo" && <DemoStep lang={lang} selected={demo} toggle={toggleDemo} waterCups={waterCups} setWaterCups={setWaterCups} onNext={() => { saveDemoCheckIn(); goNext(); }} onPrev={goPrev} />}
        {step === "value" && <ValueStep lang={lang} selected={demo} waterCups={waterCups} onNext={goNext} />}
        {step === "notifications" && <NotificationsStep lang={lang} onEnable={handleEnableNotifications} onSkip={goNext} loading={notifLoading} />}
        {step === "install" && <InstallStep lang={lang} onNext={handleFinish} />}
      </div>
    </main>
  );
}
