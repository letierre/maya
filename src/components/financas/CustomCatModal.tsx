"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import type { CustomCat } from "@/lib/financas-categories";

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", fontFamily: "inherit",
  fontSize: 14, color: "#e0d6ff", outline: "none",
};

export function CustomCatModal({
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
    const pending = newSubcat.trim();
    const finalSubcats = pending && !subcats.includes(pending) ? [...subcats, pending] : subcats;
    const updated: CustomCat = { name: name.trim() || "Personalizada", emoji: emoji || "⭐", subcats: finalSubcats };
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

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>
              {tFn(lang, "fin_personalizada_editar")}
            </h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: "#9e96b5" }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Emoji + Name */}
          <div style={{ display: "flex", gap: 10 }}>
            <div>
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9e96b5" }}>
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
              <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9e96b5" }}>
                {tFn(lang, "fin_personalizada_nome")}
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Subcats list */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9e96b5" }}>
              {tFn(lang, "fin_personalizada_subcats")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subcats.map((sc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "#e0d6ff", padding: "8px 12px", borderRadius: 10, background: "#0B0B10" }}>
                    {sc}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubcats((p) => p.filter((_, j) => j !== i))}
                    style={{ border: 0, background: "none", cursor: "pointer", padding: 6, color: "#FF5C5C" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new subcat */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={newSubcat}
                onChange={(e) => setNewSubcat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcat(); } }}
                placeholder={tFn(lang, "fin_personalizada_adicionar")}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={addSubcat} style={{
                border: 0, background: "rgba(124,92,255,0.1)", borderRadius: 10, padding: "0 14px",
                cursor: "pointer", fontSize: 18, color: "#7C5CFF", fontFamily: "inherit", fontWeight: 700,
              }}>
                +
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving} style={{
          marginTop: 20, width: "100%", padding: "14px 20px", borderRadius: 14, border: 0,
          cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "rgba(124,92,255,0.2)" : "#7C5CFF",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: saving ? "rgba(167,139,250,0.5)" : "#fff",
        }}>
          {saving ? tFn(lang, "salvando") : tFn(lang, "fin_personalizada_salvar")}
        </button>
      </div>
    </>
  );
}
