"use client";
import { getLocale } from "@/lib/language";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/useTranslation";
import { toast } from "sonner";
import { Plus, ImageIcon, BookOpen, Sparkles, ChevronDown, Lock } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";
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
      const raw = d.toLocaleDateString(getLocale(), { month: "long", year: "numeric" });
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
  const [pinPrompt, setPinPrompt] = useState<string | null>(null); // entry id, "setup", or "remove"
  const [pinInput, setPinInput] = useState("");
  const today = getLocalDate();

  const getPin = () => { try { return localStorage.getItem("diary_pin") || ""; } catch { return ""; } };
  const savePin = (pin: string) => {
    try { localStorage.setItem("diary_pin", pin); } catch {}
    // Also sync to server
    fetch("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { diary_pin: pin } }) }).catch(() => {});
  };
  const pinSet = getPin();

  // Load PIN from server on mount
  useEffect(() => {
    fetch("/api/preferences").then(r => r.json()).then(d => {
      const serverPin = d?.context?.diary_pin;
      if (serverPin && !getPin()) {
        try { localStorage.setItem("diary_pin", serverPin); } catch {}
      }
    }).catch(() => {});
  }, []);

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
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Suas memórias</p>
            <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">Diário</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </p>
          </div>
          <button type="button" onClick={() => {
            if (pinSet) {
              setPinPrompt("remove"); setPinInput("");
            } else {
              setPinPrompt("setup"); setPinInput("");
            }
          }}
            style={{
              padding: "8px 14px", borderRadius: 9999,
              border: pinSet ? "1px solid rgba(255,77,77,0.3)" : "1px solid rgba(167,139,250,0.2)",
              background: pinSet ? "rgba(255,77,77,0.1)" : "transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              color: pinSet ? "#FF4D4D" : "#A78BFA", display: "flex", alignItems: "center", gap: 6,
              whiteSpace: "nowrap",
            }}>
            <Lock size={12} />
            {pinSet ? "PIN ativo" : "Criar PIN"}
          </button>
        </div>
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

        // Build day-dot strip: one dot per day of the month
        const [yearStr, monthStr] = group.key.split("-");
        const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr) + 1, 0).getDate();
        const entryDates = new Set(group.entries.map((e) => e.date));
        const dayDots = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${yearStr}-${String(parseInt(monthStr) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return { day, hasEntry: entryDates.has(dateStr) };
        });

        return (
          <div key={group.key} id={`diary-year-${group.year}`}>
            {/* Year divider — only when multiple years exist */}
            {firstEntryOfYear && (
              <div style={{ padding: "0 20px 0 20px", marginTop: 28 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "#5EEAD4" }}>
                  {group.year}
                </span>
              </div>
            )}

            {/* Month header — clickable card */}
            <button
              type="button"
              onClick={() => toggleMonth(group.key)}
              style={{
                width: "calc(100% - 32px)",
                margin: "0 16px",
                marginTop: gi === 0 ? 20 : 4,
                padding: "14px 16px",
                borderRadius: 16,
                border: isOpen ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(167,139,250,0.1)",
                background: isOpen ? "rgba(124,92,255,0.06)" : "#1a1530",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                textAlign: "left",
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
                {/* Day-dot strip — one dot per day of month (only when collapsed) */}
                {!isOpen && (
                  <div style={{ display: "flex", gap: 2, marginTop: 8, alignItems: "center" }}>
                    {dayDots.map((dot) => (
                      <span key={dot.day}
                        style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: dot.hasEntry ? "rgba(124,92,255,0.55)" : "rgba(167,139,250,0.1)",
                          flexShrink: 0,
                        }}
                      />
                    ))}
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
                  const wk = d.toLocaleDateString(getLocale(), { weekday: "short" }).toUpperCase().replace(".", "");
                  const photoCount = entry.photos?.length ?? 0;
                  const isEmpty = !entry.title && !entry.content;
                  const moodEmoji = entry.mood ? MOOD_EMOJIS[entry.mood] : null;
                  const isToday = entry.date === today;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        if (pinSet) {
                          // PIN is set — all entries require verification
                          setPinPrompt(entry.id);
                          setPinInput("");
                        } else {
                          router.push(`/diario/${entry.id}`);
                        }
                      }}
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
                            {pinSet ? (
                              <p className="m-0 text-[12.5px]" style={{ color: "#FF4D4D", display: "flex", alignItems: "center", gap: 4 }}>
                                <Lock size={10} /> Registro privado
                              </p>
                            ) : isEmpty ? (
                              <p className="m-0 text-[12.5px] italic" style={{ color: "#9e96b5" }}>
                                Você marcou seu humor, mas não escreveu nada nesse dia.
                              </p>
                            ) : (
                              <p className="m-0 text-[13px] leading-[1.5] overflow-hidden"
                                style={{
                                  display: "-webkit-box", WebkitLineClamp: entry.title ? 2 : 3,
                                  WebkitBoxOrient: "vertical", color: "#9e96b5",
                                } as React.CSSProperties}>
                                {entry.content?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&#8203;/g, "") || ""}
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
      {/* ── PIN modals ─────────────────────────────────── */}
      {pinPrompt === "remove" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 300, background: "#1a1530", borderRadius: 24, padding: 28, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <span style={{ fontSize: 40 }}>🔓</span>
            <h3 style={{ margin: "12px 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>Remover PIN</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9e96b5" }}>Digite o PIN atual para remover</p>
            <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" autoFocus
              value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              style={{ width: 120, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.3)", background: "#0B0B10", color: "#e0d6ff", fontSize: 24, textAlign: "center", fontFamily: "monospace", letterSpacing: 8, outline: "none", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { setPinPrompt(null); setPinInput(""); }}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="button" onClick={() => {
                if (pinInput === getPin()) {
                  try { localStorage.removeItem("diary_pin"); } catch {}
                  fetch("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { diary_pin: null } }) }).catch(() => {});
                  window.location.reload();
                } else {
                  setPinInput(""); toast.error("PIN incorreto");
                }
              }} disabled={pinInput.length !== 4}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, background: pinInput.length === 4 ? "#FF5C5C" : "#1e1840", color: "#fff", fontSize: 14, fontWeight: 700, cursor: pinInput.length === 4 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
      {pinPrompt === "setup" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 300, background: "#1a1530", borderRadius: 24, padding: 28, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <span style={{ fontSize: 40 }}>🔐</span>
            <h3 style={{ margin: "12px 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>Criar PIN</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9e96b5" }}>4 dígitos para acessar registros privados</p>
            <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" autoFocus
              value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              style={{ width: 120, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.3)", background: "#0B0B10", color: "#e0d6ff", fontSize: 24, textAlign: "center", fontFamily: "monospace", letterSpacing: 8, outline: "none", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setPinPrompt(null)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="button" onClick={() => {
                if (pinInput.length === 4) {
                  savePin(pinInput);
                  setPinPrompt(null); setPinInput("");
                }
              }} disabled={pinInput.length !== 4}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, background: pinInput.length === 4 ? "#7C5CFF" : "#1e1840", color: "#fff", fontSize: 14, fontWeight: 700, cursor: pinInput.length === 4 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {pinPrompt && pinPrompt !== "setup" && pinPrompt !== "remove" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 300, background: "#1a1530", borderRadius: 24, padding: 28, border: "1px solid rgba(167,139,250,0.2)", textAlign: "center" }}>
            <span style={{ fontSize: 40 }}>🔒</span>
            <h3 style={{ margin: "12px 0 4px", fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>Registro privado</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9e96b5" }}>Digite seu PIN para acessar</p>
            <input type="password" maxLength={4} inputMode="numeric" pattern="[0-9]*" autoFocus
              value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={e => {
                if (e.key === "Enter" && pinInput.length === 4 && pinInput === getPin()) {
                  router.push(`/diario/${pinPrompt}`); setPinPrompt(null); setPinInput("");
                }
              }}
              style={{ width: 120, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.3)", background: "#0B0B10", color: "#e0d6ff", fontSize: 24, textAlign: "center", fontFamily: "monospace", letterSpacing: 8, outline: "none", marginBottom: 16 }} />
            <button type="button" onClick={() => {
              if (confirm("Resetar seu PIN?\n\nVocê poderá criar um novo PIN na próxima vez que acessar um registro privado.")) {
                try { localStorage.removeItem("diary_pin"); } catch {}
                fetch("/api/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { diary_pin: null } }) }).catch(() => {});
                setPinPrompt("setup"); setPinInput("");
              }
            }}
              style={{ background: "none", border: 0, color: "#FF5C5C", cursor: "pointer", fontSize: 11, fontFamily: "inherit", marginBottom: 12, textDecoration: "underline" }}>
              Esqueci o PIN
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { setPinPrompt(null); setPinInput(""); }}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="button" onClick={() => {
                if (pinInput === getPin()) { router.push(`/diario/${pinPrompt}`); setPinPrompt(null); setPinInput(""); }
                else { setPinInput(""); toast.error("PIN incorreto"); }
              }} disabled={pinInput.length !== 4}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, background: pinInput.length === 4 ? "#7C5CFF" : "#1e1840", color: "#fff", fontSize: 14, fontWeight: 700, cursor: pinInput.length === 4 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}

        <button type="button" onClick={() => setFabOpen(!fabOpen)}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#7C5CFF", border: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
            transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            zIndex: 40,
          }}
          aria-label="Nova entrada">
          <Plus size={24} color="#fff" />
        </button>
      </div>
    </div>
  );
}
