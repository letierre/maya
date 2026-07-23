"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, X, ArrowLeft, Settings } from "lucide-react";
import { compressImage } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { EXPENSE_CATS, INCOME_CATS, getSubcats, type FinCat, type CustomCat } from "@/lib/financas-categories";

// ── Colors ────────────────────────────────────────────────────────────────────

const H = 270;
function fc(l = 0.47, c = 0.18) { return `oklch(${l} ${c} ${H})`; }
function fl() { return `oklch(.22 .02 ${H})`; }
const GREEN = "#7C5CFF";
const RED = "oklch(.48 .18 15)";

// ── Category label helper ─────────────────────────────────────────────────────

function catLabel(c: FinCat, lang: Lang, customCat: CustomCat | null): string {
  if (c.custom) return customCat?.name ?? tFn(lang, "fin_cat_personalizada");
  return tFn(lang, `fin_cat_${c.id}`);
}

// ── Category picker (two-level) ───────────────────────────────────────────────

function CategoryPicker({
  type, category, subcategory, lang, customCat,
  onSelect, onEditCustom,
}: {
  type: "receita" | "despesa";
  category: string;
  subcategory: string;
  lang: Lang;
  customCat: CustomCat | null;
  onSelect: (cat: string, sub: string) => void;
  onEditCustom: () => void;
}) {
  const cats = type === "despesa" ? EXPENSE_CATS : INCOME_CATS;
  const cols = type === "despesa" ? "repeat(4, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))";
  const selectedCat = cats.find((c) => c.id === category);
  const subcats = category ? getSubcats(category, cats, customCat) : [];

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
        {tFn(lang, "fin_categoria")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6 }}>
        {cats.map((c) => {
          const sel = category === c.id;
          const label = catLabel(c, lang, customCat);
          const emoji = c.custom ? (customCat?.emoji ?? c.emoji) : c.emoji;
          return (
            <div key={c.id} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => onSelect(c.id, "")}
                style={{
                  width: "100%", padding: "10px 4px", borderRadius: 12,
                  border: sel ? `2px solid oklch(.5 .14 ${c.hue})` : "2px solid oklch(0.28 0.02 270 / 0.5)",
                  background: sel ? `oklch(.95 .05 ${c.hue})` : "#fff",
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, transition: "all .12s ease",
                }}
              >
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, textAlign: "center", lineHeight: 1.2,
                  color: sel ? `#e0d6ff` : "oklch(0.55 0.03 270)",
                }}>
                  {label}
                </span>
              </button>
              {c.custom && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEditCustom(); }}
                  style={{
                    position: "absolute", top: 3, right: 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "oklch(0.28 0.02 270 / 0.5)", border: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Settings size={10} style={{ color: "oklch(0.55 0.03 270)" }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Subcategory chips */}
      {subcats.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
            {tFn(lang, "fin_subcategoria")}
          </p>
          <div style={{ overflowX: "auto", display: "flex", gap: 6, paddingBottom: 4 }}>
            {subcats.map((sc) => {
              const selSub = subcategory === sc.label;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelect(category, sc.label)}
                  style={{
                    flexShrink: 0, padding: "6px 13px", borderRadius: 20,
                    border: selSub
                      ? `1.5px solid oklch(.5 .14 ${selectedCat?.hue ?? 270})`
                      : "1.5px solid oklch(0.28 0.02 270 / 0.5)",
                    background: selSub ? `oklch(.95 .05 ${selectedCat?.hue ?? 270})` : "#fff",
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    fontSize: 12, fontWeight: 600,
                    color: selSub ? `oklch(.45 .12 ${selectedCat?.hue ?? 270})` : "oklch(0.55 0.03 270)",
                    transition: "all .12s ease",
                  }}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Category Edit Modal ────────────────────────────────────────────────

function CustomCatModal({
  customCat, lang, onClose, onSaved,
}: {
  customCat: CustomCat | null;
  lang: Lang;
  onClose: () => void;
  onSaved: (updated: CustomCat) => void;
}) {
  const [name, setName] = useState(customCat?.name ?? "Personalizada");
  const [emoji, setEmoji] = useState(customCat?.emoji ?? "⭐");
  const [subcats, setSubcats] = useState<string[]>(customCat?.subcats ?? ["Personalizado"]);
  const [newSubcat, setNewSubcat] = useState("");
  const [saving, setSaving] = useState(false);

  const addSubcat = () => {
    const v = newSubcat.trim();
    if (v && !subcats.includes(v)) { setSubcats((p) => [...p, v]); }
    setNewSubcat("");
  };

  const save = async () => {
    setSaving(true);
    const updated: CustomCat = { name: name.trim() || "Personalizada", emoji: emoji || "⭐", subcats };
    const prefsRes = await fetch("/api/preferences").then((r) => r.json());
    const ctx = prefsRes.context ?? {};
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { ...ctx, custom_fin_cat: updated } }),
    });
    setSaving(false);
    onSaved(updated);
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    borderRadius: 10, border: "1.5px solid oklch(0.28 0.02 270 / 0.5)",
    background: "oklch(0.22 0.02 270)", fontFamily: "inherit",
    fontSize: 14, color: "#e0d6ff", outline: "none",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "oklch(.1 .02 270 / .4)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
        borderRadius: "24px 24px 0 0", background: "#fff",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px oklch(.2 .04 270 / .15)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "oklch(0.22 0.02 270)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>
              {tFn(lang, "fin_personalizada_editar")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "oklch(0.22 0.02 270)", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "oklch(0.55 0.03 270)" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div>
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(0.55 0.03 270)" }}>
                Emoji
              </p>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                style={{ ...inputStyle, width: 56, textAlign: "center", fontSize: 20, padding: "8px 6px" }}
                maxLength={4}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(0.55 0.03 270)" }}>
                {tFn(lang, "fin_personalizada_nome")}
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(0.28 0.02 270 / 0.5)"; }}
              />
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "oklch(0.55 0.03 270)" }}>
              {tFn(lang, "fin_personalizada_subcats")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subcats.map((sc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "oklch(0.7 0.03 270)", padding: "8px 12px", borderRadius: 10, background: "oklch(0.22 0.02 270)" }}>
                    {sc}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubcats((p) => p.filter((_, j) => j !== i))}
                    style={{ border: 0, background: "none", cursor: "pointer", padding: 6, color: "oklch(.65 .08 15)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={newSubcat}
                onChange={(e) => setNewSubcat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcat(); } }}
                placeholder={tFn(lang, "fin_personalizada_adicionar")}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(0.28 0.02 270 / 0.5)"; }}
              />
              <button type="button" onClick={addSubcat} style={{
                border: 0, background: fl(), borderRadius: 10, padding: "0 14px",
                cursor: "pointer", fontSize: 18, color: fc(), fontFamily: "inherit", fontWeight: 700,
              }}>
                +
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          marginTop: 20, width: "100%", padding: "14px 20px", borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "oklch(0.28 0.02 270 / 0.5)" : fc(),
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: saving ? "oklch(0.4 0.02 270)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "fin_personalizada_salvar")}
        </button>
      </div>
    </>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = "capture" | "analyzing" | "review";

type Draft = {
  type: "receita" | "despesa";
  amount: string;
  category: string;
  subcategory: string;
  description: string;
  date: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancasRegistrarPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [customCat, setCustomCat] = useState<CustomCat | null>(null);
  const [showCustomEdit, setShowCustomEdit] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [draft, setDraft] = useState<Draft>({
    type: "despesa",
    amount: "",
    category: "",
    subcategory: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((prefs) => {
        if (prefs.context?.custom_fin_cat) setCustomCat(prefs.context.custom_fin_cat);
      })
      .catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => setPhoto(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setStage("analyzing");
    try {
      const cleanBase64 = photo.replace(/^data:image\/\w+;base64,/, "");
      const res = await fetch("/api/financas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: cleanBase64, mediaType: "image/jpeg" }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraft({
          type: data.type ?? "despesa",
          amount: data.amount ? String(data.amount) : "",
          category: data.category ?? "",
          subcategory: data.subcategory ?? "",
          description: data.description ?? "",
          date: data.date ?? new Date().toISOString().slice(0, 10),
        });
      }
    } catch { /* keep default draft */ }
    setStage("review");
  };

  const save = async () => {
    if (!draft.amount || !draft.category) return;
    setSaving(true);
    try {
      await fetch("/api/financas/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          amount: Number(draft.amount),
          category: draft.category,
          subcategory: draft.subcategory || null,
          description: draft.description || null,
          date: draft.date,
        }),
      });
      router.push("/financas");
    } catch {
      setSaving(false);
    }
  };

  const cats = draft.type === "despesa" ? EXPENSE_CATS : INCOME_CATS;
  const subcatsForCat = draft.category ? getSubcats(draft.category, cats, customCat) : [];
  const canSave = draft.amount !== "" && Number(draft.amount) > 0 && draft.category.length > 0
    && (subcatsForCat.length === 0 || draft.subcategory.length > 0);

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(0.28 0.02 270 / 0.5)",
    background: "oklch(0.22 0.02 270)", fontFamily: "inherit",
    fontSize: 14, color: "#e0d6ff", outline: "none",
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = ({ onBack, title }: { onBack: () => void; title: string }) => (
    <div style={{
      background: `linear-gradient(160deg, ${fc(.44, .16)}, ${fc(.38, .14)})`,
      padding: "52px 20px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={onBack} style={{
          width: 36, height: 36, borderRadius: "50%", border: 0, cursor: "pointer",
          background: "oklch(1 0 0 / .2)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff" }}>{title}</h1>
      </div>
    </div>
  );

  // ── Analyzing ─────────────────────────────────────────────────────────────
  if (stage === "analyzing") {
    return (
      <div style={{
        minHeight: "100dvh", background: "oklch(0.12 0.012 270)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
      }}>
        {photo && (
          <img src={photo} alt="Recibo" style={{
            width: 180, height: 135, objectFit: "cover", borderRadius: 20, opacity: 0.45,
          }} />
        )}
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          border: `3px solid ${fc()}`, borderTopColor: "transparent",
          animation: "spin .8s linear infinite",
        }} />
        <p style={{ fontSize: 14, color: "oklch(0.55 0.03 270)", fontWeight: 600 }}>
          {tFn(lang, "fin_analisando")}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Review (pre-filled editable form) ────────────────────────────────────
  if (stage === "review") {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(0.12 0.012 270)", paddingBottom: 110 }}>
        <Header onBack={() => setStage("capture")} title={tFn(lang, "fin_nova_tx")} />

        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Photo thumbnail */}
          {photo && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, background: "oklch(0.16 0.012 270)", border: "1.5px solid oklch(0.28 0.02 270 / 0.5)" }}>
              <img src={photo} alt="Recibo" style={{ width: 68, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "oklch(0.7 0.03 270)" }}>Recibo analisado pela IA</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "oklch(0.55 0.03 270)" }}>Confira e edite os campos abaixo</p>
              </div>
              <button type="button" onClick={() => setStage("capture")} style={{
                border: 0, background: fl(), borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: fc(), fontFamily: "inherit", flexShrink: 0,
              }}>
                Outra foto
              </button>
            </div>
          )}

          {/* Type toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["despesa", "receita"] as const).map((tp) => (
              <button key={tp} type="button"
                onClick={() => setDraft((p) => ({ ...p, type: tp, category: "", subcategory: "" }))}
                style={{
                  flex: 1, padding: "13px 10px", borderRadius: 14, border: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  background: draft.type === tp ? (tp === "despesa" ? RED : GREEN) : "oklch(0.22 0.02 270)",
                  color: draft.type === tp ? "#fff" : "oklch(0.55 0.03 270)",
                  transition: "all .15s ease",
                }}>
                {tp === "despesa" ? `↓ ${tFn(lang, "fin_despesa_label")}` : `↑ ${tFn(lang, "fin_receita_label")}`}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
              {tFn(lang, "fin_valor")}
            </p>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0,00"
              style={{ ...inputStyle, fontSize: 28, fontWeight: 800 }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(0.28 0.02 270 / 0.5)"; }}
            />
          </div>

          {/* Category + subcategory picker */}
          <CategoryPicker
            type={draft.type}
            category={draft.category}
            subcategory={draft.subcategory}
            lang={lang}
            customCat={customCat}
            onSelect={(cat, sub) => setDraft((p) => ({ ...p, category: cat, subcategory: sub }))}
            onEditCustom={() => setShowCustomEdit(true)}
          />

          {/* Description */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
              {tFn(lang, "fin_descricao")}
            </p>
            <input
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder={tFn(lang, "fin_descricao_ph")}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(0.28 0.02 270 / 0.5)"; }}
            />
          </div>

          {/* Date */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(0.55 0.03 270)" }}>
              {tFn(lang, "fin_data")}
            </p>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(0.28 0.02 270 / 0.5)"; }}
            />
          </div>

          <button type="button" onClick={save} disabled={!canSave || saving} style={{
            marginTop: 8, width: "100%", padding: "16px 20px", borderRadius: 16, border: 0,
            cursor: (!canSave || saving) ? "not-allowed" : "pointer",
            background: (!canSave || saving) ? "oklch(0.28 0.02 270 / 0.5)" : fc(),
            fontFamily: "inherit", fontSize: 16, fontWeight: 700,
            color: (!canSave || saving) ? "oklch(0.4 0.02 270)" : "#fff",
            transition: "all .15s ease",
          }}>
            {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
          </button>
        </div>

        {showCustomEdit && (
          <CustomCatModal
            customCat={customCat}
            lang={lang}
            onClose={() => setShowCustomEdit(false)}
            onSaved={(updated) => setCustomCat(updated)}
          />
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "oklch(0.12 0.012 270)", paddingBottom: 40 }}>
      <Header onBack={() => router.back()} title="Registrar por foto" />

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {photo ? (
          <>
            <div style={{ position: "relative" }}>
              <img
                src={photo}
                alt="Recibo"
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 20 }}
              />
              <button type="button" onClick={() => setPhoto(null)} style={{
                position: "absolute", top: 12, right: 12,
                width: 34, height: 34, borderRadius: "50%",
                background: "oklch(.08 .02 270 / .65)", border: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={16} color="#fff" />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: "1.5px solid oklch(0.22 0.02 270)", background: "oklch(0.16 0.012 270)",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: "oklch(0.55 0.03 270)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Camera size={15} /> Câmera
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: "1.5px solid oklch(0.22 0.02 270)", background: "oklch(0.16 0.012 270)",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: "oklch(0.55 0.03 270)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <ImageIcon size={15} /> Galeria
              </button>
            </div>

            <button type="button" onClick={analyze} style={{
              width: "100%", padding: "16px 20px", borderRadius: 16, border: 0, cursor: "pointer",
              background: fc(), fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              Analisar recibo →
            </button>
          </>
        ) : (
          <div style={{
            background: "oklch(0.16 0.012 270)", borderRadius: 24,
            border: "2px dashed oklch(0.28 0.02 270 / 0.5)",
            padding: "56px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center",
          }}>
            <span style={{ fontSize: 56 }}>🧾</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>
                Foto do recibo ou nota
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "oklch(0.55 0.03 270)", lineHeight: 1.5 }}>
                A IA extrai o valor, categoria e data automaticamente
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14, border: 0, cursor: "pointer",
                background: fc(), fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: "#fff", display: "flex", alignItems: "center", gap: 8,
              }}>
                <Camera size={18} /> Câmera
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14,
                border: "1.5px solid oklch(0.28 0.02 270 / 0.5)",
                background: "oklch(0.16 0.012 270)", cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: fc(), display: "flex", alignItems: "center", gap: 8,
              }}>
                <ImageIcon size={18} /> Galeria
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => router.push("/financas")} style={{
          border: 0, background: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          color: "oklch(0.55 0.03 270)", padding: "4px 0", textAlign: "center",
        }}>
          Registrar manualmente →
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
      />
    </div>
  );
}
