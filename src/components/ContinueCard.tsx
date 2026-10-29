"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";

export interface ContinueItem {
  kind: "book" | "goal";
  title: string;
  sub: string;
  href: string;
}

/**
 * Chip "Continuar de onde parou" — uma única ação contextual logo abaixo do
 * check-in. Prioriza o livro em leitura; senão, a primeira meta ativa.
 * O item é resolvido na página (via props) para a home renderizar tudo junto.
 */
export function ContinueCard({ item }: { item: ContinueItem | null }) {
  const router = useRouter();
  const { t } = useTranslation();

  if (!item) return null;

  const emoji = item.kind === "book" ? "📖" : "🎯";
  const main = item.kind === "book"
    ? t("resume_lendo", { title: item.title })
    : t("resume_meta", { title: item.title });

  return (
    <div className="px-3.5 pt-3">
      <button
        type="button"
        onClick={() => router.push(item.href)}
        className="w-full rounded-2xl p-4 flex items-center gap-3 text-left border-0 cursor-pointer transition-transform active:scale-[0.99]"
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(167,139,250,0.22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="m-0 text-[10px] font-bold tracking-[.12em] uppercase" style={{ color: "oklch(0.65 0.12 270)" }}>
            {t("resume_titulo")}
          </p>
          <p className="m-0 mt-0.5 text-[14px] font-bold leading-tight truncate" style={{ color: "#e0d6ff" }}>
            {main}
          </p>
          {item.sub && (
            <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {item.sub}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "#A78BFA" }} />
      </button>
    </div>
  );
}
