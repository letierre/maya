"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/useTranslation";
import { Plus, ImageIcon, BookOpen, Sparkles, MoreVertical, ChevronDown } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/LogoutButton";
import type { DiaryEntry } from "@/types";

const MOOD_EMOJIS: Record<number, string> = {
  1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😊",
};

function groupByMonth(entries: DiaryEntry[]) {
  const groups = new Map<string, { label: string; entries: DiaryEntry[]; key: string; year: number }>();
  entries.forEach((e) => {
    const d = new Date(e.date + "T12:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups.has(key)) {
      const raw = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      groups.set(key, {
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
        entries: [], key,
        year: d.getFullYear(),
      });
    }
    groups.get(key)!.entries.push(e);
  });
  return Array.from(groups.values());
}

export default function DiarioPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const today = getLocalDate();

  useEffect(() => {
    fetch("/api/diary")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const monthGroups = useMemo(() => groupByMonth(entries), [entries]);

  // Expand current month by default
  useEffect(() => {
    if (monthGroups.length > 0) {
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
      const exists = monthGroups.find((g) => g.key === currentKey);
      if (exists) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(currentKey);
          return next;
        });
      }
    }
  }, [monthGroups]);

  const toggleMonth = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Unique years for quick jump
  const years = useMemo(() => {
    const set = new Set(monthGroups.map((g) => g.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [monthGroups]);

  const scrollToYear = (year: number) => {
    const el = document.getElementById(`diary-year-${year}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
              <span className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                style={{ background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", color: "#e0d6ff", backdropFilter: "blur(8px)" }}>
                <MoreVertical className="w-4 h-4" />
              </span>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={
              <Link href="/perfil" className="w-full text-left px-2 py-1.5 text-sm block">Meu Perfil</Link>
            } />
            <DropdownMenuItem render={
              <Link href="/nutricao" className="w-full text-left px-2 py-1.5 text-sm block">🍽️ Nutrição</Link>
            } />
            <DropdownMenuItem render={<LogoutButton />} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Suas memórias</p>
        <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">Diário</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "registro" : "registros"}
        </p>
      </div>

      {/* Year quick-jump pills */}
      {years.length > 1 && (
        <div className="px-6 pt-3 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => scrollToYear(year)}
              style={{
                padding: "5px 12px", borderRadius: 9999,
                border: "1px solid rgba(167,139,250,0.2)",
                background: "transparent", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                color: "#A78BFA", whiteSpace: "nowrap",
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="px-8 pt-16 pb-20 text-center">
          <div className="text-5xl mb-4">📔</div>
          <h2 className="text-lg font-bold mb-2">Nenhuma entrada ainda</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Quando você escrever pela primeira vez, ela aparece aqui.
          </p>
          <p className="text-xs text-muted-foreground mt-6">Toque no <strong>+</strong> abaixo pra começar</p>
        </div>
      )}

      {/* Timeline — accordion months */}
      {monthGroups.map((group, gi) => {
        const isOpen = expanded.has(group.key);
        const firstEntryOfYear = years.length > 1 && (gi === 0 || monthGroups[gi - 1].year !== group.year);

        // Build day-dot preview strip for collapsed state
        const dayDots = group.entries.slice(0, 12).map((e) => ({
          date: e.date,
          mood: e.mood ? MOOD_EMOJIS[e.mood] : null,
          hasContent: !!(e.title || e.content),
        }));

        return (
          <div key={group.key} id={`diary-year-${group.year}`}>
            {/* Year divider — only when multiple years exist */}
            {firstEntryOfYear && (
              <div className="px-6 pt-8 pb-1">
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#5EEAD4" }}>
                  {group.year}
                </span>
              </div>
            )}

            {/* Month header — clickable card */}
            <button
              type="button"
              onClick={() => toggleMonth(group.key)}
              className="w-full text-left transition-all"
              style={{
                margin: "0 12px",
                marginTop: gi === 0 ? 20 : 4,
                padding: "14px 16px",
                borderRadius: 16,
                border: isOpen ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(167,139,250,0.1)",
                background: isOpen ? "rgba(124,92,255,0.06)" : "#1a1530",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff", margin: 0 }}>
                    {group.label}
                  </h2>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#9e96b5" }}>
                    {group.entries.length} {group.entries.length === 1 ? "registro" : "registros"}
                  </span>
                </div>
                {/* Day-dot preview — only when collapsed */}
                {!isOpen && dayDots.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 8, alignItems: "center" }}>
                    {dayDots.map((dot) => (
                      <span key={dot.date}
                        style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: dot.mood ? "rgba(124,92,255,0.4)" : "rgba(167,139,250,0.15)",
                          border: dot.hasContent ? "1px solid rgba(167,139,250,0.3)" : "none",
                        }}
                        title={dot.date}
                      />
                    ))}
                    {group.entries.length > 12 && (
                      <span style={{ fontSize: 9, color: "#9e96b5", marginLeft: 2 }}>+{group.entries.length - 12}</span>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown
                size={18}
                style={{
                  color: isOpen ? "#A78BFA" : "#9e96b5",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                  flexShrink: 0, marginLeft: 8,
                }}
              />
            </button>

            {/* Entries — only rendered when expanded */}
            {isOpen && (
              <div>
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
                      className="w-full text-left transition-colors hover:bg-white/[0.04]"
                      style={{
                        display: "grid", gridTemplateColumns: "52px 1fr",
                        padding: "14px 24px",
                        borderTop: "1px solid rgba(167,139,250,0.06)",
                        background: isToday ? "rgba(124,92,255,0.04)" : "transparent",
                      }}
                    >
                      {/* Date col */}
                      <div>
                        <div style={{
                          fontSize: 18, fontWeight: 700, lineHeight: 1,
                          color: isToday ? "#A78BFA" : "#e0d6ff",
                        }}>
                          {day}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#9e96b5", marginTop: 2 }}>
                          {wk}
                        </div>
                      </div>

                      {/* Content col */}
                      <div className="min-w-0">
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className={`flex items-baseline gap-2 ${entry.title ? "mb-0.5" : ""}`}>
                              {moodEmoji && <span className="text-[15px] leading-none flex-none">{moodEmoji}</span>}
                              {entry.title && (
                                <h3 className="m-0 text-sm font-bold tracking-tight leading-tight flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "#e0d6ff" }}>
                                  {entry.title}
                                </h3>
                              )}
                            </div>
                            {isEmpty ? (
                              <p className="m-0 text-[12.5px] italic" style={{ color: "#9e96b5" }}>
                                Você marcou seu humor, mas não escreveu nada nesse dia.
                              </p>
                            ) : (
                              <p className="m-0 text-[13px] leading-[1.5] overflow-hidden"
                                style={{
                                  display: "-webkit-box", WebkitLineClamp: entry.title ? 2 : 3,
                                  WebkitBoxOrient: "vertical", color: "#9e96b5",
                                } as React.CSSProperties}>
                                {entry.content}
                              </p>
                            )}
                            {photoCount > 1 && (
                              <div className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: "#9e96b5" }}>
                                <ImageIcon className="w-2.5 h-2.5" />{photoCount}
                              </div>
                            )}
                          </div>
                          {/* Thumbnail */}
                          {photoCount > 0 && (
                            <div className="w-14 h-14 flex-none rounded-[10px] overflow-hidden border flex items-center justify-center flex-shrink-0"
                              style={{
                                borderColor: "rgba(167,139,250,0.2)",
                                background: "linear-gradient(135deg, rgba(124,92,255,0.2) 0%, rgba(167,139,250,0.2) 100%)",
                              }}>
                              {entry.photos?.[0] ? (
                                <img src={photoUrl(entry.photos[0])!} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-5 h-5" style={{ color: "rgba(167,139,250,0.4)" }} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* FAB */}
      <div className="fixed bottom-20 right-5 z-40 flex flex-col items-end gap-2">
        {fabOpen && (
          <>
            <button type="button" onClick={() => { router.push("/diario/evolucao"); setFabOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16,
                border: "1px solid rgba(167,139,250,0.25)", background: "#1a1530", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", color: "#e0d6ff" }}>Diário de Evolução</span>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={16} style={{ color: "#A78BFA" }} />
              </span>
            </button>
            <button type="button" onClick={() => { router.push("/diario/novo"); setFabOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16,
                border: "1px solid rgba(167,139,250,0.25)", background: "#1a1530", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", color: "#e0d6ff" }}>Diário Livre</span>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(124,92,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={16} style={{ color: "#A78BFA" }} />
              </span>
            </button>
          </>
        )}
        <button type="button" onClick={() => setFabOpen(!fabOpen)}
          className={`size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-all z-40 ${fabOpen ? "rotate-45" : ""}`}
          aria-label="Nova entrada">
          <Plus className="size-6 transition-transform" />
        </button>
      </div>
    </div>
  );
}
