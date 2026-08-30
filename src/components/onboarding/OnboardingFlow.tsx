"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUserTimezone } from "@/lib/utils";
import { defaultAnswers } from "@/components/CheckInEditor";
import { requestPushSubscription } from "@/lib/push-utils";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { Paywall } from "@/components/Paywall";
import { LANG_OPTIONS, t as translate, type Lang } from "@/lib/i18n";

// ── Design tokens (mesmos do check-in) ────────────────────────────────────────

const ACCENT = "#7C5CFF";
const ACCENT_2 = "#A78BFA";
const BG = "oklch(0.12 0.012 270)";
const CARD = "oklch(0.16 0.012 270)";
const BORDER = "oklch(0.28 0.02 270 / 0.5)";
const MUTED = "oklch(0.55 0.03 270)";
const TEXT = "#e0d6ff";

// ── Conteúdo do questionário ──────────────────────────────────────────────────

const GOALS = [
  { id: "sono", emoji: "😴", label: "Dormir melhor" },
  { id: "leveza", emoji: "😌", label: "Me sentir mais leve" },
  { id: "alimentacao", emoji: "🥗", label: "Comer melhor" },
  { id: "meta", emoji: "🎯", label: "Alcançar uma meta" },
  { id: "dinheiro", emoji: "💰", label: "Organizar meu dinheiro" },
  { id: "movimento", emoji: "🏃", label: "Me movimentar mais" },
  { id: "equilibrio", emoji: "🌱", label: "Equilíbrio no geral" },
];

const PAINS = [
  { id: "nao_sei", emoji: "🤷", label: "Não sei o que funciona pra mim" },
  { id: "espalhado", emoji: "🧩", label: "Minha vida está espalhada" },
  { id: "sem_tempo", emoji: "⏰", label: "Sem tempo / esqueço de me cuidar" },
  { id: "desisto", emoji: "🔁", label: "Começo e desisto na 1ª semana" },
  { id: "sem_rumo", emoji: "🧭", label: "Me sinto sem rumo" },
  { id: "sem_progresso", emoji: "📉", label: "Não vejo meu progresso" },
  { id: "sozinho", emoji: "🕳️", label: "Me sinto sozinho(a) nessa" },
];

const TINDER_CARDS = [
  "Eu começo a me cuidar e largo na primeira semana.",
  "Eu não sei se o que eu faço está funcionando.",
  "Tenho tanta coisa pra acompanhar que não acompanho nada.",
  "Eu queria alguém que prestasse atenção em mim.",
];

const AREAS = [
  { id: "sono", emoji: "😴", label: "Sono" },
  { id: "humor", emoji: "😊", label: "Humor" },
  { id: "habitos", emoji: "✅", label: "Hábitos" },
  { id: "metas", emoji: "🎯", label: "Metas" },
  { id: "dinheiro", emoji: "💰", label: "Dinheiro" },
  { id: "alimentacao", emoji: "🥗", label: "Alimentação" },
  { id: "movimento", emoji: "🏃", label: "Movimento" },
  { id: "leitura", emoji: "📖", label: "Leitura" },
];

// Hábitos do check-in de demonstração (mapeiam para campos reais do CheckInAnswers).
const DEMO_HABITS = [
  { key: "drank_water", emoji: "💧", label: "Bebi água" },
  { key: "slept_well", emoji: "😴", label: "Dormi bem" },
  { key: "meditation", emoji: "🧘", label: "Meditei" },
  { key: "walked", emoji: "🏃", label: "Me exercitei" },
  { key: "creative_activity", emoji: "🎨", label: "Fiz algo criativo" },
  { key: "read", emoji: "📖", label: "Li hoje" },
  { key: "did_something_enjoyable", emoji: "😊", label: "Fiz algo que gosto" },
];

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

const STEPS = [
  "welcome", "goal", "pain", "social", "tinder", "solution", "comparison",
  "preferences", "about", "processing", "demo", "value", "notifications", "paywall",
] as const;

// ── Shared UI ─────────────────────────────────────────────────────────────────

function ProgressBar({ stepIdx, total }: { stepIdx: number; total: number }) {
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
        {String(stepIdx + 1).padStart(2, "0")} de {String(total).padStart(2, "0")}
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Voltar" style={{
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

function Footer({ onPrev, onNext, nextLabel, nextDisabled, secondary }: {
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
          }}>← Voltar</button>
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
          }}>{nextLabel ?? "Continuar"}</button>
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
        Sua vida inteira,<br />conectada.
      </h1>
      <p style={{ margin: "0", fontSize: 15, color: TEXT, lineHeight: 1.65 }}>
        A Maya cruza seu sono, humor, hábitos, metas e dinheiro — e mostra o que você sozinho não enxerga.
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
      }}>Começar</button>
    </div>
  );
}

function GoalScreen({ goal, setGoal, onNext, onPrev }: {
  goal: string; setGoal: (g: string) => void; onNext: () => void; onPrev: () => void;
}) {
  return (
    <>
      <Section title="O que você quer trabalhar primeiro?" sub="A gente começa por aqui." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GOALS.map((g) => (
          <OptionButton key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>
            <span style={{ fontSize: 20 }}>{g.emoji}</span>{g.label}
          </OptionButton>
        ))}
      </div>
      <Footer onPrev={onPrev} onNext={goal ? onNext : undefined} nextDisabled={!goal} />
    </>
  );
}

function PainScreen({ pains, togglePain, onNext, onPrev }: {
  pains: string[];
  togglePain: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <Section title="O que mais te atrapalha hoje?" sub="Marque tudo que fizer sentido." />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PAINS.map((p) => (
          <OptionButton key={p.id} active={pains.includes(p.id)} onClick={() => togglePain(p.id)}>
            <span style={{ fontSize: 20 }}>{p.emoji}</span>{p.label}
          </OptionButton>
        ))}
      </div>
      <Footer onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function SocialScreen({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const testimonials = [
    { text: "Pela primeira vez eu entendo o que me derruba.", name: "Marina, 34", tag: "equilibrando a rotina" },
    { text: "Dois minutos por dia e eu sinto que estou no controle.", name: "Diego, 41", tag: "pai e empreendedor" },
    { text: "É como ter alguém que presta atenção em mim de verdade.", name: "Camila, 27", tag: "buscando leveza" },
  ];
  return (
    <>
      <Section title="Milhares já encontraram o próprio caminho." />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {testimonials.map((t) => (
          <div key={t.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14.5, color: TEXT, lineHeight: 1.5 }}>“{t.text}”</p>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: ACCENT_2 }}>{t.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: MUTED }}>{t.tag}</p>
          </div>
        ))}
      </div>
      <Footer onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function TinderScreen({ idx, onAgree, onDismiss, onPrev }: {
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
        eyebrow={`${idx + 1} de ${total}`}
        title="Com quais frases você se identifica?"
        sub="Toque ✓ se for você, ✗ se não for."
      />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "28px 24px", minHeight: 160, display: "flex", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TEXT, lineHeight: 1.5 }}>
          “{TINDER_CARDS[idx]}”
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
      <Footer onPrev={onPrev} />
    </>
  );
}

function SolutionScreen({ pains, onNext, onPrev }: {
  pains: string[];
  onNext: () => void;
  onPrev: () => void;
}) {
  const solutions: Record<string, { emoji: string; pain: string; fix: string }> = {
    nao_sei: { emoji: "🤷", pain: "Não sei o que funciona", fix: "A Maya cruza sono, humor e hábitos e mostra o que te faz bem — e o que te derruba." },
    desisto: { emoji: "🔁", pain: "Começo e desisto", fix: "Um check-in de 2 minutos que vira rotina, não obrigação." },
    espalhado: { emoji: "🧩", pain: "Vida espalhada", fix: "Sono, hábitos, metas e dinheiro num só lugar, conectados." },
    sem_rumo: { emoji: "🧭", pain: "Sem rumo", fix: "Metas e planejamento que tiram você da intenção e mostram pra onde ir." },
    sem_tempo: { emoji: "⏰", pain: "Sem tempo", fix: "Dois minutos por dia bastam — é rotina mínima, não mais uma tarefa." },
    sem_progresso: { emoji: "📉", pain: "Não vejo progresso", fix: "Sua evolução fica visível, dia a dia, em um só lugar." },
    sozinho: { emoji: "🕳️", pain: "Me sinto só", fix: "A Maya lembra de você e te acompanha — sem cobrança." },
  };
  const keys = pains.length > 0 ? pains : ["nao_sei", "desisto", "espalhado", "sem_rumo"];
  return (
    <>
      <Section title="A Maya foi feita pra isso." sub="Você nos contou o que sente. Veja como a gente resolve." />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {keys.filter((k) => solutions[k]).map((k) => {
          const s = solutions[k];
          return (
            <div key={k} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: MUTED }}>{s.emoji} {s.pain}</p>
              <p style={{ margin: 0, fontSize: 14.5, color: TEXT, fontWeight: 600, lineHeight: 1.45 }}>{s.fix}</p>
            </div>
          );
        })}
      </div>
      <Footer onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function ComparisonScreen({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  const rows = [
    { withMaya: "Você vê o que funciona", without: "Achismo" },
    { withMaya: "2 minutos por dia", without: "Horas em planilhas" },
    { withMaya: "Tudo num só lugar", without: "Espalhado em apps" },
    { withMaya: "Progresso claro", without: "Sensação de não sair do lugar" },
  ];
  return (
    <>
      <Section title="A diferença é visível." />
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#5EEAD4" }}>Com Maya</div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: MUTED }}>Sem Maya</div>
      </div>
      {rows.map((r) => (
        <div key={r.withMaya} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, background: "oklch(0.5 0.12 270 / .12)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#5EEAD4", fontWeight: 800 }}>✓</span>
            <span style={{ fontSize: 13.5, color: TEXT }}>{r.withMaya}</span>
          </div>
          <div style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "oklch(0.72 0.1 30)", fontWeight: 800 }}>✗</span>
            <span style={{ fontSize: 13.5, color: MUTED }}>{r.without}</span>
          </div>
        </div>
      ))}
      <Footer onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function PreferencesScreen({ areas, toggleArea, onNext, onPrev }: {
  areas: string[];
  toggleArea: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      <Section title="Quais áreas você quer acompanhar?" sub="A Maya personaliza seu espaço a partir daqui." />
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
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <Footer onPrev={onPrev} onNext={onNext} nextDisabled={areas.length === 0} />
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
      <Section title="Pra te conhecer melhor." sub="Isso ajuda a Maya a falar com você do jeito certo." />

      <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: TEXT }}>Como você quer que a Maya se refira a você?</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {GENDER_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" onClick={() => setGender(opt.id)} style={{
            flex: 1, padding: "12px 6px", borderRadius: 12, border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
            background: gender === opt.id ? ACCENT : CARD,
            color: gender === opt.id ? "#fff" : MUTED,
            outline: gender === opt.id ? "none" : `1px solid ${BORDER}`,
            transition: "all .15s ease",
          }}>{opt.emoji} {opt.label}</button>
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
                background: ctx[q.id] ? ACCENT : CARD, color: ctx[q.id] ? "#fff" : MUTED,
                outline: ctx[q.id] ? "none" : `1px solid ${BORDER}`,
              }}>{translate(lang as Lang, "sim")}</button>
              <button type="button" onClick={() => setCtxValue(q.id, false)} style={{
                flex: 1, height: 40, borderRadius: 10, border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                background: !ctx[q.id] ? "oklch(0.72 0.1 30 / .25)" : CARD,
                color: !ctx[q.id] ? "oklch(0.35 0.07 30)" : MUTED,
                outline: `1px solid ${BORDER}`,
              }}>{translate(lang as Lang, "nao")}</button>
            </div>
          </div>
        ))}
      </div>
      <Footer onPrev={onPrev} onNext={onNext} />
    </>
  );
}

function ProcessingScreen() {
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
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Preparando seu espaço…</h1>
      <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Só um instante.</p>
      <style>{`@keyframes obPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
    </div>
  );
}

function DemoStep({ selected, toggle, onNext, onPrev }: {
  selected: Set<string>;
  toggle: (key: string) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const n = selected.size;
  return (
    <>
      <Section title="Vamos fazer seu primeiro check-in." sub="Toque no que você fez hoje." />
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
              <span>{h.label}</span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13, color: MUTED }}>
        {n >= 3 ? "Prontinho! ✨" : `Toque em pelo menos ${3 - n} ${3 - n === 1 ? "coisa" : "coisas"}`}
      </p>
      <Footer onPrev={onPrev} onNext={n >= 3 ? onNext : undefined} nextDisabled={n < 3} nextLabel="Concluir" />
    </>
  );
}

function ValueStep({ selected, onShare, onNext }: {
  selected: Set<string>;
  onShare: () => void;
  onNext: () => void;
}) {
  const items = DEMO_HABITS.filter((h) => selected.has(h.key));
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🎉</div>
      <h1 style={{ margin: "0 0 6px", fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", color: TEXT }}>
        Você cuidou de {items.length} {items.length === 1 ? "coisa" : "coisas"} hoje.
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        A partir de agora, a Maya conecta esses pontos com seu sono, humor e metas.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        {items.map((h) => (
          <span key={h.key} style={{ padding: "8px 14px", borderRadius: 9999, background: CARD, border: `1px solid ${BORDER}`, fontSize: 13.5, color: TEXT }}>
            {h.emoji} {h.label}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" onClick={onShare} style={{
          width: "100%", height: 52, borderRadius: 14, border: `1px solid ${BORDER}`, cursor: "pointer",
          background: CARD, color: TEXT, fontFamily: "inherit", fontSize: 14.5, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Compartilhar
        </button>
        <button type="button" onClick={onNext} style={{
          width: "100%", height: 54, borderRadius: 16, border: 0, cursor: "pointer",
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: "#fff",
          fontFamily: "inherit", fontSize: 15.5, fontWeight: 700,
          boxShadow: "0 4px 18px -4px oklch(.55 .2 270 / .5)",
        }}>Continuar</button>
      </div>
    </div>
  );
}

function NotificationsStep({ onEnable, onSkip, loading }: {
  onEnable: () => void;
  onSkip: () => void;
  loading: boolean;
}) {
  return (
    <>
      <Section title="Nunca perca o momento de se cuidar." />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
        {[
          ["🔔", "A Maya te lembra do check-in na hora que você escolher."],
          ["💛", "Um toque gentil quando você mais precisa."],
          ["🚫", "Sem spam — só o que importa."],
        ].map(([e, txt]) => (
          <div key={txt} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px" }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{e}</span>
            <span style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{txt}</span>
          </div>
        ))}
      </div>
      <Footer
        onNext={onEnable}
        nextLabel={loading ? "Ativando…" : "Ativar lembretes"}
        nextDisabled={loading}
        secondary={
          <button type="button" onClick={onSkip} style={{
            background: "transparent", border: 0, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: MUTED, padding: "8px 0", flexShrink: 0,
          }}>Agora não</button>
        }
      />
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

  const handleShare = async () => {
    const text = "Comecei minha jornada com a Maya 🌱";
    if (navigator.share) {
      try { await navigator.share({ title: "Maya", text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado! Compartilhe com quem você gosta.");
    } catch {
      toast.info("Compartilhe sua jornada com a Maya 🌱");
    }
  };

  const handleEnableNotifications = async () => {
    setNotifLoading(true);
    try {
      const { sub } = await requestPushSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...sub, timezone: getUserTimezone() }),
        });
        toast.success("Lembretes ativados! 🔔");
      }
    } catch {}
    setNotifLoading(false);
    goNext();
  };

  // Salva o check-in da demo quando o usuário conclui a etapa 11 (demo).
  const saveDemoCheckIn = useCallback(() => {
    if (savedRef.current || demo.size === 0) return;
    savedRef.current = true;
    const answers = defaultAnswers();
    for (const h of DEMO_HABITS) {
      if (demo.has(h.key)) (answers as unknown as Record<string, boolean>)[h.key] = true;
    }
    fetch("/api/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    }).catch(() => {});
  }, [demo]);

  // Completa o onboarding (antes do redirect pro Checkout do Stripe).
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

    invalidateFetchCache("/api/check-ins");
    // O redirect pro Checkout do Stripe é feito pelo componente Paywall,
    // que chama este beforeCheckout antes de criar a sessão.
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const showProgress = step !== "welcome" && step !== "paywall";
  const showBack = stepIdx > 0 && step !== "processing" && step !== "value" && step !== "paywall" && step !== "notifications";

  return (
    <main style={{
      minHeight: "100dvh", background: BG, color: TEXT,
      fontFamily: "var(--font-sans)", overflowX: "hidden", position: "relative",
    }}>
      {showProgress && <ProgressBar stepIdx={stepIdx} total={STEPS.length} />}
      {showBack && <BackButton onClick={goPrev} />}

      <div style={{
        minHeight: "100dvh", boxSizing: "border-box", maxWidth: 460, margin: "0 auto",
        padding: "110px 26px 140px",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        {step === "welcome" && <WelcomeScreen lang={lang} setLang={setLang} onNext={goNext} />}
        {step === "goal" && <GoalScreen goal={goal} setGoal={setGoal} onNext={goNext} onPrev={goPrev} />}
        {step === "pain" && <PainScreen pains={pains} togglePain={togglePain} onNext={goNext} onPrev={goPrev} />}
        {step === "social" && <SocialScreen onNext={goNext} onPrev={goPrev} />}
        {step === "tinder" && (
          <TinderScreen idx={tinderIdx} onAgree={handleTinderAgree} onDismiss={handleTinderDismiss} onPrev={goPrev} />
        )}
        {step === "solution" && <SolutionScreen pains={pains} onNext={goNext} onPrev={goPrev} />}
        {step === "comparison" && <ComparisonScreen onNext={goNext} onPrev={goPrev} />}
        {step === "preferences" && <PreferencesScreen areas={areas} toggleArea={toggleArea} onNext={goNext} onPrev={goPrev} />}
        {step === "about" && (
          <AboutScreen
            gender={gender} setGender={setGender} ctx={ctx} setCtxValue={setCtxValue}
            lang={lang} onNext={goNext} onPrev={goPrev}
          />
        )}
        {step === "processing" && <ProcessingScreen />}
        {step === "demo" && <DemoStep selected={demo} toggle={toggleDemo} onNext={() => { saveDemoCheckIn(); goNext(); }} onPrev={goPrev} />}
        {step === "value" && <ValueStep selected={demo} onShare={handleShare} onNext={goNext} />}
        {step === "notifications" && <NotificationsStep onEnable={handleEnableNotifications} onSkip={goNext} loading={notifLoading} />}
        {step === "paywall" && <Paywall beforeCheckout={handleFinish} />}
      </div>
    </main>
  );
}
