"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, X, ArrowLeft } from "lucide-react";
import { compressImage } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";

// ── Colors & categories ───────────────────────────────────────────────────────

const H = 160;
function fc(l = 0.5, c = 0.14) { return `oklch(${l} ${c} ${H})`; }
function fl() { return `oklch(.96 .04 ${H})`; }
const GREEN = "oklch(.45 .14 160)";
const RED = "oklch(.48 .18 15)";

const EXPENSE_CATS = [
  { id: "moradia",      emoji: "🏠", hue: 40  },
  { id: "alimentacao",  emoji: "🍽️", hue: 30  },
  { id: "transporte",   emoji: "🚗", hue: 220 },
  { id: "saude",        emoji: "💊", hue: 160 },
  { id: "educacao",     emoji: "📚", hue: 270 },
  { id: "lazer",        emoji: "🎮", hue: 185 },
  { id: "beleza",       emoji: "💄", hue: 300 },
  { id: "assinaturas",  emoji: "📱", hue: 200 },
  { id: "vestuario",    emoji: "👕", hue: 215 },
  { id: "outros",       emoji: "⚙️", hue: 160 },
] as const;

const INCOME_CATS = [
  { id: "salario",       emoji: "💼", hue: 160 },
  { id: "freelance",     emoji: "💻", hue: 220 },
  { id: "investimentos", emoji: "📈", hue: 75  },
  { id: "presente",      emoji: "🎁", hue: 300 },
  { id: "outros",        emoji: "⚙️", hue: 160 },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = "capture" | "analyzing" | "review";

type Draft = {
  type: "receita" | "despesa";
  amount: string;
  category: string;
  description: string;
  date: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancasRegistrarPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [draft, setDraft] = useState<Draft>({
    type: "despesa",
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

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
  const canSave = draft.amount !== "" && Number(draft.amount) > 0 && draft.category.length > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: "1.5px solid oklch(.82 .03 160)",
    background: "oklch(.98 .005 160)", fontFamily: "inherit",
    fontSize: 14, color: "oklch(.2 .02 160)", outline: "none",
  };

  // ── Header shared ─────────────────────────────────────────────────────────
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
        minHeight: "100dvh", background: "oklch(.98 .004 160)",
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
        <p style={{ fontSize: 14, color: "oklch(.5 .06 160)", fontWeight: 600 }}>
          {tFn(lang, "fin_analisando")}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Review (pre-filled editable form) ────────────────────────────────────
  if (stage === "review") {
    return (
      <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 110 }}>
        <Header onBack={() => setStage("capture")} title={tFn(lang, "fin_nova_tx")} />

        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Photo thumbnail + retake */}
          {photo && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, background: "#fff", border: "1.5px solid oklch(.9 .02 160)" }}>
              <img src={photo} alt="Recibo" style={{ width: 68, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "oklch(.35 .03 160)" }}>Recibo analisado pela IA</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "oklch(.6 .03 160)" }}>Confira e edite os campos abaixo</p>
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
              <button key={tp} type="button" onClick={() => setDraft((p) => ({ ...p, type: tp, category: "" }))} style={{
                flex: 1, padding: "13px 10px", borderRadius: 14, border: 0, cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                background: draft.type === tp ? (tp === "despesa" ? RED : GREEN) : "oklch(.92 .02 160)",
                color: draft.type === tp ? "#fff" : "oklch(.45 .06 160)",
                transition: "all .15s ease",
              }}>
                {tp === "despesa" ? `↓ ${tFn(lang, "fin_despesa_label")}` : `↑ ${tFn(lang, "fin_receita_label")}`}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
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
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          {/* Category */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_categoria")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {cats.map((c) => {
                const sel = draft.category === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => setDraft((p) => ({ ...p, category: c.id }))} style={{
                    padding: "10px 4px", borderRadius: 12,
                    border: sel ? `2px solid oklch(.5 .14 ${c.hue})` : "2px solid oklch(.88 .02 160)",
                    background: sel ? `oklch(.95 .05 ${c.hue})` : "#fff",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    transition: "all .12s ease",
                  }}>
                    <span style={{ fontSize: 18 }}>{c.emoji}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textAlign: "center", lineHeight: 1.2, color: sel ? `oklch(.45 .12 ${c.hue})` : "oklch(.55 .03 160)" }}>
                      {tFn(lang, `fin_cat_${c.id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_descricao")}
            </p>
            <input
              value={draft.description}
              onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder={tFn(lang, "fin_descricao_ph")}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          {/* Date */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "oklch(.55 .04 160)" }}>
              {tFn(lang, "fin_data")}
            </p>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = fc(); }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "oklch(.82 .03 160)"; }}
            />
          </div>

          <button type="button" onClick={save} disabled={!canSave || saving} style={{
            marginTop: 8, width: "100%", padding: "16px 20px", borderRadius: 16, border: 0,
            cursor: (!canSave || saving) ? "not-allowed" : "pointer",
            background: (!canSave || saving) ? "oklch(.88 .02 160)" : fc(),
            fontFamily: "inherit", fontSize: 16, fontWeight: 700,
            color: (!canSave || saving) ? "oklch(.6 .02 160)" : "#fff",
            transition: "all .15s ease",
          }}>
            {saving ? tFn(lang, "salvando") : tFn(lang, "salvar")}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "oklch(.98 .004 160)", paddingBottom: 40 }}>
      <Header onBack={() => router.back()} title="Registrar por foto" />

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {photo ? (
          <>
            {/* Photo preview */}
            <div style={{ position: "relative" }}>
              <img
                src={photo}
                alt="Recibo"
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 20 }}
              />
              <button type="button" onClick={() => setPhoto(null)} style={{
                position: "absolute", top: 12, right: 12,
                width: 34, height: 34, borderRadius: "50%",
                background: "oklch(.08 .02 160 / .65)", border: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={16} color="#fff" />
              </button>
            </div>

            {/* Retake options */}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: "1.5px solid oklch(.85 .02 160)", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: "oklch(.4 .04 160)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Camera size={15} /> Câmera
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: "1.5px solid oklch(.85 .02 160)", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: "oklch(.4 .04 160)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <ImageIcon size={15} /> Galeria
              </button>
            </div>

            {/* Analyze */}
            <button type="button" onClick={analyze} style={{
              width: "100%", padding: "16px 20px", borderRadius: 16, border: 0, cursor: "pointer",
              background: fc(), fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              Analisar recibo →
            </button>
          </>
        ) : (
          /* Empty state — pick photo */
          <div style={{
            background: "#fff", borderRadius: 24,
            border: "2px dashed oklch(.82 .03 160)",
            padding: "56px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center",
          }}>
            <span style={{ fontSize: 56 }}>🧾</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "oklch(.25 .02 160)" }}>
                Foto do recibo ou nota
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "oklch(.6 .03 160)", lineHeight: 1.5 }}>
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
                border: "1.5px solid oklch(.82 .03 160)",
                background: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: fc(), display: "flex", alignItems: "center", gap: 8,
              }}>
                <ImageIcon size={18} /> Galeria
              </button>
            </div>
          </div>
        )}

        {/* Manual fallback */}
        <button type="button" onClick={() => router.push("/financas")} style={{
          border: 0, background: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          color: "oklch(.6 .04 160)", padding: "4px 0", textAlign: "center",
        }}>
          Registrar manualmente →
        </button>
      </div>

      {/* Hidden file inputs */}
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
