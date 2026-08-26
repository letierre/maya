"use client";

import { Settings } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { t as tFn } from "@/lib/i18n";
import { mergeCats, type UserCategory, type CustomCat } from "@/lib/financas-categories";

export function CategoryPicker({
  type, category, subcategory, lang, customCat,
  userCategories, hiddenCatIds,
  onSelect, onManage,
}: {
  type: "receita" | "despesa";
  category: string;
  subcategory: string;
  lang: Lang;
  customCat: CustomCat | null;
  userCategories: UserCategory[];
  hiddenCatIds: string[];
  onSelect: (cat: string, sub: string) => void;
  onManage: () => void;
}) {
  const cats = mergeCats(type, hiddenCatIds, userCategories, customCat);
  const cols = type === "despesa" ? "repeat(4, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))";
  const selectedCat = cats.find((c) => c.id === category);
  const subcats = selectedCat?.subcats ?? [];
  // Se a subcategoria salva não está na lista (ex.: free-text vinda da IA),
  // mostramos um chip extra pra ela não sumir / ficar ineditável.
  const hasCustomSub = !!subcategory && !subcats.some((sc) => sc.label === subcategory);
  const displaySubcats = hasCustomSub ? [{ id: "__custom__", label: subcategory }, ...subcats] : subcats;

  const textSecondary = "#9e96b5";
  const borderDefault = "rgba(167,139,250,0.15)";
  const ACCENT = "#7C5CFF";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: textSecondary }}>
          {tFn(lang, "fin_categoria")}
        </p>
        <button
          type="button"
          onClick={onManage}
          style={{
            border: 0, background: "transparent", cursor: "pointer", padding: 2,
            color: textSecondary, display: "flex", alignItems: "center", gap: 3,
            fontFamily: "inherit", fontSize: 10, fontWeight: 600,
          }}
        >
          <Settings size={12} /> Gerenciar
        </button>
      </div>

      {/* Main category grid */}
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6 }}>
        {cats.map((c) => {
          const sel = category === c.id;
          const isUserCat = c.id.startsWith("user_");
          const label = c.custom
            ? (isUserCat
                ? userCategories.find((uc) => `user_${uc.id}` === c.id)?.name ?? c.emoji
                : (customCat?.name ?? tFn(lang, "fin_cat_personalizada")))
            : tFn(lang, `fin_cat_${c.id}`);
          const emoji = c.custom
            ? (isUserCat
                ? (userCategories.find((uc) => `user_${uc.id}` === c.id)?.emoji ?? c.emoji)
                : (customCat?.emoji ?? c.emoji))
            : c.emoji;
          return (
            <div key={c.id} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => onSelect(c.id, "")}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 4px", borderRadius: 12,
                  border: sel ? "2px solid #7C5CFF" : `1px solid ${borderDefault}`,
                  background: sel ? "rgba(124,92,255,0.08)" : "#0B0B10",
                  cursor: "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, transition: "all .12s ease",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, textAlign: "center", lineHeight: 1.2,
                  color: sel ? "#A78BFA" : textSecondary,
                }}>
                  {label}
                </span>
              </button>
              {/* Badge for user categories */}
              {isUserCat && (
                <span style={{
                  position: "absolute", top: -2, right: -2,
                  fontSize: 7, fontWeight: 700, color: ACCENT,
                  background: "#0B0B10", borderRadius: 4, padding: "1px 4px",
                  border: `1px solid rgba(124,92,255,0.3)`,
                }}>
                  sua
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Subcategory chips */}
      {displaySubcats.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: textSecondary }}>
            {tFn(lang, "fin_subcategoria")}
          </p>
          <div style={{ overflowX: "auto", display: "flex", gap: 6, paddingBottom: 4 }}>
            {displaySubcats.map((sc) => {
              const selSub = subcategory === sc.label;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelect(category, sc.label)}
                  style={{
                    flexShrink: 0, padding: "6px 13px", borderRadius: 20,
                    border: selSub ? "1.5px solid #7C5CFF" : `1.5px solid ${borderDefault}`,
                    background: selSub ? "rgba(124,92,255,0.08)" : "#0B0B10",
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    fontSize: 12, fontWeight: 600,
                    color: selSub ? "#A78BFA" : "#9e96b5",
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
