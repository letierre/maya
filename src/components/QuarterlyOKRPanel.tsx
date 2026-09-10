"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Check, Loader2, ChevronDown, ChevronRight, Target, TrendingUp, Award, Star, Edit3 } from "lucide-react";
import { toast } from "sonner";
import type { QuarterlyCycle, KeyResult } from "@/types";
import { AREA_CONFIG, AREA_LABELS } from "@/lib/planejamento-constants";

const UNIT_LABELS: Record<string, string> = {
  "%": "%", "count": "x", "kg": "kg", "min": "min", "km": "km", "R$": "R$",
};

export function QuarterlyOKRPanel({ autoOpenCreate }: { autoOpenCreate?: number }) {
  const [cycles, setCycles] = useState<QuarterlyCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());

  // Create cycle form
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newQuarter, setNewQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [newTheme, setNewTheme] = useState("");

  // Add KR form
  const [addingKRFor, setAddingKRFor] = useState<string | null>(null);
  const [newKRTitle, setNewKRTitle] = useState("");
  const [newKRUnit, setNewKRUnit] = useState("%");
  const [newKRTarget, setNewKRTarget] = useState(100);
  const [newKRGoalId, setNewKRGoalId] = useState<string>("");
  const [goals, setGoals] = useState<any[]>([]);

  // Edit KR progress
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editKRValue, setEditKRValue] = useState(0);

  // Review form
  const [reviewingCycle, setReviewingCycle] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewWin, setReviewWin] = useState("");
  const [reviewLearn, setReviewLearn] = useState("");
  const [reviewForward, setReviewForward] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchCycles = async () => {
    try {
      const r = await fetch("/api/quarterly-cycles");
      const data = await r.json();
      if (Array.isArray(data)) setCycles(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchCycles(); }, []);

  useEffect(() => {
    fetch("/api/goals").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setGoals(d.filter((g: any) => g.status === "ativa"));
    }).catch(() => {});
  }, []);

  // Auto-expand active cycle
  useEffect(() => {
    const active = cycles.find(c => c.status === "active");
    if (active) setExpandedCycles(prev => new Set(prev).add(active.id));
  }, [cycles]);

  // Aberto de fora (FAB do hub): quando o contador muda, abre o form de novo ciclo.
  useEffect(() => {
    if (autoOpenCreate && autoOpenCreate > 0) setShowCreate(true);
  }, [autoOpenCreate]);

  const activeCycle = useMemo(() => cycles.find(c => c.status === "active"), [cycles]);
  const completedCycles = useMemo(() => cycles.filter(c => c.status === "completed"), [cycles]);

  const toggleExpand = (id: string) => {
    setExpandedCycles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createCycle = async () => {
    // Compute quarter dates
    const startMonth = (newQuarter - 1) * 3;
    const start = `${newYear}-${String(startMonth + 1).padStart(2, "0")}-01`;
    const endMonth = startMonth + 3;
    const endDate = new Date(newYear, startMonth + 2, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    const res = await fetch("/api/quarterly-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: newYear, quarter: newQuarter, start_date: start, end_date: end, theme: newTheme || null }),
    });
    if (res.ok) {
      toast.success("Novo ciclo criado!");
      setShowCreate(false);
      setNewTheme("");
      fetchCycles();
    } else {
      const err = await res.json();
      toast.error(err.error || "Erro ao criar ciclo");
    }
  };

  const addKR = async (cycleId: string) => {
    if (!newKRTitle.trim()) return;
    const res = await fetch(`/api/quarterly-cycles/${cycleId}/key-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newKRTitle.trim(), unit: newKRUnit, target: newKRTarget, linked_goal_id: newKRGoalId || null }),
    });
    if (res.ok) {
      toast.success("Resultado adicionado!");
      setAddingKRFor(null);
      setNewKRTitle("");
      setNewKRUnit("%");
      setNewKRTarget(100);
      setNewKRGoalId("");
      fetchCycles();
    } else {
      toast.error("Erro ao adicionar resultado");
    }
  };

  const updateKRProgress = async (cycleId: string, kr: KeyResult) => {
    const res = await fetch(`/api/quarterly-cycles/${cycleId}/key-results/${kr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: editKRValue }),
    });
    if (res.ok) {
      setEditingKR(null);
      fetchCycles();
    } else {
      toast.error("Erro ao atualizar progresso");
    }
  };

  const toggleKR = async (cycleId: string, kr: KeyResult) => {
    const newStatus = kr.status === "completed" ? "active" : "completed";
    const res = await fetch(`/api/quarterly-cycles/${cycleId}/key-results/${kr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      fetchCycles();
    }
  };

  const submitReview = async (cycleId: string) => {
    if (!reviewWin.trim() || !reviewLearn.trim()) return;
    setSubmittingReview(true);
    const res = await fetch(`/api/quarterly-cycles/${cycleId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overall_score: reviewScore,
        biggest_win: reviewWin,
        main_learning: reviewLearn,
        what_to_carry_forward: reviewForward,
      }),
    });
    if (res.ok) {
      toast.success("Review salva!");
      setReviewingCycle(null);
      fetchCycles();
    } else {
      toast.error("Erro ao salvar review");
    }
    setSubmittingReview(false);
  };

  const completeCycle = async (cycleId: string) => {
    const res = await fetch(`/api/quarterly-cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      toast.success("Ciclo concluído!");
      fetchCycles();
    }
  };

  // Compute aggregate progress for a cycle
  const cycleProgress = (cycle: QuarterlyCycle): { pct: number; done: number; total: number } => {
    const krs = cycle.key_results || [];
    if (krs.length === 0) return { pct: 0, done: 0, total: 0 };
    let totalPct = 0;
    for (const kr of krs) {
      totalPct += kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
    }
    return {
      pct: Math.round(totalPct / krs.length),
      done: krs.filter(k => k.status === "completed").length,
      total: krs.length,
    };
  };

  const quarterLabel = (q: number) => {
    const map: Record<number, string> = { 1: "Jan–Mar", 2: "Abr–Jun", 3: "Jul–Set", 4: "Out–Dez" };
    return map[q] || `Q${q}`;
  };

  if (loading) {
    return <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center", padding: 20 }}>Carregando...</p>;
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Resultados do trimestre</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6a657a" }}>
            A ponte entre suas metas e a semana
          </p>
        </div>
        {!activeCycle && (
          <button type="button" onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 12,
              border: 0, background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", boxShadow: "0 2px 12px rgba(124,92,255,0.3)",
            }}>
            <Plus size={16} /> Novo ciclo
          </button>
        )}
      </div>

      {/* ── Active Cycle ───────────────────────────────────── */}
      {activeCycle && (
        <div style={{
          background: "linear-gradient(135deg, #1a1530 0%, rgba(124,92,255,0.08) 100%)",
          borderRadius: 20, border: "1px solid rgba(124,92,255,0.18)",
          padding: "18px 18px 14px", marginBottom: 16,
        }}>
          {/* Cycle header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24 }}>🎯</span>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>
                    {activeCycle.label}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6a657a" }}>
                    {quarterLabel(activeCycle.quarter)} · {new Date(activeCycle.start_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – {new Date(activeCycle.end_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
              {activeCycle.theme && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#A78BFA", fontWeight: 500, fontStyle: "italic" }}>
                  "{activeCycle.theme}"
                </p>
              )}
            </div>
            {/* Overall progress badge */}
            {(() => {
              const prog = cycleProgress(activeCycle);
              return (
                <div style={{
                  textAlign: "center", flexShrink: 0,
                  background: "rgba(124,92,255,0.12)",
                  borderRadius: 14, padding: "8px 14px",
                }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#A78BFA", fontFamily: "monospace" }}>
                    {prog.pct}%
                  </p>
                  <p style={{ margin: 0, fontSize: 9, color: "#6a657a" }}>
                    {prog.done}/{prog.total} resultados
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Key Results */}
          {(activeCycle.key_results || []).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {activeCycle.key_results!.map((kr) => {
                const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
                const areaConf = kr.area ? AREA_CONFIG[kr.area as keyof typeof AREA_CONFIG] : null;
                const unitLabel = UNIT_LABELS[kr.unit] || kr.unit;
                const isEditing = editingKR === kr.id;
                const isCompleted = kr.status === "completed";
                const progressColor = isCompleted ? "#5EEAD4" : pct >= 70 ? "#22D18B" : pct >= 30 ? "#F59E0B" : "#FF7070";

                return (
                  <div key={kr.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 0",
                    borderTop: "1px solid rgba(167,139,250,0.05)",
                  }}>
                    {/* Checkbox */}
                    <button type="button" onClick={() => toggleKR(activeCycle.id, kr)}
                      style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: isCompleted ? "none" : "1.5px solid rgba(167,139,250,0.3)",
                        background: isCompleted ? "#7C5CFF" : "transparent",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      {isCompleted && <Check size={12} color="#fff" />}
                    </button>

                    {/* KR info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {areaConf && <span style={{ fontSize: 12 }}>{areaConf.emoji}</span>}
                        <span style={{
                          fontSize: 12, fontWeight: 600, color: isCompleted ? "#5a5470" : "#e0d6ff",
                          textDecoration: isCompleted ? "line-through" : "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {kr.title}
                        </span>
                        <span style={{ fontSize: 9, color: "#6a657a", flexShrink: 0 }}>
                          ({kr.current}{unitLabel}/{kr.target}{unitLabel})
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          flex: 1, height: 5, borderRadius: 9999,
                          background: "rgba(167,139,250,0.08)", overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 9999,
                            width: `${pct}%`, background: progressColor,
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: progressColor, width: 32, textAlign: "right", flexShrink: 0 }}>
                          {pct}%
                        </span>
                      </div>

                      {/* Inline edit */}
                      {isEditing && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <input type="number" value={editKRValue} onChange={e => setEditKRValue(Number(e.target.value))}
                            autoFocus style={{
                              flex: 1, padding: "6px 10px", borderRadius: 8,
                              border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10",
                              color: "#e0d6ff", fontSize: 12, fontFamily: "inherit", outline: "none",
                              maxWidth: 100,
                            }} />
                          <button type="button" onClick={() => updateKRProgress(activeCycle.id, kr)}
                            style={{
                              padding: "5px 10px", borderRadius: 8, border: 0,
                              background: "#7C5CFF", color: "#fff", fontSize: 10, fontWeight: 600,
                              cursor: "pointer", fontFamily: "inherit",
                            }}>OK</button>
                          <button type="button" onClick={() => setEditingKR(null)}
                            style={{
                              padding: "5px 8px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)",
                              background: "transparent", color: "#9e96b5", fontSize: 10, cursor: "pointer",
                              fontFamily: "inherit",
                            }}>✕</button>
                        </div>
                      )}
                    </div>

                    {/* Edit button */}
                    <button type="button"
                      onClick={() => {
                        setEditingKR(kr.id);
                        setEditKRValue(kr.current);
                      }}
                      style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                        border: 0, background: "rgba(167,139,250,0.1)", color: "#9e96b5",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: isEditing ? 0 : 1,
                      }}>
                      <Edit3 size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty KRs state */}
          {(!activeCycle.key_results || activeCycle.key_results.length === 0) && (
            <p style={{ margin: "10px 0", fontSize: 12, color: "#5a5470", textAlign: "center" }}>
              Nenhum resultado definido ainda.
            </p>
          )}

          {/* Actions row */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {addingKRFor === activeCycle.id ? (
              <div style={{ flex: 1 }}>
                <select value={newKRGoalId} onChange={e => setNewKRGoalId(e.target.value)}
                  style={{
                    width: "100%", marginBottom: 6, padding: "8px 10px", borderRadius: 10,
                    border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10",
                    color: "#e0d6ff", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box",
                  }}>
                  <option value="">Sem meta vinculada</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input value={newKRTitle} onChange={e => setNewKRTitle(e.target.value)} placeholder="Resultado..." autoFocus
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
                      background: "#0B0B10", color: "#e0d6ff", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }} />
                  <select value={newKRUnit} onChange={e => setNewKRUnit(e.target.value)}
                    style={{
                      padding: "8px 6px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
                      background: "#0B0B10", color: "#e0d6ff", fontSize: 11, fontFamily: "inherit",
                    }}>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input type="number" value={newKRTarget} onChange={e => setNewKRTarget(Number(e.target.value))}
                    style={{
                      width: 60, padding: "8px 6px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
                      background: "#0B0B10", color: "#e0d6ff", fontSize: 12, fontFamily: "inherit", outline: "none",
                    }} />
                  <button type="button" onClick={() => addKR(activeCycle.id)}
                    style={{
                      padding: "8px 12px", borderRadius: 10, border: 0, background: "#7C5CFF", color: "#fff",
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    }}>Adicionar</button>
                  <button type="button" onClick={() => setAddingKRFor(null)}
                    style={{
                      padding: "8px", borderRadius: 10, border: 0, background: "transparent", color: "#9e96b5",
                      fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    }}>✕</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingKRFor(activeCycle.id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "9px 0", borderRadius: 12, border: "1.5px dashed rgba(124,92,255,0.25)",
                  background: "rgba(124,92,255,0.03)", cursor: "pointer", color: "#A78BFA",
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                }}>
                <Plus size={14} /> Adicionar resultado
              </button>
            )}

            {/* Complete cycle */}
            <button type="button" onClick={() => completeCycle(activeCycle.id)}
              style={{
                padding: "9px 14px", borderRadius: 12, border: "1px solid rgba(94,234,212,0.2)",
                background: "rgba(94,234,212,0.04)", cursor: "pointer", color: "#5EEAD4",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
              <Check size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Concluir ciclo
            </button>
          </div>
        </div>
      )}

      {/* ── Create Cycle ───────────────────────────────────── */}
      {showCreate && (
        <div style={{
          background: "#151520", borderRadius: 20, border: "1px solid rgba(124,92,255,0.12)",
          padding: "18px 18px 14px", marginBottom: 16,
        }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>
            Novo ciclo trimestral
          </h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: "#6a657a", display: "block", marginBottom: 4 }}>Ano</label>
              <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                style={inputS} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: "#6a657a", display: "block", marginBottom: 4 }}>Trimestre</label>
              <select value={newQuarter} onChange={e => setNewQuarter(Number(e.target.value))}
                style={inputS}>
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Abr–Jun)</option>
                <option value={3}>Q3 (Jul–Set)</option>
                <option value={4}>Q4 (Out–Dez)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: "#6a657a", display: "block", marginBottom: 4 }}>Tema (opcional)</label>
            <input value={newTheme} onChange={e => setNewTheme(e.target.value)} placeholder='"Trimestre do crescimento profissional"' style={inputS} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setShowCreate(false)}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 14,
                border: "1px solid rgba(167,139,250,0.2)", background: "transparent",
                color: "#9e96b5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Cancelar</button>
            <button type="button" onClick={createCycle}
              style={{
                flex: 2, padding: "12px 0", borderRadius: 14, border: 0,
                background: "linear-gradient(135deg, #7C5CFF, #A78BFA)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>Criar ciclo</button>
          </div>
        </div>
      )}

      {/* ── No cycles at all ───────────────────────────────── */}
      {!activeCycle && !showCreate && cycles.length === 0 && (
        <div style={{
          textAlign: "center", padding: "30px 20px",
          background: "#151520", borderRadius: 20, border: "1px solid rgba(167,139,250,0.08)",
        }}>
          <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>🎯</span>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#e0d6ff" }}>
            Nenhum ciclo ainda
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6a657a", maxWidth: 280, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Crie seu primeiro ciclo trimestral com resultados para conectar suas metas com sua semana.
          </p>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{
              padding: "12px 24px", borderRadius: 14, border: 0,
              background: "linear-gradient(135deg, #7C5CFF, #A78BFA)", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
            Criar primeiro ciclo
          </button>
        </div>
      )}

      {/* ── Completed cycles ───────────────────────────────── */}
      {completedCycles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
            Histórico
          </p>
          {completedCycles.map(cycle => {
            const isExpanded = expandedCycles.has(cycle.id);
            const prog = cycleProgress(cycle);
            return (
              <div key={cycle.id} style={{
                background: "#151520", borderRadius: 16, border: "1px solid rgba(167,139,250,0.06)",
                marginBottom: 8, overflow: "hidden",
              }}>
                <button type="button" onClick={() => toggleExpand(cycle.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", border: 0, background: "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  <span style={{ fontSize: 18 }}>{cycle.review ? "🏆" : "📦"}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0d6ff" }}>
                      {cycle.label} · {quarterLabel(cycle.quarter)}
                    </p>
                    {cycle.theme && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6a657a", fontStyle: "italic" }}>
                        "{cycle.theme}"
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#5EEAD4", fontFamily: "monospace" }}>
                      {prog.pct}%
                    </p>
                    <p style={{ margin: 0, fontSize: 9, color: "#6a657a" }}>{prog.done}/{prog.total} KRs</p>
                  </div>
                  {isExpanded ? <ChevronDown size={14} color="#6a657a" /> : <ChevronRight size={14} color="#6a657a" />}
                </button>

                {isExpanded && (
                  <div style={{ padding: "8px 14px 14px", borderTop: "1px solid rgba(167,139,250,0.04)" }}>
                    {/* KRs list */}
                    {(cycle.key_results || []).map(kr => {
                      const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
                      return (
                        <div key={kr.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                          <span style={{ fontSize: 12, color: kr.status === "completed" ? "#5EEAD4" : "#9e96b5" }}>
                            {kr.status === "completed" ? "✓" : "○"}
                          </span>
                          <span style={{ flex: 1, fontSize: 11, color: "#9e96b5" }}>{kr.title}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#6a657a" }}>{pct}%</span>
                        </div>
                      );
                    })}

                    {/* Review */}
                    {cycle.review ? (
                      <div style={{
                        marginTop: 8, padding: "10px 12px", borderRadius: 12,
                        background: "rgba(94,234,212,0.05)", border: "1px solid rgba(94,234,212,0.1)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <Award size={14} color="#5EEAD4" />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#5EEAD4" }}>Review</span>
                          <div style={{ display: "flex", gap: 1, marginLeft: "auto" }}>
                            {Array.from({ length: 10 }).map((_, i) => (
                              <span key={i} style={{ fontSize: 10, color: i < cycle.review!.overall_score ? "#F59E0B" : "rgba(167,139,250,0.12)" }}>★</span>
                            ))}
                          </div>
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9e96b5" }}>🏆 {cycle.review.biggest_win}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9e96b5" }}>💡 {cycle.review.main_learning}</p>
                      </div>
                    ) : (
                      <button type="button" onClick={() => {
                        setReviewingCycle(cycle.id);
                        setReviewScore(5);
                        setReviewWin("");
                        setReviewLearn("");
                        setReviewForward("");
                      }}
                        style={{
                          width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 12,
                          border: "1px dashed rgba(94,234,212,0.2)", background: "rgba(94,234,212,0.03)",
                          cursor: "pointer", color: "#5EEAD4", fontSize: 12, fontWeight: 600,
                          fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}>
                        <Star size={14} /> Fazer review do ciclo
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Review Modal ───────────────────────────────────── */}
      {reviewingCycle && (
        <div onTouchMove={(e) => e.stopPropagation()}
          style={{
            position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
          <div style={{
            width: "100%", maxWidth: 400, maxHeight: "85dvh", overflowY: "auto",
            background: "#151520", borderRadius: 24, padding: 24,
            border: "1px solid rgba(167,139,250,0.15)",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>
              Review do ciclo
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9e96b5" }}>
              Como foi este trimestre?
            </p>

            <textarea value={reviewWin} onChange={e => setReviewWin(e.target.value)}
              placeholder="🏆 Qual foi sua maior vitória?" rows={2}
              style={{ ...inputS, resize: "none", height: 56, marginBottom: 10, width: "100%", boxSizing: "border-box" }} />
            <textarea value={reviewLearn} onChange={e => setReviewLearn(e.target.value)}
              placeholder="💡 Principal aprendizado" rows={2}
              style={{ ...inputS, resize: "none", height: 56, marginBottom: 10, width: "100%", boxSizing: "border-box" }} />
            <textarea value={reviewForward} onChange={e => setReviewForward(e.target.value)}
              placeholder="➡️ O que levar para o próximo ciclo?" rows={2}
              style={{ ...inputS, resize: "none", height: 56, marginBottom: 12, width: "100%", boxSizing: "border-box" }} />

            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#9e96b5" }}>Nota geral (1–10)</p>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setReviewScore(i + 1)}
                  style={{
                    fontSize: 22, background: "none", border: 0, cursor: "pointer",
                    filter: i < reviewScore ? "none" : "grayscale(1) opacity(.3)",
                    transition: "filter .15s",
                  }}>★</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setReviewingCycle(null)}
                style={{
                  flex: 1, padding: 14, borderRadius: 14,
                  border: "1px solid rgba(167,139,250,0.2)", background: "transparent",
                  color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>Cancelar</button>
              <button type="button" onClick={() => submitReview(reviewingCycle)}
                disabled={submittingReview || !reviewWin.trim() || !reviewLearn.trim()}
                style={{
                  flex: 2, padding: 14, borderRadius: 14, border: 0,
                  background: (reviewWin.trim() && reviewLearn.trim()) ? "#7C5CFF" : "#1e1840",
                  color: (reviewWin.trim() && reviewLearn.trim()) ? "#fff" : "#9e96b5",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                {submittingReview ? (
                  <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Salvando...</>
                ) : "Salvar review"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10",
  color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};
