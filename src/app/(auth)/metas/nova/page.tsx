"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Trophy, AlertOctagon } from "lucide-react";
import type { GoalArea } from "@/types";

// ── Area config ───────────────────────────────────────────────────────────────

const AREAS: { value: GoalArea; label: string; emoji: string; hue: number; desc: string }[] = [
  { value: "saude",           label: "Saúde",           emoji: "💚", hue: 160, desc: "Corpo, mente, sono" },
  { value: "carreira",        label: "Carreira",        emoji: "💼", hue: 220, desc: "Trabalho, propósito" },
  { value: "financas",        label: "Finanças",        emoji: "💰", hue: 85,  desc: "Dinheiro, abundância" },
  { value: "relacionamentos", label: "Relacionamentos", emoji: "❤️", hue: 15,  desc: "Amor, amizades" },
  { value: "desenvolvimento", label: "Desenvolvimento", emoji: "🧠", hue: 270, desc: "Aprendizado" },
  { value: "familia",         label: "Família",         emoji: "🏡", hue: 40,  desc: "Vínculos, legado" },
  { value: "lazer",           label: "Lazer",           emoji: "🌊", hue: 185, desc: "Hobbies, aventura" },
  { value: "espiritualidade", label: "Espiritualidade", emoji: "✨", hue: 300, desc: "Fé, transcendência" },
];

const STEP_LABELS = ["Área", "Definir", "Etapa", "Guardião", "Pacto"];
const STEP_TITLES = [
  "Que área da sua vida?",
  "Defina sua meta",
  "Primeira etapa",
  "Quem vai te cobrar?",
  "Suas apostas",
];
const TOTAL_STEPS = 5;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.55 .03 270)" }}>
      {children}
    </p>
  );
}

function Input({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{
        width: "100%", boxSizing: "border-box", padding: "13px 14px",
        borderRadius: 12, border: "1.5px solid oklch(.28 .02 270 / .5)",
        background: "oklch(.16 .012 270 / .7)", fontFamily: "inherit",
        fontSize: 15, color: "#e0d6ff", outline: "none",
      }}
      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#7C5CFF"; }}
      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.28 .02 270 / .5)"; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%", boxSizing: "border-box", padding: "13px 14px",
        borderRadius: 12, border: "1.5px solid oklch(.28 .02 270 / .5)",
        background: "oklch(.16 .012 270 / .7)", fontFamily: "inherit",
        fontSize: 14, color: "#e0d6ff", outline: "none", resize: "none",
        lineHeight: 1.6,
      }}
      onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#7C5CFF"; }}
      onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "oklch(.28 .02 270 / .5)"; }}
    />
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export default function NovaMetaPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [area, setArea]                       = useState<GoalArea | "">("");
  const [title, setTitle]                     = useState("");
  const [description, setDescription]         = useState("");
  const [whyItMatters, setWhyItMatters]       = useState("");
  const [targetDate, setTargetDate]           = useState("");
  const [firstStage, setFirstStage]           = useState("");
  const [guardianName, setGuardianName]       = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [reward, setReward]                   = useState("");
  const [punishment, setPunishment]           = useState("");

  const canNext = () => {
    if (step === 0) return area !== "";
    if (step === 1) return title.trim().length >= 3 && whyItMatters.trim().length >= 10;
    if (step === 2) return firstStage.trim().length >= 3;
    return true;
  };

  const next = () => { if (step < TOTAL_STEPS - 1 && canNext()) setStep((s) => s + 1); };
  const back = () => { if (step > 0) setStep((s) => s - 1); };

  const handleSave = async () => {
    if (!canNext()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "destino", area, title, description, why_it_matters: whyItMatters,
          target_date: targetDate || null,
          first_stage: firstStage,
          guardian_name: guardianName || null,
          guardian_contact: guardianContact || null,
          reward: reward || null,
          punishment: punishment || null,
        }),
      });
      if (res.ok) {
        const goal = await res.json();
        router.replace(`/metas/${goal.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedArea = AREAS.find((a) => a.value === area);
  const HUE = selectedArea?.hue ?? 160;

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", overflowY: "auto",
      fontFamily: "var(--font-sans)", color: "#e0d6ff",
      background: `
        radial-gradient(ellipse 80% 50% at 50% 0%, oklch(.96 .03 ${HUE} / .45) 0%, transparent 60%),
        linear-gradient(180deg, oklch(.12 .012 270) 0%, oklch(.15 .015 270) 100%)
      `,
      position: "relative", paddingBottom: 120,
      transition: "background .5s ease",
    }}>
      {/* Close */}
      <button type="button" onClick={() => router.back()} style={{
        position: "absolute", top: 14, left: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: "pointer",
        background: "oklch(.16 .012 270 / .65)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 3px oklch(.25 .02 270 / .08)",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>

      {/* Progress bars */}
      <div style={{
        position: "absolute", top: 22, left: 64, right: 64, zIndex: 9,
        display: "flex", gap: 4, alignItems: "center",
      }}>
        {STEP_LABELS.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 9999,
            background: i <= step ? `oklch(.45 .14 ${HUE})` : `oklch(.5 .12 ${HUE} / .15)`,
            transition: "background .3s ease",
          }} />
        ))}
      </div>

      {/* Mono step counter */}
      <p style={{
        position: "absolute", top: 56, left: 0, right: 0, textAlign: "center", zIndex: 9,
        margin: 0, fontFamily: "var(--font-mono, ui-monospace)", fontSize: 10,
        color: "oklch(.55 .03 270)", letterSpacing: ".16em", textTransform: "uppercase",
      }}>
        Nova meta · passo {String(step + 1).padStart(2, "0")} de 05
      </p>

      {/* Step content */}
      <div style={{ padding: "100px 20px 0" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
          {STEP_TITLES[step]}
        </h1>

        {/* Step 0 — Area grid */}
        {step === 0 && (
          <>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "oklch(.55 .03 270)", lineHeight: 1.5 }}>
              Toda meta vive em uma área. Escolha a principal.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {AREAS.map((a) => {
                const sel = area === a.value;
                return (
                  <button key={a.value} type="button" onClick={() => setArea(a.value)} style={{
                    textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    padding: "14px 12px 12px", borderRadius: 16, position: "relative",
                    background: sel
                      ? `linear-gradient(135deg, oklch(.96 .04 ${a.hue}) 0%, oklch(.92 .07 ${a.hue}) 100%)`
                      : "oklch(.16 .012 270 / .55)",
                    border: sel
                      ? `2px solid oklch(.45 .14 ${a.hue})`
                      : "2px solid oklch(.28 .02 270 / .3)",
                    transition: "all .2s ease",
                  }}>
                    <span style={{ fontSize: 22, display: "block", marginBottom: 6 }}>{a.emoji}</span>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "-0.005em", color: sel ? `oklch(.2 .04 ${a.hue})` : "#e0d6ff" }}>
                      {a.label}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10.5, color: sel ? `oklch(.4 .08 ${a.hue})` : "oklch(.55 .03 270)" }}>
                      {a.desc}
                    </p>
                    {sel && (
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        width: 18, height: 18, borderRadius: 9999, background: `oklch(.45 .14 ${a.hue})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12 5 5 9-10"/>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 1 — Title + Why + Date */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedArea && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px",
                borderRadius: 9999, background: `oklch(.5 .12 ${HUE} / .15)`,
                alignSelf: "flex-start",
              }}>
                <span style={{ fontSize: 16 }}>{selectedArea.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: `oklch(.35 .12 ${HUE})` }}>{selectedArea.label}</span>
              </div>
            )}
            <div>
              <Label>Título da meta</Label>
              <Input value={title} onChange={setTitle} placeholder="Ex: Publicar meu livro até dezembro" maxLength={80} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "oklch(.55 .03 270)" }}>{title.length}/80</p>
            </div>
            <div>
              <Label>Por que isso importa para você? *</Label>
              <Textarea
                value={whyItMatters}
                onChange={setWhyItMatters}
                placeholder="Escreva o seu motivo real, não o esperado. Quanto mais honesto, mais força essa meta vai ter..."
                rows={3}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "oklch(.55 .03 270)", fontStyle: "italic" }}>
                Este texto vai aparecer quando sua motivação cair.
              </p>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={setDescription} placeholder="Mais detalhes sobre essa meta..." rows={2} />
            </div>
            <div>
              <Label>Data alvo (opcional)</Label>
              <div style={{
                overflow: "hidden", borderRadius: 12,
                border: "1.5px solid oklch(.28 .02 270 / .5)",
                background: "oklch(.16 .012 270 / .7)", height: 48,
                display: "flex", alignItems: "center",
              }}>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{
                    flex: 1, padding: "0 14px", border: "none", background: "transparent",
                    fontFamily: "inherit", fontSize: 14, color: "#e0d6ff", outline: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — First stage */}
        {step === 2 && (
          <div>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#7C5CFF", lineHeight: 1.6 }}>
              Qual é o <strong>primeiro marco</strong> que você precisa atingir?
            </p>
            <div style={{
              background: "oklch(.16 .012 270 / .6)", borderRadius: 16, padding: 16, marginBottom: 16,
              border: "1px solid oklch(.28 .02 270 / .5)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `oklch(.5 .12 ${HUE} / .15)`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono, ui-monospace)",
                  color: `oklch(.4 .12 ${HUE})`,
                }}>1</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>Primeira etapa</span>
              </div>
              <Input value={firstStage} onChange={setFirstStage} placeholder="Ex: Escrever os primeiros 3 capítulos" maxLength={100} />
            </div>
            <div style={{ background: `oklch(.5 .12 ${HUE} / .08)`, borderRadius: 12, padding: 14, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: "#e0d6ff", lineHeight: 1.5 }}>
                Você vai poder adicionar mais etapas e ações dentro de cada etapa na tela de detalhe da meta.
              </p>
            </div>
          </div>
        )}

        {/* Step 3 — Guardian */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px",
                background: `oklch(.5 .12 ${HUE} / .12)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={28} style={{ color: `oklch(.45 .12 ${HUE})` }} />
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "oklch(.55 .03 270)", lineHeight: 1.6 }}>
                Um amigo, familiar ou colega que vai te cobrar. Pesquisas mostram que ter um guardião aumenta as chances de sucesso em até 65%.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Label>Nome do guardião</Label>
                <Input value={guardianName} onChange={setGuardianName} placeholder="Ex: João Silva" />
              </div>
              <div>
                <Label>Contato (opcional)</Label>
                <Input value={guardianContact} onChange={setGuardianContact} placeholder="WhatsApp ou e-mail" />
              </div>
            </div>
            <button type="button" onClick={() => { setGuardianName(""); setGuardianContact(""); next(); }} style={{
              marginTop: 24, width: "100%", padding: 14, borderRadius: 12, border: 0, cursor: "pointer",
              background: "transparent", fontFamily: "inherit", fontSize: 13,
              color: "oklch(.55 .03 270)", textDecoration: "underline",
            }}>
              Pular — definirei depois
            </button>
          </div>
        )}

        {/* Step 4 — Stakes */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "oklch(.95 .04 85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trophy size={22} style={{ color: "oklch(.5 .14 85)" }} />
                </div>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "oklch(.95 .04 15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertOctagon size={22} style={{ color: "oklch(.5 .18 15)" }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.55 .03 270)", lineHeight: 1.6 }}>
                Metas com recompensa e punição definidas têm 3× mais chance de serem cumpridas.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "oklch(.97 .04 85)", borderRadius: 16, padding: 16, border: "1.5px solid oklch(.88 .06 85)" }}>
                <Label>🏆 Recompensa se cumprir</Label>
                <Input value={reward} onChange={setReward} placeholder="Ex: Jantar no restaurante favorito..." />
              </div>
              <div style={{ background: "oklch(.97 .04 15)", borderRadius: 16, padding: 16, border: "1.5px solid oklch(.88 .06 15)" }}>
                <Label>⚠️ Punição se abandonar</Label>
                <Input value={punishment} onChange={setPunishment} placeholder="Ex: Dar R$ 100 para fulano..." />
              </div>
              {guardianName && (reward || punishment) && (
                <div style={{ background: `oklch(.5 .12 ${HUE} / .08)`, borderRadius: 12, padding: 14, display: "flex", gap: 10 }}>
                  <Shield size={18} style={{ color: `oklch(.45 .12 ${HUE})`, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: "#e0d6ff", lineHeight: 1.5 }}>
                    <strong>{guardianName}</strong> vai saber da recompensa e da punição quando você compartilhar a meta.
                  </p>
                </div>
              )}
            </div>
            <button type="button" onClick={() => { setReward(""); setPunishment(""); }} style={{
              marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: 0, cursor: "pointer",
              background: "transparent", fontFamily: "inherit", fontSize: 13,
              color: "oklch(.55 .03 270)", textDecoration: "underline",
            }}>
              Pular — prefiro sem apostas
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 20px calc(env(safe-area-inset-bottom) + 16px)",
        background: "oklch(.12 .012 270 / .85)", backdropFilter: "blur(12px)",
        borderTop: "1px solid oklch(.28 .02 270 / .5)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <button type="button" onClick={back} style={{
          background: "transparent", border: 0, cursor: step > 0 ? "pointer" : "default",
          fontFamily: "inherit", fontSize: 13, color: step > 0 ? "#7C5CFF" : "transparent",
          display: "flex", alignItems: "center", gap: 4, padding: "8px 0",
        }}>
          {step > 0 && (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Voltar
            </>
          )}
        </button>

        {step < TOTAL_STEPS - 1 ? (
          <button type="button" onClick={next} disabled={!canNext()} style={{
            height: 48, padding: "0 22px", borderRadius: 14,
            background: canNext() ? `oklch(.45 .14 ${HUE})` : `oklch(.5 .12 ${HUE} / .2)`,
            color: canNext() ? "#fff" : `oklch(.45 .1 ${HUE} / .6)`,
            border: 0, cursor: canNext() ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: canNext() ? `0 4px 14px -4px oklch(.45 .14 ${HUE} / .5)` : "none",
            transition: "all .2s ease",
          }}>
            Continuar
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        ) : (
          <button type="button" onClick={handleSave} disabled={saving} style={{
            height: 48, padding: "0 22px", borderRadius: 14,
            background: saving ? "oklch(.28 .02 270 / .3)" : `linear-gradient(135deg, oklch(.42 .16 ${HUE}), oklch(.52 .14 ${HUE}))`,
            color: "#fff", border: 0, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", fontSize: 14, fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 6,
            boxShadow: saving ? "none" : `0 4px 14px -4px oklch(.45 .14 ${HUE} / .5)`,
          }}>
            {saving ? "Criando..." : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5 9-10"/>
                </svg>
                Criar meta
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
