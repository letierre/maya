"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Shield, Trophy, AlertOctagon } from "lucide-react";
import type { GoalArea } from "@/types";

// ── Area config ───────────────────────────────────────────────────────────────

const AREAS: { value: GoalArea; label: string; emoji: string; hue: number; desc: string }[] = [
  { value: "saude",          label: "Saúde",              emoji: "💚", hue: 160, desc: "Corpo, mente, sono, energia" },
  { value: "carreira",       label: "Carreira",           emoji: "💼", hue: 220, desc: "Trabalho, negócio, propósito" },
  { value: "financas",       label: "Finanças",           emoji: "💰", hue: 85,  desc: "Dinheiro, investimentos, abundância" },
  { value: "relacionamentos",label: "Relacionamentos",    emoji: "❤️", hue: 15,  desc: "Amor, amizades, conexões" },
  { value: "desenvolvimento", label: "Desenvolvimento",   emoji: "🧠", hue: 270, desc: "Aprendizado, habilidades, crescimento" },
  { value: "familia",        label: "Família",            emoji: "🏡", hue: 40,  desc: "Presença, vínculos, legado" },
  { value: "lazer",          label: "Lazer",              emoji: "🌊", hue: 185, desc: "Diversão, hobbies, aventura" },
  { value: "espiritualidade",label: "Espiritualidade",    emoji: "✨", hue: 300, desc: "Fé, propósito, transcendência" },
];

function areaColor(hue: number) { return `oklch(.5 .12 ${hue})`; }
function areaLight(hue: number) { return `oklch(.95 .05 ${hue})`; }

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 6,
          width: i === current ? 22 : 6,
          borderRadius: 9999,
          background: i <= current ? "oklch(.5 .12 160)" : "oklch(.85 .02 160)",
          transition: "all .3s ease",
        }} />
      ))}
    </div>
  );
}

// ── Field components ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "oklch(.5 .04 160)" }}>
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
        borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
        background: "oklch(.98 .005 160)", fontFamily: "inherit",
        fontSize: 15, color: "oklch(.2 .02 160)", outline: "none",
        transition: "border-color .15s ease",
      }}
      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.5 .12 160)"; }}
      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
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
        borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
        background: "oklch(.98 .005 160)", fontFamily: "inherit",
        fontSize: 14, color: "oklch(.2 .02 160)", outline: "none", resize: "none",
        lineHeight: 1.6, transition: "border-color .15s ease",
      }}
      onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "oklch(.5 .12 160)"; }}
      onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "oklch(.82 .03 160)"; }}
    />
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const STEP_TITLES = [
  "Qual área da sua vida?",
  "Defina sua meta",
  "Primeira etapa",
  "Quem vai te cobrar?",
  "Suas apostas",
];

export default function NovaMetaPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state — type is always "destino" for annual goals
  const [area, setArea]               = useState<GoalArea | "">("");
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [targetDate, setTargetDate]   = useState("");
  const [firstStage, setFirstStage]   = useState("");
  const [guardianName, setGuardianName]       = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [reward, setReward]           = useState("");
  const [punishment, setPunishment]   = useState("");

  const canNext = () => {
    if (step === 0) return area !== "";
    if (step === 1) return title.trim().length >= 3 && whyItMatters.trim().length >= 10;
    if (step === 2) return firstStage.trim().length >= 3;
    if (step === 3) return true; // guardian optional
    if (step === 4) return true; // stakes optional
    return false;
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

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(160deg, oklch(.5 .12 160), oklch(.42 .14 200))",
        padding: "52px 20px 24px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "oklch(1 0 0 / .06)" }} />
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "relative", zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "oklch(1 0 0 / .15)", border: 0, borderRadius: 10,
            padding: "8px 12px", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            cursor: "pointer", marginBottom: 16,
          }}
        >
          <ChevronLeft size={16} /> Voltar
        </button>
        <p style={{ margin: "0 0 2px", fontSize: 13, color: "oklch(1 0 0 / .7)", fontWeight: 500, position: "relative", zIndex: 1 }}>
          Nova meta
        </p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff", position: "relative", zIndex: 1 }}>
          {STEP_TITLES[step]}
        </h1>
      </div>

      <div style={{ padding: "24px 16px" }}>
        <StepDots total={TOTAL_STEPS} current={step} />

        {/* Step 0 — Area */}
        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {AREAS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setArea(a.value)}
                style={{
                  textAlign: "left", border: area === a.value
                    ? `2px solid ${areaColor(a.hue)}`
                    : "2px solid oklch(.88 .02 160)",
                  borderRadius: 16, padding: "14px 12px", cursor: "pointer",
                  background: area === a.value ? areaLight(a.hue) : "#fff",
                  transition: "all .15s ease",
                }}
              >
                <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>{a.emoji}</span>
                <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "oklch(.2 .02 160)" }}>{a.label}</p>
                <p style={{ margin: 0, fontSize: 10, color: "oklch(.55 .04 160)", lineHeight: 1.4 }}>{a.desc}</p>
                {area === a.value && (
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                    <Check size={14} style={{ color: areaColor(a.hue) }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — Title + Why + Date */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedArea && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                borderRadius: 12, background: areaLight(selectedArea.hue), marginBottom: 4,
              }}>
                <span style={{ fontSize: 20 }}>{selectedArea.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: areaColor(selectedArea.hue) }}>{selectedArea.label}</span>
              </div>
            )}

            <div>
              <Label>Título da meta</Label>
              <Input value={title} onChange={setTitle} placeholder="Ex: Publicar meu livro até dezembro" maxLength={80} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "oklch(.6 .04 160)" }}>{title.length}/80</p>
            </div>

            <div>
              <Label>Por que isso importa para você? *</Label>
              <Textarea
                value={whyItMatters}
                onChange={setWhyItMatters}
                placeholder="Escreva o seu motivo real, não o esperado. Quanto mais honesto, mais força essa meta vai ter..."
                rows={3}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "oklch(.6 .04 160)", fontStyle: "italic" }}>
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
                border: "1.5px solid oklch(.82 .03 160)",
                background: "oklch(.98 .005 160)", height: 48,
                display: "flex", alignItems: "center",
              }}>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{
                    flex: 1, padding: "0 14px", border: "none", background: "transparent",
                    fontFamily: "inherit", fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — First stage */}
        {step === 2 && (
          <div>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "oklch(.45 .04 160)", lineHeight: 1.6 }}>
              Toda meta grande precisa ser quebrada em etapas. Qual é o <strong>primeiro marco</strong> que você precisa atingir?
            </p>

            <div style={{
              background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
              border: "1px solid oklch(.88 .02 160)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "oklch(.93 .04 160)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: "oklch(.45 .12 160)",
                }}>1</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "oklch(.4 .06 160)" }}>Primeira etapa</span>
              </div>
              <Input value={firstStage} onChange={setFirstStage} placeholder="Ex: Escrever os primeiros 3 capítulos" maxLength={100} />
            </div>

            <div style={{
              background: "oklch(.95 .03 160)", borderRadius: 12, padding: 14,
              display: "flex", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: "oklch(.4 .06 160)", lineHeight: 1.5 }}>
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
                background: "oklch(.93 .04 160)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Shield size={28} style={{ color: "oklch(.5 .12 160)" }} />
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "oklch(.2 .02 160)" }}>
                Quem vai ser seu guardião?
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .04 160)", lineHeight: 1.6 }}>
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

            <button
              type="button"
              onClick={() => { setGuardianName(""); setGuardianContact(""); next(); }}
              style={{
                marginTop: 24, width: "100%", padding: 14, borderRadius: 12, border: 0, cursor: "pointer",
                background: "transparent", fontFamily: "inherit", fontSize: 13,
                color: "oklch(.55 .04 160)", textDecoration: "underline",
              }}
            >
              Pular — definirei depois
            </button>
          </div>
        )}

        {/* Step 4 — Stakes */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "oklch(.95 .04 85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Trophy size={22} style={{ color: "oklch(.5 .14 85)" }} />
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "oklch(.95 .04 15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <AlertOctagon size={22} style={{ color: "oklch(.5 .18 15)" }} />
                </div>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "oklch(.2 .02 160)" }}>
                Coloque algo em jogo
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.5 .04 160)", lineHeight: 1.6 }}>
                Metas com recompensa e punição definidas têm 3× mais chance de serem cumpridas. A aversão à perda é seu aliado.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{
                background: "oklch(.97 .04 85)", borderRadius: 16, padding: 16,
                border: "1.5px solid oklch(.88 .06 85)",
              }}>
                <Label>🏆 Recompensa se cumprir</Label>
                <Input
                  value={reward}
                  onChange={setReward}
                  placeholder="Ex: Jantar no restaurante favorito, viagem dos sonhos..."
                />
              </div>

              <div style={{
                background: "oklch(.97 .04 15)", borderRadius: 16, padding: 16,
                border: "1.5px solid oklch(.88 .06 15)",
              }}>
                <Label>⚠️ Punição se abandonar</Label>
                <Input
                  value={punishment}
                  onChange={setPunishment}
                  placeholder="Ex: Dar R$ 100 para fulano, lavar os pratos por 1 mês..."
                />
              </div>

              {guardianName && (reward || punishment) && (
                <div style={{
                  background: "oklch(.95 .03 160)", borderRadius: 12, padding: 14,
                  display: "flex", gap: 10,
                }}>
                  <Shield size={18} style={{ color: "oklch(.5 .12 160)", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: "oklch(.4 .06 160)", lineHeight: 1.5 }}>
                    <strong>{guardianName}</strong> vai saber da recompensa e da punição quando você compartilhar a meta.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setReward(""); setPunishment(""); }}
              style={{
                marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: 0, cursor: "pointer",
                background: "transparent", fontFamily: "inherit", fontSize: 13,
                color: "oklch(.55 .04 160)", textDecoration: "underline",
              }}
            >
              Pular — prefiro sem apostas
            </button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              style={{
                flex: step === TOTAL_STEPS - 1 ? "0 0 auto" : 1,
                padding: "15px 20px", borderRadius: 14, border: "2px solid oklch(.85 .03 160)",
                background: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
                color: "oklch(.4 .06 160)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <ChevronLeft size={18} /> Voltar
            </button>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canNext()}
              style={{
                flex: 1, padding: "15px 20px", borderRadius: 14, border: 0, cursor: canNext() ? "pointer" : "not-allowed",
                background: canNext() ? "oklch(.5 .12 160)" : "oklch(.85 .02 160)",
                fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                color: canNext() ? "#fff" : "oklch(.6 .02 160)",
                transition: "all .15s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              Próximo <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: "15px 20px", borderRadius: 14, border: 0, cursor: saving ? "not-allowed" : "pointer",
                background: saving ? "oklch(.85 .02 160)" : "linear-gradient(135deg, oklch(.5 .12 160), oklch(.42 .14 200))",
                fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#fff",
                boxShadow: saving ? "none" : "0 4px 16px oklch(.5 .12 160 / .35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all .15s ease",
              }}
            >
              {saving ? "Criando..." : <><Check size={18} /> Criar meta</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
