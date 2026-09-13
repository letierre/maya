"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

interface Stone {
  rank: number;
  text: string;
  area?: string;
}

interface FocusStonesProps {
  stones: Stone[];
  onEdit: () => void;
}

const COLORS = ["#7C5CFF", "#5EEAD4", "#F59E0B"];

export function FocusStones({ stones, onEdit }: FocusStonesProps) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
          {t("fs_pedras_semana")}
        </p>
        <button type="button" onClick={onEdit} style={{
          background: "transparent", border: 0, padding: 0, cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "#A78BFA", fontFamily: "inherit",
        }}>
          {stones.length > 0 ? t("editar") : t("fs_definir")}
        </button>
      </div>

      {stones.length > 0 ? (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {stones.map((s, i) => (
            <div key={i} style={{
              flex: "0 0 160px", borderRadius: 18, padding: "16px 14px",
              background: "linear-gradient(135deg, #1a1530 0%, rgba(124,92,255,0.06) 100%)",
              border: `1px solid ${COLORS[i]}22`,
              position: "relative", overflow: "hidden",
              cursor: "pointer",
              transition: "transform .15s ease",
            }}
              onClick={onEdit}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {/* Rank badge */}
              <span style={{
                position: "absolute", top: 10, right: 12,
                fontSize: 28, fontWeight: 800, color: COLORS[i],
                opacity: 0.25, fontFamily: "monospace", lineHeight: 1,
              }}>
                {["I","II","III"][i]}
              </span>

              {/* Emoji */}
              <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>
                {["💎","🪨","🔮"][i]}
              </span>

              {/* Title */}
              <p style={{
                margin: "0 0 4px", fontSize: 14, fontWeight: 700,
                color: "#e0d6ff", lineHeight: 1.25, letterSpacing: "-0.01em",
                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {s.text}
              </p>

              {/* Area */}
              {s.area && (
                <span style={{ fontSize: 10, fontWeight: 600, color: COLORS[i], opacity: 0.8 }}>
                  {s.area}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <button type="button" onClick={onEdit} style={{
          width: "100%", padding: 16, borderRadius: 16,
          border: "1.5px dashed rgba(124,92,255,0.25)",
          background: "rgba(124,92,255,0.03)", cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "#A78BFA",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "inherit",
        }}>
          <Plus size={16} /> {t("fs_definir_pedras")}
        </button>
      )}
    </div>
  );
}
