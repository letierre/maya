"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import { getLocale } from "@/lib/language";
import { getUserTimezone, getLocalDateFromISO } from "@/lib/utils";
import {
  computeAge, computeBMI, computeBMR, computeTDEE, bmiClass, computeBodyFatNavy,
  type BodySex, type Measurement,
} from "@/lib/body-metrics";
import { StatBox } from "@/components/running/RunningUI";

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "rgba(26,21,48,0.55)",
  borderRadius: 20,
  border: "1px solid rgba(167,139,250,0.2)",
  padding: "18px 16px",
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", minWidth: 0, maxWidth: "100%",
  height: 44, borderRadius: 12,
  border: "1px solid rgba(167,139,250,0.25)",
  background: "rgba(11,11,16,0.5)",
  padding: "0 14px", fontFamily: "inherit",
  fontSize: 14, fontWeight: 500,
  color: "#e0d6ff", outline: "none",
};

// <input type="date"> no iOS impõe largura mínima intrínseca e estoura o card.
const dateInputStyle: React.CSSProperties = {
  ...inputStyle,
  WebkitAppearance: "none", appearance: "none",
};

const label11 = (text: string) => (
  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "#A78BFA" }}>
    {text}
  </p>
);

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, minHeight: 36, padding: "4px 8px", borderRadius: 10, border: 0,
        cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
        background: active ? "#7C5CFF" : "#1e1840",
        color: active ? "#fff" : "#7C5CFF",
      }}>
      {children}
    </button>
  );
}

// Mini gráfico de linha SVG (sparkline) para a evolução.
function MiniLine({ values, color }: { values: number[]; color: string }) {
  const w = 320, h = 96, pad = 8;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
      <polyline points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
    </svg>
  );
}

// ── Form helpers ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  date: "",
  weight: "", height: "", bodyFat: "",
  neck: "", chest: "", waist: "", hip: "", arm: "", thigh: "", calf: "",
  activity: "", goal: "",
};

const numVal = (v: string): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CorpoPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [sex, setSex] = useState<BodySex | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [savingFixed, setSavingFixed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fatHelpOpen, setFatHelpOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/body").then(r => r.json());
      if (res && typeof res === "object") {
        setSex(res.sex || null);
        setBirthDate(res.birth_date || "");
        setMeasurements(Array.isArray(res.measurements) ? res.measurements : []);
      }
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const openNewForm = () => {
    setForm({ ...EMPTY_FORM, date: getLocalDateFromISO(new Date().toISOString()) });
    setEditing(false);
    setFormOpen(true);
  };

  const openEditForm = (m: Measurement) => {
    setForm({
      date: m.recorded_at ? getLocalDateFromISO(m.recorded_at) : "",
      weight: m.weight_kg != null ? String(m.weight_kg) : "",
      height: m.height_cm != null ? String(m.height_cm) : "",
      bodyFat: m.body_fat_pct != null ? String(m.body_fat_pct) : "",
      neck: m.neck_cm != null ? String(m.neck_cm) : "",
      chest: m.chest_cm != null ? String(m.chest_cm) : "",
      waist: m.waist_cm != null ? String(m.waist_cm) : "",
      hip: m.hip_cm != null ? String(m.hip_cm) : "",
      arm: m.arm_cm != null ? String(m.arm_cm) : "",
      thigh: m.thigh_cm != null ? String(m.thigh_cm) : "",
      calf: m.calf_cm != null ? String(m.calf_cm) : "",
      activity: m.activity_level || "",
      goal: m.goal || "",
    });
    setEditing(true);
    setFormOpen(true);
  };

  const saveFixed = async () => {
    setSavingFixed(true);
    try {
      const res = await fetch("/api/body", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sex, birth_date: birthDate || null }),
      });
      if (res.ok) toast.success(t("ck_salvar_alteracoes"));
      else toast.error(t("co_erro_salvar"));
    } catch { toast.error(t("co_erro_salvar")); }
    setSavingFixed(false);
  };

  const saveEntry = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        recorded_at: form.date || undefined,
        tz: getUserTimezone(),
        weight_kg: numVal(form.weight),
        height_cm: numVal(form.height),
        body_fat_pct: numVal(form.bodyFat),
        neck_cm: numVal(form.neck),
        chest_cm: numVal(form.chest),
        waist_cm: numVal(form.waist),
        hip_cm: numVal(form.hip),
        arm_cm: numVal(form.arm),
        thigh_cm: numVal(form.thigh),
        calf_cm: numVal(form.calf),
        activity_level: form.activity || undefined,
        goal: form.goal || undefined,
      };
      const res = await fetch("/api/body/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(t("ck_salvar_alteracoes"));
        setFormOpen(false);
        setEditing(false);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("co_erro_salvar"));
      }
    } catch { toast.error(t("co_erro_salvar")); }
    setSaving(false);
  };

  const deleteEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/body/measurements?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDeleteId(null);
        await load();
      } else {
        toast.error(t("co_erro_salvar"));
      }
    } catch { toast.error(t("co_erro_salvar")); }
  };

  // ── Derivados ───────────────────────────────────────────────────────────────

  const latest = measurements.length ? measurements[measurements.length - 1] : null;
  const weight = latest?.weight_kg ?? undefined;
  const height = latest?.height_cm ?? undefined;
  const bodyFat = latest?.body_fat_pct ?? undefined;
  const bodyBmi = computeBMI(weight, height);
  const bodyAge = computeAge(birthDate || undefined);
  const bodyBmr = computeBMR(sex ?? undefined, weight, height, bodyAge);
  const bodyTdee = computeTDEE(bodyBmr, latest?.activity_level ?? undefined);

  // Estimativa automática de gordura (US Navy) conforme os campos preenchidos.
  const navy = useMemo(() =>
    computeBodyFatNavy(
      sex ?? undefined,
      numVal(form.height), numVal(form.waist), numVal(form.neck), numVal(form.hip),
    ),
  [sex, form.height, form.waist, form.neck, form.hip]);

  const weightSeries = measurements.map(m => m.weight_kg).filter((v): v is number => v != null);
  const fatSeries = measurements.map(m => m.body_fat_pct).filter((v): v is number => v != null);

  const historyDesc = useMemo(() => [...measurements].reverse(), [measurements]);

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/corrida");
  };

  return (
    <div style={{ height: "100dvh", background: "#0B0B10", overflowY: "auto" }}>
      {/* Header fixo */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "calc(env(safe-area-inset-top) + 12px) 16px 12px", display: "flex", alignItems: "center", gap: 10, background: "rgba(11,11,16,0.92)", backdropFilter: "blur(8px)" }}>
        <button type="button" onClick={back} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(26,21,48,0.85)", border: "1px solid rgba(167,139,250,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
          <ChevronLeft size={18} />
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>{t("corpo_titulo")}</h1>
      </div>

      <div style={{ padding: "4px 16px 40px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>…</p>
        ) : (
          <>
            {/* Dados fixos */}
            <div style={card}>
              {label11(t("corpo_dados_fixos"))}
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_sexo")}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Seg active={sex === "male"} onClick={() => setSex("male")}>{t("perfil_sexo_masc")}</Seg>
                  <Seg active={sex === "female"} onClick={() => setSex("female")}>{t("perfil_sexo_fem")}</Seg>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_nascimento")}</p>
                <input type="date" value={birthDate || ""} onChange={(e) => setBirthDate(e.target.value)} style={dateInputStyle} />
                {bodyAge != null && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9e96b5" }}>{t("perfil_anos", { n: String(bodyAge) })}</p>
                )}
              </div>
              <button type="button" onClick={saveFixed} disabled={savingFixed}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.25)", background: "transparent", color: "#A78BFA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: savingFixed ? 0.5 : 1 }}>
                {t("ck_salvar_alteracoes")}
              </button>
            </div>

            {/* Resumo atual */}
            {latest && (
              <div style={card}>
                {label11(t("corpo_resumo"))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <StatBox label={t("perfil_peso")} value={weight != null ? `${weight} kg` : "--"} />
                  <StatBox label={t("perfil_gordura")} value={bodyFat != null ? `${bodyFat}%` : "--"} />
                </div>
                {(bodyBmi || bodyBmr || bodyTdee) && (
                  <div style={{ marginTop: 12, padding: "12px", borderRadius: 12, background: "rgba(124,92,255,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                    {bodyBmi != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: "#9e96b5" }}>{t("perfil_imc")}</span>
                        <span style={{ color: "#e0d6ff", fontWeight: 700 }}>{`${bodyBmi} · ${t(`perfil_imc_${bmiClass(bodyBmi)}`)}`}</span>
                      </div>
                    )}
                    {bodyBmr != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: "#9e96b5" }}>{t("perfil_tmb")}</span>
                        <span style={{ color: "#e0d6ff", fontWeight: 700 }}>{`${bodyBmr} kcal/dia`}</span>
                      </div>
                    )}
                    {bodyTdee != null && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#9e96b5" }}>{t("perfil_tdee")}</span>
                        <span style={{ color: "#e0d6ff", fontWeight: 700 }}>{`${bodyTdee} kcal/dia`}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Registrar / editar lançamento */}
            {!formOpen ? (
              <button type="button" onClick={openNewForm}
                style={{ width: "100%", padding: "14px", borderRadius: 14, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
                + {t("corpo_novo")}
              </button>
            ) : (
              <div style={card}>
                {label11(editing ? t("corpo_editar") : t("corpo_novo"))}

                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("corpo_data")}</p>
                  <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} style={dateInputStyle} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_peso")}</p>
                    <input type="number" inputMode="decimal" step="0.1" value={form.weight} onChange={(e) => setField("weight", e.target.value)} placeholder="70" style={inputStyle} />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_altura")}</p>
                    <input type="number" inputMode="decimal" value={form.height} onChange={(e) => setField("height", e.target.value)} placeholder="175" style={inputStyle} />
                  </div>
                </div>

                {/* Gordura corporal com ajuda + estimativa */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#9e96b5" }}>{t("perfil_gordura")}</p>
                    <button type="button" onClick={() => setFatHelpOpen(v => !v)} style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.35)", background: "transparent", color: "#A78BFA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: 11, lineHeight: 1 }}>
                      <HelpCircle size={13} />
                    </button>
                  </div>
                  <input type="number" inputMode="decimal" step="0.1" value={form.bodyFat} onChange={(e) => setField("bodyFat", e.target.value)} placeholder="—" style={inputStyle} />
                  {fatHelpOpen && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9e96b5", lineHeight: 1.5 }}>{t("corpo_gordura_ajuda_hint")}</p>
                  )}
                  {navy != null && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(34,209,139,0.08)", border: "1px solid rgba(34,209,139,0.25)" }}>
                      <span style={{ fontSize: 12, color: "#22D18B", fontWeight: 600 }}>{t("corpo_gordura_estimada", { v: String(navy) })}</span>
                      <button type="button" onClick={() => setField("bodyFat", String(navy))}
                        style={{ padding: "4px 12px", borderRadius: 9999, border: 0, background: "#22D18B", color: "#06251a", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("corpo_gordura_usar")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Circunferências */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_medidas")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {([["neck", "perfil_pescoco"], ["chest", "perfil_peito"], ["waist", "perfil_cintura"], ["hip", "perfil_quadril"], ["arm", "perfil_braco"], ["thigh", "perfil_coxa"], ["calf", "perfil_panturrilha"]] as const).map(([key, labelKey]) => (
                      <div key={key}>
                        <label style={{ fontSize: 11, color: "#9e96b5", marginBottom: 4, display: "block" }}>{t(labelKey)}</label>
                        <input type="number" inputMode="decimal" step="0.1" value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder="—" style={inputStyle} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Atividade */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_atividade")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {([["sedentary", "perfil_atividade_sedentario"], ["light", "perfil_atividade_leve"], ["moderate", "perfil_atividade_moderado"], ["active", "perfil_atividade_intenso"], ["very_active", "perfil_atividade_atleta"]] as const).map(([id, labelKey]) => (
                      <Seg key={id} active={form.activity === id} onClick={() => setField("activity", id)}>{t(labelKey)}</Seg>
                    ))}
                  </div>
                </div>

                {/* Objetivo */}
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>{t("perfil_objetivo_corpo")}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([["lose", "perfil_objetivo_perder"], ["maintain", "perfil_objetivo_manter"], ["gain", "perfil_objetivo_ganhar"]] as const).map(([id, labelKey]) => (
                      <Seg key={id} active={form.goal === id} onClick={() => setField("goal", id)}>{t(labelKey)}</Seg>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setFormOpen(false); setEditing(false); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("cancelar")}
                  </button>
                  <button type="button" onClick={saveEntry} disabled={saving}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.5 : 1 }}>
                    {t("corpo_salvar")}
                  </button>
                </div>
              </div>
            )}

            {/* Evolução */}
            {(weightSeries.length >= 2 || fatSeries.length >= 2) && (
              <div style={card}>
                {label11(t("corpo_evolucao"))}
                {weightSeries.length >= 2 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9e96b5", fontWeight: 600 }}>{t("corpo_evolucao_peso")}</p>
                    <MiniLine values={weightSeries} color="#7C5CFF" />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a5470" }}>
                      <span>{Math.min(...weightSeries)}</span>
                      <span>{Math.max(...weightSeries)}</span>
                    </div>
                  </div>
                )}
                {fatSeries.length >= 2 && (
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9e96b5", fontWeight: 600 }}>{t("corpo_evolucao_gordura")}</p>
                    <MiniLine values={fatSeries} color="#22D18B" />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5a5470" }}>
                      <span>{Math.min(...fatSeries)}</span>
                      <span>{Math.max(...fatSeries)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Histórico */}
            <div style={card}>
              {label11(t("corpo_historico"))}
              {historyDesc.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9e96b5", padding: 20, fontSize: 13 }}>{t("corpo_nenhum")}</p>
              ) : historyDesc.map(m => {
                const d = m.recorded_at ? new Date(m.recorded_at) : null;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.1)", background: "rgba(167,139,250,0.04)", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e0d6ff", display: "block" }}>
                        {d ? d.toLocaleDateString(getLocale(), { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </span>
                      <span style={{ fontSize: 11, color: "#9e96b5" }}>
                        {m.weight_kg != null ? `${m.weight_kg} kg` : "—"}
                        {m.body_fat_pct != null ? ` · ${m.body_fat_pct}%` : ""}
                        {m.waist_cm != null ? ` · ${t("perfil_cintura")}: ${m.waist_cm} cm` : ""}
                      </span>
                    </div>
                    <button type="button" onClick={() => openEditForm(m)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.25)", background: "transparent", color: "#A78BFA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Pencil size={14} />
                    </button>
                    {confirmDeleteId === m.id ? (
                      <button type="button" onClick={() => deleteEntry(m.id!)} style={{ padding: "6px 10px", borderRadius: 9999, border: 0, background: "#FF4D4D", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("corpo_apagar")}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(m.id!)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,77,77,0.35)", background: "transparent", color: "#FF4D4D", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
