"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImageIcon, X, ArrowLeft } from "lucide-react";
import { compressImage } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";
import { useTranslation } from "@/lib/useTranslation";
import { t as tFn, type Lang } from "@/lib/i18n";
import { mergeCats, type CustomCat, type UserCategory, type SubcatOverrides, type FinCat } from "@/lib/financas-categories";
import { CategoryPicker } from "@/components/financas/CategoryPicker";
import { TransactionModal } from "@/components/financas/TransactionModal";
import { CustomCatModal } from "@/components/financas/CustomCatModal";
import { CategoryManager } from "@/components/financas/CategoryManager";
import { MayaAvatar } from "@/components/MayaAvatar";

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

// ── Guide + normalização da IA ──────────────────────────────────────────────

// Monta a lista de categorias/subcategorias do usuário (para instruir a IA a
// escolher apenas opções existentes).
function buildCategoryGuide(
  lang: Lang,
  hiddenCatIds: string[],
  userCategories: UserCategory[],
  customCat: CustomCat | null,
  subcatOverrides: SubcatOverrides,
) {
  const catLabel = (c: FinCat) => c.custom
    ? (c.id.startsWith("user_")
        ? userCategories.find((u) => `user_${u.id}` === c.id)?.name ?? c.id
        : customCat?.name ?? tFn(lang, "fin_cat_personalizada"))
    : tFn(lang, `fin_cat_${c.id}`);
  const map = (cats: FinCat[]) => cats.map((c) => ({ id: c.id, label: catLabel(c), subcats: c.subcats.map((s) => s.label) }));
  return {
    despesa: map(mergeCats("despesa", hiddenCatIds, userCategories, customCat, subcatOverrides)),
    receita: map(mergeCats("receita", hiddenCatIds, userCategories, customCat, subcatOverrides)),
  };
}

// Ajusta o retorno da IA para o modelo do app: categoria válida (ou "outros")
// e subcategoria existente (ou ""). Evita subcategoria inventada e drop silencioso.
function normalizeDraft(
  d: Draft,
  hiddenCatIds: string[],
  userCategories: UserCategory[],
  customCat: CustomCat | null,
  subcatOverrides: SubcatOverrides,
): Draft {
  const cats = mergeCats(d.type, hiddenCatIds, userCategories, customCat, subcatOverrides);
  const cat = cats.find((c) => c.id === d.category);
  const category = cat ? d.category : "outros";
  const subcats = (cat?.subcats ?? []).map((s) => s.label);
  let subcategory = d.subcategory ?? "";
  if (subcategory) {
    const exact = subcats.find((s) => s.toLowerCase() === subcategory.toLowerCase());
    if (exact) {
      subcategory = exact;
    } else {
      const includes = subcats.find((s) =>
        subcategory.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(subcategory.toLowerCase())
      );
      subcategory = includes ?? "";
    }
  }
  return { ...d, category, subcategory };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancasRegistrarPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [customCat, setCustomCat] = useState<CustomCat | null>(null);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [hiddenCatIds, setHiddenCatIds] = useState<string[]>([]);
  const [subcatOverrides, setSubcatOverrides] = useState<SubcatOverrides>({ hidden: {}, custom: {} });
  const [currency, setCurrency] = useState("BRL");
  const [showCustomEdit, setShowCustomEdit] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showManual, setShowManual] = useState(false);
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
      if (prefs.context?.currency) setCurrency(prefs.context.currency);
      if (catsRes?.categories) setUserCategories(catsRes.categories);
      if (catsRes?.hiddenFinCats) setHiddenCatIds(catsRes.hiddenFinCats);
      setSubcatOverrides({
        hidden: catsRes?.hiddenFinSubcats ?? {},
        custom: catsRes?.customFinSubcats ?? {},
      });
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
      const guide = buildCategoryGuide(lang, hiddenCatIds, userCategories, customCat, subcatOverrides);
      const res = await fetch("/api/financas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: cleanBase64, mediaType: mime, categories: guide }),
      });
      if (res.ok) {
        const data = await res.json();
        const txs = Array.isArray(data.transactions) ? data.transactions : [];
        if (txs.length > 0) {
          setDrafts(txs.map((t: Partial<Draft>) => normalizeDraft({
            type: (t.type ?? "despesa") as "receita" | "despesa",
            amount: t.amount ? String(t.amount) : "",
            category: t.category ?? "",
            subcategory: t.subcategory ?? "",
            description: t.description ?? "",
            date: t.date ?? getLocalDate(),
          }, hiddenCatIds, userCategories, customCat, subcatOverrides)));
        } else {
          toast.error(tFn(lang, "fin_erro_ler_foto"));
        }
      } else {
        toast.error(tFn(lang, "fin_erro_analisar_foto"));
      }
    } catch {
      toast.error(tFn(lang, "fin_erro_analisar_foto2"));
    }
    setStage("review");
  };

  const isDraftValid = (d: Draft) => {
    return !(d.amount === "" || Number(d.amount) <= 0 || d.category.length === 0);
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
      toast.error(tFn(lang, "fin_erro_salvar_transacoes"));
    }
  };

  const canSave = drafts.some(isDraftValid);

  const updateDraft = (i: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDraft = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  const addDraft = () =>
    setDrafts((prev) => [...prev, {
      type: "despesa", amount: "", category: "", subcategory: "",
      description: "", date: getLocalDate(),
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
      <div style={{ minHeight: "100dvh", background: BG, overflowX: "hidden", display: "flex", flexDirection: "column" }}>
        <Header onBack={() => setStage("capture")} title={tFn(lang, "fin_analisando_titulo")} />
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            width: "100%", borderRadius: 16, overflow: "hidden", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, rgba(124,92,255,0.15), rgba(124,92,255,0.05))`,
            padding: "40px 0",
          }}>
            {photo && (
              <img
                src={photo}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.4, filter: "blur(8px) saturate(1.3)" }}
              />
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
              animation: "shimmer 1.6s linear infinite",
            }} />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <MayaAvatar state="processing" size={92} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.35)", margin: 0 }}>
                  {tFn(lang, "fin_maya_olhando")}
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", textShadow: "0 1px 3px rgba(0,0,0,0.3)", margin: "4px 0 0" }}>
                  {tFn(lang, "fin_lendo_recibo")}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: 56, borderRadius: 14,
                background: "linear-gradient(120deg, #151520, #1d1830, #151520)",
                backgroundSize: "200% 100%",
                animation: "shimmerBg 1.6s linear infinite",
              }} />
            ))}
          </div>
        </div>
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
              <img src={photo} alt={tFn(lang, "fin_recibo")} style={{ width: 68, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT }}>
                  {drafts.length === 0
                    ? tFn(lang, "fin_nada_encontrado")
                    : `${drafts.length} ${tFn(lang, drafts.length === 1 ? "fin_transacao_encontrada" : "fin_transacoes_encontradas")}`}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXT_SEC }}>{tFn(lang, "fin_confira_edite")}</p>
              </div>
              <button type="button" onClick={() => setStage("capture")} style={{
                border: 0, background: "rgba(124,92,255,0.1)", borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: ACCENT, fontFamily: "inherit", flexShrink: 0,
              }}>
                {tFn(lang, "fin_outra_foto")}
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
                subcatOverrides={subcatOverrides}
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
                  style={{ ...inputS, WebkitAppearance: "none", appearance: "none", minWidth: 0 }}
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
            {tFn(lang, "fin_adicionar_transacao")}
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
                ? tFn(lang, "salvar")
                : tFn(lang, validCount === 1 ? "fin_salvar_transacao" : "fin_salvar_transacoes", { n: String(validCount) })}
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
            subcatOverrides={subcatOverrides}
            onHiddenChange={setHiddenCatIds}
            onSubcatOverridesChange={setSubcatOverrides}
            onCategoriesChange={async () => {
              const catsRes = await fetch("/api/financas/categories").then((r) => r.json());
              if (catsRes?.categories) setUserCategories(catsRes.categories);
              if (catsRes?.hiddenFinCats) setHiddenCatIds(catsRes.hiddenFinCats);
              setSubcatOverrides({
                hidden: catsRes?.hiddenFinSubcats ?? {},
                custom: catsRes?.customFinSubcats ?? {},
              });
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
      <Header onBack={() => router.back()} title={tFn(lang, "fin_registrar_por_foto")} />

      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {photo ? (
          <>
            <div style={{ position: "relative" }}>
              <img
                src={photo}
                alt={tFn(lang, "fin_recibo")}
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

            <button type="button" onClick={analyze} style={{
              width: "100%", padding: "16px 20px", borderRadius: 16, border: 0, cursor: "pointer",
              background: ACCENT, fontFamily: "inherit", fontSize: 16, fontWeight: 700, color: "#fff",
            }}>
              {tFn(lang, "fin_analisar_recibo")}
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
                {tFn(lang, "fin_foto_recibo_nota")}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>
                {tFn(lang, "fin_ia_extrai")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => cameraRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14, border: 0, cursor: "pointer",
                background: ACCENT, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: "#fff", display: "flex", alignItems: "center", gap: 8,
              }}>
                <Camera size={18} /> {tFn(lang, "fin_camera")}
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} style={{
                padding: "14px 24px", borderRadius: 14,
                border: `1px solid ${BORDER}`,
                background: SURFACE, cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: ACCENT, display: "flex", alignItems: "center", gap: 8,
              }}>
                <ImageIcon size={18} /> {tFn(lang, "fin_galeria")}
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setShowManual(true)} style={{
          border: 0, background: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          color: TEXT_SEC, padding: "4px 0", textAlign: "center",
        }}>
          {tFn(lang, "fin_registrar_manualmente")}
        </button>
      </div>

      {showManual && (
        <TransactionModal
          onClose={() => setShowManual(false)}
          onSaved={() => router.push("/financas")}
          lang={lang}
          currency={currency}
          customCat={customCat}
          onCustomCatUpdated={setCustomCat}
          userCategories={userCategories}
          hiddenCatIds={hiddenCatIds}
          subcatOverrides={subcatOverrides}
          onManageCategories={() => {
            setShowManual(false);
            setShowCategoryManager(true);
          }}
        />
      )}

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
