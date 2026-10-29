"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cachedFetch } from "@/lib/fetch-cache";
import { useTranslation } from "@/lib/useTranslation";

interface Book { title: string; current_page?: number; total_pages?: number; }
interface Goal { title: string; status: string; }

/**
 * Chip "Continuar de onde parou" — uma única ação contextual logo abaixo do
 * check-in. Prioriza o livro em leitura; senão, a primeira meta ativa.
 */
export function ContinueCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [item, setItem] = useState<{ kind: "book" | "goal"; title: string; sub: string; href: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      cachedFetch<Book[]>("/api/leitura/books?status=lendo").catch(() => [] as Book[]),
      cachedFetch<Goal[]>("/api/goals").catch(() => [] as Goal[]),
    ])
      .then(([books, goals]) => {
        const book = books[0];
        if (book) {
          const sub = book.total_pages
            ? `pág. ${book.current_page ?? 0} de ${book.total_pages}`
            : book.current_page
              ? `pág. ${book.current_page}`
              : "";
          setItem({ kind: "book", title: book.title, sub, href: "/leitura" });
          return;
        }
        const goal = (goals ?? []).find((g) => g.status === "ativa" || g.status === "pausada");
        if (goal) setItem({ kind: "goal", title: goal.title, sub: "", href: "/agenda?tab=metas" });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready || !item) return null;

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
