"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/useTranslation";
import { Plus, ImageIcon, BookOpen, Sparkles, MoreVertical } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/LogoutButton";
import type { DiaryEntry } from "@/types";

const MOOD_EMOJIS: Record<number, string> = {
  1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😊",
};

function formatStart(entries: DiaryEntry[]): string {
  if (entries.length === 0) return "";
  const oldest = [...entries].sort((a, b) => a.date.localeCompare(b.date))[0];
  const d = new Date(oldest.date + "T12:00:00");
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${month}/${d.getFullYear()}`;
}

function groupByMonth(entries: DiaryEntry[]) {
  const now = new Date();
  const groups = new Map<string, { label: string; entries: DiaryEntry[]; key: string }>();
  entries.forEach((e) => {
    const d = new Date(e.date + "T12:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups.has(key)) {
      const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      groups.set(key, { label: raw.charAt(0).toUpperCase() + raw.slice(1), entries: [], key });
    }
    groups.get(key)!.entries.push(e);
  });
  return Array.from(groups.values()).map((g) => {
    const [y, m] = g.key.split("-").map(Number);
    const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() - m);
    return { ...g, muted: monthsAgo >= 2 };
  });
}

export default function DiarioPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const today = getLocalDate();

  useEffect(() => {
    fetch("/api/diary")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const monthGroups = useMemo(() => groupByMonth(entries), [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("carregando")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pb-32"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.47 .18 270 / .20) 0%, transparent 50%),
          radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.5 .14 270 / .15) 0%, transparent 60%),
          linear-gradient(180deg, oklch(0.12 0.012 270) 0%, oklch(0.10 0.012 270) 100%)
        `,
      }}
    >
      {/* Floating kebab */}
      <div className="absolute top-4 right-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <span className="w-9 h-9 rounded-full bg-white/55 backdrop-blur-md flex items-center justify-center shadow-sm cursor-pointer"
                style={{ color: "var(--foreground)" }}>
                <MoreVertical className="w-4 h-4" />
              </span>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={
              <Link href="/perfil" className="w-full text-left px-2 py-1.5 text-sm block">
                Meu Perfil
              </Link>
            } />
            <DropdownMenuItem render={
              <Link href="/nutricao" className="w-full text-left px-2 py-1.5 text-sm block">
                🍽️ Nutrição
              </Link>
            } />
            <DropdownMenuItem render={<LogoutButton />} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Suas memórias
        </p>
        <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">
          Diário
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"}
          {entries.length > 0 && ` · escrevendo desde ${formatStart(entries)}`}
        </p>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="px-8 pt-16 pb-20 text-center">
          <div className="text-5xl mb-4">📔</div>
          <h2 className="text-lg font-bold mb-2">Nenhuma entrada ainda</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Quando você escrever pela primeira vez, ela aparece aqui — junto com todas as próximas.
          </p>
          <p className="text-xs text-muted-foreground mt-6">
            Toque no <strong>+</strong> abaixo pra começar
          </p>
        </div>
      )}

      {/* Timeline */}
      {monthGroups.map((group, gi) => (
        <div key={group.key} style={{ paddingTop: gi === 0 ? 24 : 36 }}>
          {/* Month header */}
          <div
            className="px-6 pb-3.5 flex items-baseline justify-between"
            style={{ opacity: group.muted ? 0.7 : 1 }}
          >
            <h2 className="text-[11px] font-bold tracking-[.16em] uppercase m-0">
              {group.label}
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {group.entries.length} {group.entries.length === 1 ? "entrada" : "entradas"}
            </span>
          </div>

          {/* Entries */}
          <div style={{ opacity: group.muted ? 0.75 : 1 }}>
            {group.entries.map((entry) => {
              const d = new Date(entry.date + "T12:00:00");
              const day = d.getDate().toString().padStart(2, "0");
              const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase().replace(".", "");
              const photoCount = entry.photos?.length ?? 0;
              const isEmpty = !entry.title && !entry.content;
              const moodEmoji = entry.mood ? MOOD_EMOJIS[entry.mood] : null;
              const isToday = entry.date === today;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => router.push(`/diario/${entry.id}`)}
                  className="w-full text-left transition-colors hover:bg-white/30"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 1fr",
                    padding: "14px 24px",
                    borderTop: "1px solid oklch(.5 .12 270 / .1)",
                    background: isToday ? "oklch(.5 .12 270 / .04)" : "transparent",
                  }}
                >
                  {/* Date col */}
                  <div>
                    <div
                      className="text-lg font-bold leading-none tabular-nums tracking-tight"
                      style={{ color: isToday ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {day}
                    </div>
                    <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mt-1">
                      {wk}
                    </div>
                  </div>

                  {/* Content col */}
                  <div className="min-w-0">
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        {/* Mood + title */}
                        <div className={`flex items-baseline gap-2 ${entry.title ? "mb-0.5" : ""}`}>
                          {moodEmoji && (
                            <span className="text-[15px] leading-none flex-none">{moodEmoji}</span>
                          )}
                          {entry.title && (
                            <h3 className="m-0 text-sm font-bold tracking-tight leading-tight flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                              {entry.title}
                            </h3>
                          )}
                        </div>

                        {isEmpty ? (
                          <p className="m-0 text-[12.5px] text-muted-foreground italic">
                            Você marcou seu humor, mas não escreveu nada nesse dia.
                          </p>
                        ) : (
                          <p
                            className="m-0 text-[13px] leading-[1.5] overflow-hidden"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: entry.title ? 2 : 3,
                              WebkitBoxOrient: "vertical",
                            } as React.CSSProperties}
                          >
                            {entry.content}
                          </p>
                        )}

                        {photoCount > 1 && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground font-semibold">
                            <ImageIcon className="w-2.5 h-2.5" />
                            {photoCount}
                          </div>
                        )}
                      </div>

                      {/* Thumbnail */}
                      {photoCount > 0 && (
                        <div
                          className="w-14 h-14 flex-none rounded-[10px] overflow-hidden border-[1.5px] border-white flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "linear-gradient(135deg, oklch(.5 .14 270 / .2) 0%, oklch(.47 .18 270 / .2) 100%)",
                            boxShadow: "0 2px 6px -2px oklch(.25 .02 270 / .15)",
                          }}
                        >
                          {entry.photos?.[0] ? (
                            <img
                              src={photoUrl(entry.photos[0])!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5" style={{ color: "oklch(.5 .12 270 / .4)" }} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* FAB */}
      <div className="fixed bottom-20 right-5 z-40 flex flex-col items-end gap-2">
        {fabOpen && (
          <>
            <button
              type="button"
              onClick={() => { router.push("/diario/evolucao"); setFabOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg transition-colors hover:bg-white/90"
              style={{
                background: "oklch(1 0 0 / .85)",
                backdropFilter: "blur(12px)",
                borderColor: "oklch(.5 .12 270 / .15)",
              }}
            >
              <span className="text-sm font-medium whitespace-nowrap">Diário de Evolução</span>
              <span className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-4 text-primary" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => { router.push("/diario/novo"); setFabOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg transition-colors hover:bg-white/90"
              style={{
                background: "oklch(1 0 0 / .85)",
                backdropFilter: "blur(12px)",
                borderColor: "oklch(.5 .12 270 / .15)",
              }}
            >
              <span className="text-sm font-medium whitespace-nowrap">Diário Livre</span>
              <span className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="size-4 text-primary" />
              </span>
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setFabOpen(!fabOpen)}
          className={`size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-all z-40 ${fabOpen ? "rotate-45" : ""}`}
          aria-label="Nova entrada"
        >
          <Plus className="size-6 transition-transform" />
        </button>
      </div>
    </div>
  );
}
