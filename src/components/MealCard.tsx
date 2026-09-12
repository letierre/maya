"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState } from "react";
import { mealTypeEmoji, mealTypeLabel, classificationLabel } from "@/lib/meal-utils";
import { getPhoto, isCloudPath, photoUrl } from "@/lib/photo-storage";
import { Clock, Star } from "lucide-react";
import type { Meal } from "@/types";

// ── Design tokens ──────────────────────────────────────────────
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.15)";
const FOREGROUND = "#e0d6ff";

const CLASSIFICATION_STYLE: Record<string, { bg: string; text: string }> = {
  equilibrada:      { bg: "oklch(0.45 0.15 160 / 0.12)", text: "oklch(0.45 0.15 160)" },
  leve_proteina:    { bg: "oklch(0.60 0.12 70 / 0.12)",  text: "oklch(0.60 0.12 70)" },
  alta_acucar:      { bg: "oklch(0.50 0.15 15 / 0.12)",  text: "oklch(0.50 0.15 15)" },
  alta_gordura:     { bg: "oklch(0.55 0.15 45 / 0.12)",  text: "oklch(0.55 0.15 45)" },
  alta_sal:         { bg: "oklch(0.58 0.18 270 / 0.12)", text: "oklch(0.58 0.18 270)" },
  vegetais_baixo:   { bg: "oklch(0.50 0.12 220 / 0.12)", text: "oklch(0.50 0.12 220)" },
  nao_identificada: { bg: "oklch(0.5 0 0 / 0.08)",       text: "#9e96b5" },
};

interface MealCardProps {
  meal: Meal;
  onClick?: () => void;
  onToggleFavorite?: (mealId: string, favorited: boolean) => void;
}

export function MealCard({ meal, onClick, onToggleFavorite }: MealCardProps) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  const primaryPhoto = meal.fotos?.length ? meal.fotos[0] : meal.foto_path;

  useEffect(() => {
    if (primaryPhoto) {
      if (isCloudPath(primaryPhoto)) {
        setPhotoSrc(photoUrl(primaryPhoto));
      } else {
        getPhoto(primaryPhoto).then(setPhotoSrc);
      }
    }
  }, [primaryPhoto]);

  const hora = new Date(meal.data_hora).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

  const calLabel = meal.macros ? `${meal.macros.calorias_kcal} kcal` : null;
  const hasItems = meal.itens && meal.itens.length > 0;
  const isPending = meal.status_analise === "pendente";
  const classStyle = meal.classificacao
    ? (CLASSIFICATION_STYLE[meal.classificacao] ?? CLASSIFICATION_STYLE.nao_identificada)
    : null;

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(meal.id, !meal.favorited);
  };

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "oklch(.17 .015 270 / .6)",
        border: `1px solid ${BORDER}`,
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.2s",
      }}
    >
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {/* Foto — 88x88 */}
          <div style={{
            width: 88, height: 88, borderRadius: 12, overflow: "hidden",
            flexShrink: 0, background: "oklch(.22 .015 270 / .5)",
            position: "relative",
          }}>
            {photoSrc ? (
              <img src={photoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{
                width: "100%", height: "100%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 32,
              }}>
                {mealTypeEmoji(meal.tipo_refeicao)}
              </div>
            )}
            {isPending && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.3)", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "#fff",
                  background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 9999,
                }}>
                  Analisar
                </span>
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}>
            {/* Linha 1: Tipo + horário + badge de status + estrela */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{mealTypeEmoji(meal.tipo_refeicao)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: FOREGROUND }}>
                {mealTypeLabel(meal.tipo_refeicao)}
              </span>
              <span style={{ fontSize: 11, color: MUTED, display: "inline-flex", alignItems: "center", gap: 2 }}>
                <Clock style={{ width: 12, height: 12 }} />
                {hora}
              </span>
              {isPending && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  background: "oklch(0.58 0.18 270 / 0.12)",
                  color: "oklch(0.58 0.18 270)",
                  padding: "2px 6px", borderRadius: 9999,
                  marginLeft: "auto",
                }}>
                  Pendente
                </span>
              )}
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={handleStar}
                  style={{
                    marginLeft: isPending ? 4 : "auto",
                    background: "none", border: 0, cursor: "pointer",
                    padding: 2, display: "flex",
                  }}
                  aria-label={meal.favorited ? "Desfavoritar" : "Favoritar"}
                >
                  <Star
                    style={{
                      width: 16, height: 16,
                      color: meal.favorited ? "#fbbf24" : MUTED,
                      fill: meal.favorited ? "#fbbf24" : "none",
                    }}
                  />
                </button>
              )}
            </div>

            {/* Itens */}
            {hasItems && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {meal.itens!.slice(0, 4).map((item, i) => (
                  <span key={i} style={{
                    fontSize: 11, color: MUTED,
                    background: "oklch(.22 .015 270 / .5)",
                    padding: "2px 8px", borderRadius: 9999,
                  }}>
                    {item.nome}
                  </span>
                ))}
                {meal.itens!.length > 4 && (
                  <span style={{ fontSize: 10, color: MUTED, padding: "2px 4px" }}>
                    +{meal.itens!.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Macros + classificação */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {calLabel && (
                <span style={{ fontSize: 13, fontWeight: 700, color: FOREGROUND, fontVariantNumeric: "tabular-nums" }}>
                  {calLabel}
                </span>
              )}
              {classStyle && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "1px 6px", borderRadius: 9999,
                  background: classStyle.bg, color: classStyle.text,
                }}>
                  {classificationLabel(meal.classificacao!)}
                </span>
              )}
            </div>

            {/* Observação ou texto livre */}
            {(meal.observacao || (meal.texto_livre && !hasItems)) && (
              <p style={{
                fontSize: 11, color: MUTED, lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {(meal.observacao || meal.texto_livre).slice(0, 80)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
