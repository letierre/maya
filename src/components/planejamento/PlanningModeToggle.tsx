"use client";

import { Eye, Compass } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

interface PlanningModeToggleProps {
  mode: "view" | "plan";
  onChange: (mode: "view" | "plan") => void;
}

export function PlanningModeToggle({ mode, onChange }: PlanningModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          background: "#12121c",
          borderRadius: 12,
          padding: 3,
          border: "1px solid rgba(167,139,250,0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => onChange("view")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            borderRadius: 9,
            border: "none",
            background:
              mode === "view"
                ? "linear-gradient(135deg, #7C5CFF, #A78BFA)"
                : "transparent",
            color: mode === "view" ? "#fff" : "#6a657a",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: mode === "view" ? 600 : 500,
            cursor: "pointer",
            transition: "all .2s",
          }}
        >
          <Eye size={13} />
          {t("plan_visualizar")}
        </button>
        <button
          type="button"
          onClick={() => onChange("plan")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            borderRadius: 9,
            border: "none",
            background:
              mode === "plan"
                ? "linear-gradient(135deg, #7C5CFF, #A78BFA)"
                : "transparent",
            color: mode === "plan" ? "#fff" : "#6a657a",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: mode === "plan" ? 600 : 500,
            cursor: "pointer",
            transition: "all .2s",
          }}
        >
          <Compass size={13} />
          {t("plan_planejar")}
        </button>
      </div>
    </div>
  );
}
