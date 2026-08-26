"use client";

import { useState } from "react";
import { X, Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { EXPENSE_CATS, INCOME_CATS, type UserCategory, type CustomCat, type SubcatOverrides } from "@/lib/financas-categories";
import { CategoryFormModal } from "./CategoryFormModal";

const SURFACE = "#151520";
const CARD = "#1a1530";
const BORDER = "rgba(167,139,250,0.15)";
const ACCENT = "#7C5CFF";
const TEXT = "#e0d6ff";
const TEXT_SEC = "#9e96b5";
const RED = "#FF5C5C";

export function CategoryManager({
  type, hiddenIds, userCategories, customCat, lang,
  subcatOverrides, onHiddenChange, onSubcatOverridesChange, onCategoriesChange, onClose,
}: {
  type: "receita" | "despesa";
  hiddenIds: string[];
  userCategories: UserCategory[];
  customCat: CustomCat | null;
  lang: Lang;
  subcatOverrides: SubcatOverrides;
  onHiddenChange: (ids: string[]) => void;
  onSubcatOverridesChange: (o: SubcatOverrides) => void;
  onCategoriesChange: () => void;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<"receita" | "despesa">(type);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<UserCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [newSubcatInput, setNewSubcatInput] = useState("");

  const defaults = selectedType === "despesa" ? EXPENSE_CATS : INCOME_CATS;
  const filteredUserCats = userCategories.filter((c) => c.type === selectedType);

  const toggleHidden = async (catId: string) => {
    const next = hiddenIds.includes(catId)
      ? hiddenIds.filter((id) => id !== catId)
      : [...hiddenIds, catId];
    onHiddenChange(next);
    // Persist
    const prefsRes = await fetch("/api/preferences").then((r) => r.json());
    const ctx = prefsRes.context ?? {};
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { ...ctx, hidden_fin_cats: next } }),
    });
  };

  const persistSubcatOverrides = async (next: SubcatOverrides) => {
    const prefsRes = await fetch("/api/preferences").then((r) => r.json());
    const ctx = prefsRes.context ?? {};
    await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { ...ctx, hidden_fin_subcats: next.hidden, custom_fin_subcats: next.custom } }),
    });
  };

  const toggleSubcatHidden = (catId: string, label: string) => {
    const cur = subcatOverrides.hidden[catId] ?? [];
    const nextHidden = cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
    const next: SubcatOverrides = {
      ...subcatOverrides,
      hidden: { ...subcatOverrides.hidden, [catId]: nextHidden },
    };
    onSubcatOverridesChange(next);
    persistSubcatOverrides(next);
  };

  const removeCustomSubcat = (catId: string, label: string) => {
    const cur = (subcatOverrides.custom[catId] ?? []).filter((l) => l !== label);
    const next: SubcatOverrides = {
      ...subcatOverrides,
      custom: { ...subcatOverrides.custom, [catId]: cur },
    };
    onSubcatOverridesChange(next);
    persistSubcatOverrides(next);
  };

  const addCustomSubcat = (catId: string) => {
    const label = newSubcatInput.trim();
    if (!label) return;
    const cur = subcatOverrides.custom[catId] ?? [];
    if (cur.includes(label)) { setNewSubcatInput(""); return; }
    const next: SubcatOverrides = {
      ...subcatOverrides,
      custom: { ...subcatOverrides.custom, [catId]: [...cur, label] },
    };
    onSubcatOverridesChange(next);
    persistSubcatOverrides(next);
    setNewSubcatInput("");
  };

  const handleDelete = async (catId: string) => {
    setSaving(true);
    await fetch(`/api/financas/categories/${catId}`, { method: "DELETE" });
    setSaving(false);
    setDeleteConfirm(null);
    onCategoriesChange();
  };

  const handleCreate = async (data: { name: string; emoji: string; hue: number; subcats: string[] }) => {
    await fetch("/api/financas/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, type: selectedType }),
    });
    setShowForm(false);
    onCategoriesChange();
  };

  const handleEdit = async (data: { name: string; emoji: string; hue: number; subcats: string[] }) => {
    if (!editCat) return;
    await fetch(`/api/financas/categories/${editCat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditCat(null);
    onCategoriesChange();
  };

  const sectionTitle: React.CSSProperties = {
    margin: "0 0 10px", fontSize: 10, fontWeight: 700,
    letterSpacing: ".1em", textTransform: "uppercase", color: "#A78BFA",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
        borderRadius: "24px 24px 0 0", background: SURFACE,
        padding: "20px 20px calc(env(safe-area-inset-bottom) + 28px)",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        maxHeight: "90dvh", overflowY: "auto",
        border: `1px solid ${BORDER}`,
      }}>
        {/* Handle + Header */}
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.2)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT }}>Gerenciar categorias</h2>
          <button type="button" onClick={onClose} style={{ border: 0, background: "#0B0B10", borderRadius: 10, padding: 8, cursor: "pointer" }}>
            <X size={18} style={{ color: TEXT_SEC }} />
          </button>
        </div>

        {/* Type toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["despesa", "receita"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setSelectedType(t)} style={{
              flex: 1, padding: "10px", borderRadius: 12, border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              background: selectedType === t ? "rgba(124,92,255,0.1)" : "#0B0B10",
              color: selectedType === t ? ACCENT : TEXT_SEC,
              transition: "all .15s ease",
            }}>
              {t === "despesa" ? "Despesas" : "Receitas"}
            </button>
          ))}
        </div>

        {/* Default categories */}
        <p style={sectionTitle}>Categorias padrão</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {defaults.filter((c) => !c.custom && !c.system).map((c) => {
            const hidden = hiddenIds.includes(c.id);
            const isOpen = expandedCat === c.id;
            const hiddenSubs = subcatOverrides.hidden[c.id] ?? [];
            const customSubs = subcatOverrides.custom[c.id] ?? [];
            const hasSubs = c.subcats.length > 0 || customSubs.length > 0;
            return (
              <div key={c.id} style={{
                borderRadius: 12,
                background: CARD, border: `1px solid ${BORDER}`,
                opacity: hidden ? 0.45 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 18 }}>{c.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>
                    {tFn(lang, `fin_cat_${c.id}`)}
                  </span>
                  {hasSubs && (
                    <button type="button" onClick={() => setExpandedCat(isOpen ? null : c.id)} style={{
                      border: 0, background: "transparent", cursor: "pointer", padding: 6,
                      color: TEXT_SEC, display: "flex", alignItems: "center",
                    }}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  )}
                  <button type="button" onClick={() => toggleHidden(c.id)} style={{
                    border: 0, background: "transparent", cursor: "pointer", padding: 6,
                    color: hidden ? TEXT_SEC : ACCENT,
                  }}>
                    {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {isOpen && hasSubs && (
                  <div style={{ padding: "4px 12px 12px", borderTop: `1px solid ${BORDER}` }}>
                    {/* Subcategorias padrão */}
                    {c.subcats.map((sc) => {
                      const subHidden = hiddenSubs.includes(sc.label);
                      return (
                        <div key={sc.id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 4px", opacity: subHidden ? 0.45 : 1,
                        }}>
                          <span style={{ flex: 1, fontSize: 12, color: subHidden ? TEXT_SEC : "#cfc4f2" }}>
                            {sc.label}
                          </span>
                          <button type="button" onClick={() => toggleSubcatHidden(c.id, sc.label)} style={{
                            border: 0, background: "transparent", cursor: "pointer", padding: 4,
                            color: subHidden ? TEXT_SEC : ACCENT,
                          }}>
                            {subHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      );
                    })}

                    {/* Subcategorias adicionadas */}
                    {customSubs.map((label) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px" }}>
                        <span style={{ flex: 1, fontSize: 12, color: ACCENT }}>{label}</span>
                        <button type="button" onClick={() => removeCustomSubcat(c.id, label)} style={{
                          border: 0, background: "transparent", cursor: "pointer", padding: 4, color: RED,
                        }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}

                    {/* Adicionar subcategoria */}
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <input
                        value={newSubcatInput}
                        onChange={(e) => setNewSubcatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSubcat(c.id); } }}
                        placeholder="Nova subcategoria"
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${BORDER}`,
                          background: "#0B0B10", fontFamily: "inherit", fontSize: 12, color: TEXT, outline: "none",
                        }}
                      />
                      <button type="button" onClick={() => addCustomSubcat(c.id)} style={{
                        border: 0, background: "rgba(124,92,255,0.12)", borderRadius: 8, padding: "0 12px",
                        cursor: "pointer", fontSize: 15, color: ACCENT, fontFamily: "inherit", fontWeight: 700,
                      }}>
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Legacy personalizada */}
          {customCat && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: CARD, border: `1px solid ${BORDER}`,
              opacity: 0.5,
            }}>
              <span style={{ fontSize: 18 }}>{customCat.emoji}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>
                {customCat.name} <span style={{ fontSize: 10, color: TEXT_SEC }}>(legado)</span>
              </span>
            </div>
          )}
        </div>

        {/* User categories */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={sectionTitle}>Suas categorias</p>
          <button type="button" onClick={() => setShowForm(true)} style={{
            border: 0, background: "transparent", cursor: "pointer", padding: 2,
            color: ACCENT, display: "flex", alignItems: "center", gap: 4,
            fontFamily: "inherit", fontSize: 12, fontWeight: 700,
          }}>
            <Plus size={14} /> Nova
          </button>
        </div>

        {filteredUserCats.length === 0 ? (
          <p style={{ fontSize: 12, color: TEXT_SEC, fontStyle: "italic", textAlign: "center", padding: "16px 0", margin: 0 }}>
            Nenhuma categoria criada ainda
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredUserCats.map((uc) => (
              <div key={uc.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: CARD, border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 18 }}>{uc.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{uc.name}</span>
                <button type="button" onClick={() => setEditCat(uc)} style={{
                  border: 0, background: "transparent", cursor: "pointer", padding: 6, color: TEXT_SEC,
                }}>
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => setDeleteConfirm(uc.id)} style={{
                  border: 0, background: "transparent", cursor: "pointer", padding: 6, color: RED,
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <CategoryFormModal
          mode="create"
          type={selectedType}
          lang={lang}
          onClose={() => setShowForm(false)}
          onSaved={handleCreate}
        />
      )}

      {/* Edit form */}
      {editCat && (
        <CategoryFormModal
          mode="edit"
          type={editCat.type}
          initial={{ name: editCat.name, emoji: editCat.emoji, hue: editCat.hue, subcats: editCat.subcats }}
          lang={lang}
          onClose={() => setEditCat(null)}
          onSaved={handleEdit}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
          <div style={{
            position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
            <div style={{
              width: "100%", maxWidth: 320, background: SURFACE, borderRadius: 20, padding: 24,
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>Excluir categoria?</h3>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>
                As transações desta categoria serão movidas para "Outros". Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setDeleteConfirm(null)} style={{
                  flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`,
                  background: "transparent", color: TEXT_SEC, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancelar
                </button>
                <button type="button" onClick={() => handleDelete(deleteConfirm)} disabled={saving} style={{
                  flex: 1, padding: 12, borderRadius: 12, border: 0,
                  background: RED, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? "..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
