"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { GoalArea } from "@/types";
import { useTranslation } from "@/lib/useTranslation";
import { AREA_CONFIG } from "@/lib/planejamento-constants";

const AREA_IDS = ["saude", "carreira", "financas", "relacionamentos", "desenvolvimento", "familia", "lazer", "espiritualidade"] as const;

type Step = 1 | 2 | 3;

export function GoalCreateSheet({ onClose, onCreated, initialArea, source }: {
  onClose: () => void;
  onCreated: () => void;
  initialArea?: GoalArea;
  source?: string;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(initialArea ?? "saude");
  const isPresetArea = !!initialArea;
  const [why, setWhy] = useState("");
  const [type, setType] = useState<"destino" | "direcao">("direcao");
  const [guardianName, setGuardianName] = useState("");
  const [reward, setReward] = useState("");
  const [punishment, setPunishment] = useState("");
  const [firstStage, setFirstStage] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !firstStage.trim()) return;
    setSaving(true);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        area, type,
        description: "",
        why_it_matters: why.trim(),
        guardian_name: guardianName.trim() || null,
        reward: reward.trim() || null,
        punishment: punishment.trim() || null,
        first_stage_title: firstStage.trim(),
        source: source || "metas",
      }),
    });
    if (res.ok) {
      toast.success(t("goal_criada"));
      onCreated();
      onClose();
    } else {
      toast.error(t("goal_erro_criar"));
    }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "max(40px, 8dvh) 20px 20px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: "100%", maxWidth: 420, maxHeight: "85dvh", overflowY: "auto", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>
          {step === 1 ? t("goal_nova_meta") : step === 2 ? t("goal_tipo_meta") : t("goal_compromisso")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9e96b5" }}>
          {step === 1
            ? t("goal_o_que_conquistar")
            : step === 2 ? t("goal_como_definir") : t("goal_opcional_foco")}
        </p>

        {step === 1 && (
          <>
            {/* Pre-selected area chip */}
            {isPresetArea && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 9999,
                background: "rgba(124,92,255,0.1)", border: "1px solid rgba(124,92,255,0.25)",
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 14 }}>{AREA_CONFIG[area as keyof typeof AREA_CONFIG]?.emoji ?? "💰"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA" }}>
                  {t(AREA_CONFIG[area as keyof typeof AREA_CONFIG]?.labelKey) ?? t("area_financas")}
                </span>
              </div>
            )}
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("goal_titulo_meta")} autoFocus style={inputS} />
            {/* Show area grid only when not preset */}
            {!isPresetArea && (
              <>
                <p style={{ fontSize: 10, color: "#A78BFA", margin: "12px 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>{t("plan_area_vida")}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {AREA_IDS.map(a => (
                    <button key={a} type="button" onClick={() => setArea(a)}
                      style={{ padding: "10px 4px", borderRadius: 12, border: area === a ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: area === a ? "rgba(124,92,255,0.1)" : "#0B0B10", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
                      <span style={{ fontSize: 18 }}>{AREA_CONFIG[a].emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: area === a ? "#A78BFA" : "#9e96b5" }}>{t(AREA_CONFIG[a].shortLabelKey)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <textarea value={why} onChange={e => setWhy(e.target.value)} placeholder={t("goal_porque_importa")} rows={2} style={{ ...inputS, marginTop: 12, resize: "none", height: 60 }} />
          </>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              { val: "direcao", icon: "🧭", title: t("goal_direcao"), desc: t("goal_direcao_desc") },
              { val: "destino", icon: "🎯", title: t("goal_destino"), desc: t("goal_destino_desc") },
            ] as const).map(opt => (
              <button key={opt.val} type="button" onClick={() => setType(opt.val)}
                style={{ padding: 14, borderRadius: 14, border: type === opt.val ? "2px solid #7C5CFF" : "1px solid rgba(167,139,250,0.15)", background: type === opt.val ? "rgba(124,92,255,0.08)" : "#0B0B10", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>{opt.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>{opt.title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9e96b5" }}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <input value={firstStage} onChange={e => setFirstStage(e.target.value)} placeholder={t("goal_primeira_etapa")} autoFocus style={inputS} />
            <p style={{ fontSize: 10, color: "#9e96b5", margin: "14px 0 10px" }}>{t("goal_opcional_compromisso")}</p>
            <input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder={t("goal_guardiao")} style={{ ...inputS, marginBottom: 8 }} />
            <input value={reward} onChange={e => setReward(e.target.value)} placeholder={t("goal_recompensa")} style={{ ...inputS, marginBottom: 8 }} />
            <input value={punishment} onChange={e => setPunishment(e.target.value)} placeholder={t("goal_punicao")} style={inputS} />
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={step === 1 ? onClose : () => setStep((step - 1) as Step)}
            style={{ flex: 1, padding: 14, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {step === 1 ? t("cancelar") : t("voltar")}
          </button>
          <button type="button" onClick={step < 3 ? () => setStep((step + 1) as Step) : save} disabled={saving}
            style={{ flex: 2, padding: 14, borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
            {step === 3 ? (saving ? t("goal_criando") : t("goal_criar_meta")) : t("goal_continuar")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", color: "#e0d6ff", fontSize: 14,
  fontFamily: "inherit", outline: "none",
};
