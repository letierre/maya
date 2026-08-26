"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";

const BORDER = "rgba(167,139,250,0.15)";
const ACCENT = "#7C5CFF";

interface CategoryFormData {
  name: string;
  emoji: string;
  hue: number;
  subcats: string[];
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  borderRadius: 10, border: `1px solid ${BORDER}`,
  background: "#0B0B10", fontFamily: "inherit",
  fontSize: 14, color: "#e0d6ff", outline: "none",
};

export function CategoryFormModal({
  mode, type, initial, onClose, onSaved, lang,
}: {
  mode: "create" | "edit";
  type: "receita" | "despesa";
  initial?: CategoryFormData;
  onClose: () => void;
  onSaved: (data: CategoryFormData) => void;
  lang: Lang;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⭐");
  const [hue, setHue] = useState(initial?.hue ?? 270);
  const [subcats, setSubcats] = useState<string[]>(initial?.subcats ?? []);
  const [newSubcat, setNewSubcat] = useState("");
  const [saving, setSaving] = useState(false);

  const addSubcat = () => {
    const v = newSubcat.trim();
    if (v && !subcats.includes(v)) { setSubcats((p) => [...p, v]); }
    setNewSubcat("");
  };

  const save = () => {
    if (!name.trim()) return;
    const data: CategoryFormData = { name: name.trim(), emoji, hue, subcats };
    onSaved(data);
  };

  const hueColors = [0, 30, 50, 85, 160, 185, 200, 220, 270, 300, 310];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 105,
        borderRadius: "24px 24px 0 0", background: "#151520",
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", marginBottom: 14 }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>
              {mode === "create" ? "Nova categoria" : "Editar categoria"}
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
                Nome
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Freelas"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9e96b5" }}>
              Cor
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {hueColors.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHue(h)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: `oklch(.55 .14 ${h})`,
                    border: hue === h ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer",
                    boxShadow: hue === h ? `0 0 0 2px oklch(.55 .14 ${h} / .3)` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Subcats */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#9e96b5" }}>
              Subcategorias (opcional)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subcats.map((sc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    value={sc}
                    onChange={(e) => setSubcats((p) => p.map((s, j) => (j === i ? e.target.value : s)))}
                    style={{ flex: 1, fontSize: 13, color: "#e0d6ff", padding: "8px 12px", borderRadius: 10, background: "#0B0B10", border: "none", outline: "none", fontFamily: "inherit" }}
                  />
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
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={newSubcat}
                onChange={(e) => setNewSubcat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubcat(); } }}
                placeholder="Adicionar subcategoria"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={addSubcat} style={{
                border: 0, background: "rgba(124,92,255,0.1)", borderRadius: 10, padding: "0 14px",
                cursor: "pointer", fontSize: 18, color: ACCENT, fontFamily: "inherit", fontWeight: 700,
              }}>
                +
              </button>
            </div>
          </div>
        </div>

        <button type="button" onClick={save} disabled={saving || !name.trim()} style={{
          marginTop: 20, width: "100%", padding: "14px 20px", borderRadius: 14, border: 0,
          cursor: (!name.trim() || saving) ? "not-allowed" : "pointer",
          background: (!name.trim() || saving) ? "rgba(124,92,255,0.2)" : ACCENT,
          fontFamily: "inherit", fontSize: 15, fontWeight: 700,
          color: (!name.trim() || saving) ? "rgba(167,139,250,0.5)" : "#fff",
        }}>
          {saving ? "Salvando..." : mode === "create" ? "Criar categoria" : "Salvar alterações"}
        </button>
      </div>
    </>
  );
}
