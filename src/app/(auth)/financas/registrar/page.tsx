"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImageIcon, X, ArrowLeft } from "lucide-react";
import { compressImage } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { EXPENSE_CATS, INCOME_CATS, getSubcats, type CustomCat, type UserCategory } from "@/lib/financas-categories";
import { CategoryPicker } from "@/components/financas/CategoryPicker";
import { CustomCatModal } from "@/components/financas/CustomCatModal";
import { CategoryManager } from "@/components/financas/CategoryManager";

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG = "#0B0B10";
const SURFACE = "#151520";
const CARD = "#1a1530";
const BORDER = "rgba(167,139,250,0.15)";
const TEXT = "#e0d6ff";
const TEXT_SEC = "#9e96b5";
const ACCENT = "#7C5CFF";
const RED = "#FF5C5C";
const GREEN = "#22c55e";

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
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [hiddenCatIds, setHiddenCatIds] = useState<string[]>([]);
  const [showCustomEdit, setShowCustomEdit] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("capture");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/preferences").then((r) => r.json()),
      fetch("/api/financas/categories").then((r) => r.json()),
    ]).then(([prefs, catsRes]) => {
      if (prefs.context?.custom_fin_cat) setCustomCat(prefs.context.custom_fin_cat);
      if (catsRes?.categories) setUserCategories(catsRes.categories);
      if (catsRes?.hiddenFinCats) setHiddenCatIds(catsRes.hiddenFinCats);
    }).catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    try {
      // Recibos têm números pequenos — mantém resolução alta p/ a IA ler os valores
      const compressed = await compressImage(file, { maxDim: 1568, quality: 0.85 });
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
      const mime = photo.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/jpeg";
      const res = await fetch("/api/financas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: cleanBase64, mediaType: mime }),
      });
      if (res.ok) {
        const data = await res.json();
        const txs = Array.isArray(data.transactions) ? data.transactions : [];
        if (txs.length > 0) {
          setDrafts(txs.map((t: Partial<Draft>) => ({
            type: t.type ?? "despesa",
            amount: t.amount ? String(t.amount) : "",
            category: t.category ?? "",
            subcategory: t.subcategory ?? "",
            description: t.description ?? "",
            date: t.date ?? new Date().toISOString().slice(0, 10),
          })));
        } else {
          toast.error("Não consegui ler os dados da foto. Preencha manualmente abaixo.");
        }
      } else {
        toast.error("Não consegui analisar a foto. Tente outra imagem ou preencha manualmente.");
      }
    } catch {
      toast.error("Erro ao analisar a foto. Preencha manualmente abaixo.");
    }
    setStage("review");
  };

  const isDraftValid = (d: Draft) => {
    if (d.amount === "" || Number(d.amount) <= 0 || d.category.length === 0) return false;
    const cats = d.type === "despesa" ? EXPENSE_CATS : INCOME_CATS;
    const subcats = d.category ? getSubcats(d.category, cats, customCat) : [];
    return subcats.length === 0 || d.subcategory.length > 0;
  };

  const save = async () => {
    const valid = drafts.filter(isDraftValid);
    if (valid.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(valid.map((d) =>
        fetch("/api/financas/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: d.type,
            amount: Number(d.amount),
            category: d.category,
            subcategory: d.subcategory || null,
            description: d.description || null,
            date: d.date,
          }),
        })
      ));
      router.push("/financas");
    } catch {
      setSaving(false);
      toast.error("Erro ao salvar transações");
    }
  };

  const canSave = drafts.some(isDraftValid);

  const updateDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  const addDraft = () =>
    setDrafts((prev) => [...prev, {
      type: "despesa", amount: "", category: "", subcategory: "",
      description: "", date: new Date().toISOString().slice(0, 10),
    }]);

  const inputS: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    borderRadius: 12, border: `1px solid ${BORDER}`,
    background: "#0B0B10", fontFamily: "inherit",
    fontSize: 14, color: TEXT, outline: "none",
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = ({ onBack, title }: { onBack: () => void; title: string }) => (
    <div style={{
      background: `linear-gradient(160deg, ${ACCENT}, #5B3FCF)`,
      padding: "44px 20px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={onBack} style={{
          width: 36, height: 36, borderRadius: "50%", border: 0, cursor: "pointer",
          background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
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
        minHeight: "100dvh", background: BG, overflowX: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24,
      }}>
        {photo && (
          <img src={photo} alt="Recibo" style={{
            width: 180, height: 135, objectFit: "cover", borderRadius: 20, opacity: 0.45,
          }} />
        )}
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          border: `3px solid ${ACCENT}`, borderTopColor: "transparent",
          animation: "spin .8s linear infinite",
        }} />
        <p style={{ fontSize: 14, color: TEXT_SEC, fontWeight: 600 }}>
          {tFn(lang, "fin_analisando")}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Review (pre-filled editable list) ────────────────────────────────────
  if (stage === "review") {
    const validCount = drafts.filter(isDraftValid).length;
    return (
      <div style={{ minHeight: "100dvh", background: BG, paddingBottom: 110, overflowX: "hidden" }}>
        <Header onBack={() => setStage("capture")} title={tFn(lang, "fin_nova_tx")} />

        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Photo thumbnail */}
          {photo && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 16, background: SURFACE, border: `1px solid ${BORDER}` }}>
              <img src={photo} alt="Recibo" style={{ width: 68, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT }}>
                  {drafts.length === 0 ? "Nada encontrado" : `${drafts.length} ${drafts.length === 1 ? "transação" : "transações"} encontradas`}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXT_SEC }}>Confira e edite antes de salvar</p>
              </div>
              <button type="button" onClick={() => setStage("capture")} style={{
                border: 0, background: "rgba(124,92,255,0.1)", borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "inherit", flexShrink: 0,
              }}>
                Outra foto
              </button>
            </div>
          )}

          {/* Transaction cards */}
          {drafts.map((d, i) => (
            <div key={i} style={{
              background: CARD, borderRadius: 18, border: `1px solid ${BORDER}`,
              padding: 16, display: "flex", flexDirection: "column", gap: 14,
            }}>
              {/* Header: index + type toggle + remove */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>#{i + 1}</span>
                <div style={{ display: "flex", gap: 6, flex: 1 }}>
                  {(["despesa", "receita"] as const).map((tp) => (
                    <button key={tp} type="button"
                      onClick={() => updateDraft(i, { type: tp, category: "", subcategory: "" })}
                      style={{
                        flex: 1, padding: "9px 8px", borderRadius: 12, border: 0, cursor: "pointer",
                        fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                        background: d.type === tp ? (tp === "despesa" ? RED : GREEN) : "#0B0B10",
                        color: d.type === tp ? "#fff" : TEXT_SEC,
                        transition: "all .15s ease",
                      }}>
                      {tp === "despesa" ? `↓ ${tFn(lang, "fin_despesa_label")}` : `↑ ${tFn(lang, "fin_receita_label")}`}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => removeDraft(i)} style={{
                  border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer", flexShrink: 0,
                }}>
                  <X size={16} style={{ color: TEXT_SEC }} />
                </button>
              </div>

              {/* Amount */}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: TEXT_SEC }}>
                  {tFn(lang, "fin_valor")}
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={d.amount}
                  onChange={(e) => updateDraft(i, { amount: e.target.value })}
                  placeholder="0,00"
                  style={{ ...inputS, fontSize: 26, fontWeight: 800 }}
                />
              </div>

              {/* Category + subcategory picker */}
              <CategoryPicker
                type={d.type}
                category={d.category}
                subcategory={d.subcategory}
                lang={lang}
                customCat={customCat}
                userCategories={userCategories}
                hiddenCatIds={hiddenCatIds}
                onSelect={(cat, sub) => updateDraft(i, { category: cat, subcategory: sub })}
                onManage={() => setShowCategoryManager(true)}
              />

              {/* Description */}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: TEXT_SEC }}>
                  {tFn(lang, "fin_descricao")}
                </p>
                <input
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  placeholder={tFn(lang, d.type === "despesa" ? "fin_descricao_ph" : "fin_descricao_ph_receita")}
                  style={inputS}
                />
              </div>

              {/* Date */}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: TEXT_SEC }}>
                  {tFn(lang, "fin_data")}
                </p>
                <input
                  type="date"
                  value={d.date}
                  onChange={(e) => updateDraft(i, { date: e.target.value })}
                  style={inputS}
                />
              </div>
            </div>
          ))}

          {/* Add another */}
          <button type="button" onClick={addDraft} style={{
            width: "100%", padding: "13px", borderRadius: 14, border: `1px dashed ${BORDER}`,
            background: "transparent", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, color: ACCENT,
          }}>
            + Adicionar transação
          </button>

          {/* Save */}
          <button type="button" onClick={save} disabled={!canSave || saving} style={{
            width: "100%", padding: "16px 20px", borderRadius: 16, border: 0,
            cursor: (!canSave || saving) ? "not-allowed" : "pointer",
            background: (!canSave || saving) ? "rgba(124,92,255,0.2)" : ACCENT,
            fontFamily: "inherit", fontSize: 16, fontWeight: 700,
            color: (!canSave || saving) ? "rgba(167,139,250,0.5)" : "#fff",
            transition: "all .15s ease",
          }}>
            {saving
              ? tFn(lang, "salvando")
              : validCount === 0
                ? "Salvar"
                : `Salvar ${validCount} ${validCount === 1 ? "transação" : "transações"}`}
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

        {showCategoryManager && (
          <CategoryManager
            type={drafts[0]?.type ?? "despesa"}
            hiddenIds={hiddenCatIds}
            userCategories={userCategories}
            customCat={customCat}
            lang={lang}
            onHiddenChange={setHiddenCatIds}
            onCategoriesChange={async () => {
              const catsRes = await fetch("/api/financas/categories").then((r) => r.json());
              if (catsRes?.categories) setUserCategories(catsRes.categories);
              if (catsRes?.hiddenFinCats) setHiddenCatIds(catsRes.hiddenFinCats);
            }}
            onClose={() => setShowCategoryManager(false)}
          />
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: BG, paddingBottom: 40, overflowX: "hidden" }}>
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
                background: "rgba(0,0,0,0.65)", border: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={16} color="#fff" />
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: `1px solid ${BORDER}`, background: SURFACE,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: TEXT_SEC, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Camera size={15} /> Câmera
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                flex: 1, padding: "11px", borderRadius: 12,
                border: `1px solid ${BORDER}`, background: SURFACE,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                color: TEXT_SEC, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <ImageIcon size={15} /> Galeria
              </button>
            </div>

            <button type="button" onClick={analyze} style={{
              width: "100%", padding: "16px 20px", borderRadius: 16, border: 0, cursor: "pointer",
              background: ACCENT, fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              Analisar recibo →
            </button>
          </>
        ) : (
          <div style={{
            background: SURFACE, borderRadius: 24,
            border: `2px dashed ${BORDER}`,
            padding: "56px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center",
          }}>
            <span style={{ fontSize: 56 }}>🧾</span>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: TEXT }}>
                Foto do recibo ou nota
              </p>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>
                A IA extrai o valor, categoria e data automaticamente
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14, border: 0, cursor: "pointer",
                background: ACCENT, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: "#fff", display: "flex", alignItems: "center", gap: 8,
              }}>
                <Camera size={18} /> Câmera
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: SURFACE, cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: ACCENT, display: "flex", alignItems: "center", gap: 8,
              }}>
                <ImageIcon size={18} /> Galeria
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => router.push("/financas")} style={{
          border: 0, background: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          color: TEXT_SEC, padding: "4px 0", textAlign: "center",
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
