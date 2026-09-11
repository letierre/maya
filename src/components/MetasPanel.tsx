"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { GoalCreateSheet } from "@/components/GoalCreateSheet";
import { GoalDetailSheet } from "@/components/GoalDetailSheet";
import { QuarterlyOKRPanel } from "@/components/QuarterlyOKRPanel";
import {
  AREA_CONFIG, AREA_LABELS, LIFE_AREAS,
} from "@/lib/planejamento-constants";
import { getLocalDate, getWeekMondayDate, getWeekSundayDate } from "@/lib/utils";
import type { QuarterlyCycle, AreaVision } from "@/types";

const CADENCE: Record<string, string> = {
  daily: "diário", weekly: "semanal", weekdays: "dias úteis", monthly: "mensal", yearly: "anual",
};

const AREA_FULL_LABELS: Record<string, string> = {
  saude: "Saúde", carreira: "Carreira", financas: "Finanças",
  relacionamentos: "Relacionamentos", desenvolvimento: "Mente",
  familia: "Família", lazer: "Lazer", espiritualidade: "Espiritualidade",
};

const HINT_RESULTADOS = "💡 Resultados nascem no ciclo do trimestre: crie um resultado (R$, %, x…) e vincule a esta meta para acompanhar o avanço.";
const HINT_MOTOR = "💡 Hábitos nascem na agenda: adicione um compromisso/tarefa com repetição (diário, semanal…) e vincule a esta meta.";
const HINT_SEMANA = "💡 Sua semana nasce no planejador: vincule tarefas do plano semanal a esta meta (ou adicione um compromisso/tarefa na agenda).";

const fabItemStyle: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", gap: 12,
  padding: "14px 16px", border: 0, background: "transparent",
  cursor: "pointer", fontFamily: "inherit",
  borderBottom: "1px solid rgba(167,139,250,0.06)",
};

function InfoIcon() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 15, height: 15, borderRadius: "50%",
      border: "1px solid rgba(167,139,250,0.4)", color: "#A78BFA",
      fontSize: 10, fontWeight: 700, lineHeight: 1, flexShrink: 0, userSelect: "none",
    }}>i</span>
  );
}

export function MetasPanel() {
  const router = useRouter();
  const [goals, setGoals] = useState<any[]>([]);
  const [visions, setVisions] = useState<AreaVision[]>([]);
  const [cycles, setCycles] = useState<QuarterlyCycle[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [motors, setMotors] = useState<any[]>([]);
  const [weekTasks, setWeekTasks] = useState<any[]>([]);
  const [weekFocus, setWeekFocus] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [showMayaPick, setShowMayaPick] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [cycleCreateTrigger, setCycleCreateTrigger] = useState(0);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [visionArea, setVisionArea] = useState("");
  const [visionDraft, setVisionDraft] = useState("");
  const [savingVision, setSavingVision] = useState(false);
  const [infoOpen, setInfoOpen] = useState<Set<string>>(new Set());

  // Scroll: efeitos atualizados via ref (sem re-render) para rolagem suave
  const cascadeRef = useRef<HTMLDivElement>(null);
  const visaoRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const fioFillRef = useRef<HTMLDivElement>(null);
  const fioDotRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const today = getLocalDate();
    const monday = getWeekMondayDate();
    const sunday = getWeekSundayDate();
    try {
      const [g, v, c, s, m, w] = await Promise.all([
        fetch("/api/goals").then((r) => r.json()).catch(() => []),
        fetch("/api/area-visions").then((r) => r.json()).catch(() => []),
        fetch("/api/quarterly-cycles").then((r) => r.json()).catch(() => []),
        fetch(`/api/goal-daily-status?date=${today}`).then((r) => r.json()).catch(() => ({ statuses: [] })),
        fetch("/api/goal-motor").then((r) => r.json()).catch(() => ({ motors: [] })),
        fetch(`/api/weekly-plans?from=${monday}&to=${sunday}`).then((r) => r.json()).catch(() => ({ plans: [] })),
      ]);
      setGoals(Array.isArray(g) ? g : []);
      setVisions(Array.isArray(v) ? v : []);
      setCycles(Array.isArray(c) ? c : []);
      setStatuses(Array.isArray(s?.statuses) ? s.statuses : []);
      setMotors(Array.isArray(m?.motors) ? m.motors : []);

      const plans = Array.isArray(w?.plans) ? w.plans : [];
      const tasks: any[] = [];
      const focus: Record<string, string[]> = {};
      for (const p of plans) {
        for (const t of p.weekly_tasks ?? []) tasks.push(t);
        for (const f of p.weekly_focus_goals ?? []) {
          if (f.goal_id) {
            if (!focus[f.goal_id]) focus[f.goal_id] = [];
            if (p.main_focus) focus[f.goal_id].push(p.main_focus);
          }
        }
      }
      setWeekTasks(tasks);
      setWeekFocus(focus);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  // Scroll effects: atualiza o DOM direto (sem re-render) para rolagem suave.
  useEffect(() => {
    const onScroll = (ev?: Event) => {
      const el = cascadeRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = rect.height - vh;
        const p = total <= 0 ? 1 : Math.max(0, Math.min(1, -rect.top / total));
        if (fioFillRef.current) fioFillRef.current.style.height = `${p * 100}%`;
        if (fioDotRef.current) fioDotRef.current.style.top = `${p * 100}%`;
      }
      const visao = visaoRef.current;
      if (visao && parallaxRef.current) {
        const rect = visao.getBoundingClientRect();
        const offset = Math.max(0, Math.min(40, -rect.top * 0.14));
        parallaxRef.current.style.transform = `translateY(${offset}px)`;
      }
      // Progresso da rolagem da tela inteira. O scroller é o <main> (body é
      // overflow-hidden), não o window — então medimos via ev.target/main.
      const target = ev && ev.target instanceof HTMLElement ? ev.target : null;
      const scroller = target || (document.querySelector("main") as HTMLElement | null) || document.documentElement;
      const totalDoc = scroller.scrollHeight - scroller.clientHeight;
      const prog = totalDoc > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / totalDoc)) : 0;
      if (progressBarRef.current) progressBarRef.current.style.width = `${prog * 100}%`;
    };
    onScroll();
    // capture:true — o evento de scroll não propaga por bubbling, então capturamos
    // no document para pegar o scroll do <main>.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [loading]);

  // Default-expand o "foco" (metas ligadas ao ciclo ativo), senão a 1ª meta ativa
  useEffect(() => {
    if (cycles.length === 0 || goals.length === 0) return;
    const active = cycles.find((c) => c.status === "active");
    const focusIds = new Set<string>();
    if (active) {
      for (const kr of active.key_results ?? []) if (kr.linked_goal_id) focusIds.add(kr.linked_goal_id);
    }
    if (focusIds.size === 0) {
      const first = goals.filter((g) => g.status === "ativa")[0];
      if (first) focusIds.add(first.id);
    }
    setExpanded(focusIds);
  }, [cycles, goals]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleInfo = (key: string) => {
    setInfoOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const talkToMaya = () => {
    const active = goals.filter((g) => g.status === "ativa");
    if (active.length === 1) router.push(`/insights?draft=Quero falar sobre minha meta: ${active[0].title}`);
    else if (active.length > 1) setShowMayaPick(true);
  };

  const saveVision = async () => {
    if (!visionArea || !visionDraft.trim()) return;
    setSavingVision(true);
    try {
      await fetch("/api/area-visions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: visionArea, statement: visionDraft }),
      });
      setShowVisionModal(false);
      setVisionArea("");
      setVisionDraft("");
      refresh();
    } catch {}
    setSavingVision(false);
  };

  const deleteVision = async (id: string) => {
    try {
      await fetch(`/api/area-visions?id=${id}`, { method: "DELETE" });
      refresh();
    } catch {}
  };

  const activeGoals = goals.filter((g) => g.status === "ativa" || g.status === "pausada");
  const completedGoals = goals.filter((g) => g.status === "concluida");

  const statusByGoal = new Map<string, any>();
  for (const s of statuses) statusByGoal.set(s.goal_id, s);

  const motorByGoal = new Map<string, any[]>();
  for (const m of motors) {
    if (!motorByGoal.has(m.goal_id)) motorByGoal.set(m.goal_id, []);
    motorByGoal.get(m.goal_id)!.push(m);
  }

  // OKRs ligados a cada meta (do ciclo ativo)
  const activeCycle = cycles.find((c) => c.status === "active");
  const krByGoal = new Map<string, any[]>();
  if (activeCycle) {
    for (const kr of activeCycle.key_results ?? []) {
      if (!kr.linked_goal_id) continue;
      if (!krByGoal.has(kr.linked_goal_id)) krByGoal.set(kr.linked_goal_id, []);
      krByGoal.get(kr.linked_goal_id)!.push(kr);
    }
  }

  const areasWithGoals = LIFE_AREAS.filter((a) => activeGoals.some((g) => g.area === a));

  if (loading) return <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center", padding: 20 }}>Carregando...</p>;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Barra de progresso da rolagem (tela inteira) */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 200, pointerEvents: "none" }}>
        <div ref={progressBarRef} style={{
          width: "0%", height: "100%",
          background: "linear-gradient(90deg, #7C5CFF, #A78BFA, #5EEAD4)",
          boxShadow: "0 0 12px rgba(124,92,255,0.7)",
          borderRadius: "0 9999px 9999px 0",
        }} />
      </div>

      {/* ── Visão (norte) ─────────────────────────────────────── */}
      <div ref={visaoRef} style={{
        position: "relative", overflow: "hidden",
        borderRadius: 18, marginBottom: 14,
        background: "linear-gradient(160deg, rgba(124,92,255,0.14), rgba(167,139,250,0.05))",
        border: "1px solid rgba(124,92,255,0.16)",
      }}>
        {/* Camada de parallax (desliza suavemente com o scroll) */}
        <div ref={parallaxRef} style={{
          position: "absolute", left: "-20%", top: "-60%", width: "140%", height: "220%",
          background: "radial-gradient(circle at 30% 25%, rgba(124,92,255,0.20), transparent 55%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", padding: "16px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>🌳</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>Visão 5 anos</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#6a657a" }}>O norte que unifica suas metas</p>
          </div>
          <button type="button" onClick={() => { setVisionArea(""); setVisionDraft(""); setShowVisionModal(true); }}
            style={{
              padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(167,139,250,0.25)",
              background: "rgba(124,92,255,0.08)", color: "#A78BFA", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>
            + Adicionar
          </button>
        </div>

        {visions.length === 0 ? (
          <button type="button" onClick={() => { setVisionArea(""); setVisionDraft(""); setShowVisionModal(true); }}
            style={{
              marginTop: 4, width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px dashed rgba(167,139,250,0.3)", background: "transparent",
              color: "#A78BFA", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
            + Escrever minha visão de 5 anos
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {visions.map((v) => (
              <div key={v.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 12,
                border: "1px solid rgba(167,139,250,0.12)", background: "#0f0e1a",
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.3 }}>{AREA_CONFIG[v.area as keyof typeof AREA_CONFIG]?.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#A78BFA", letterSpacing: ".06em", textTransform: "uppercase" }}>
                    {AREA_FULL_LABELS[v.area]}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "#c9c2e0", lineHeight: 1.45, marginTop: 1 }}>{v.statement}</span>
                </div>
                <button type="button" onClick={() => deleteVision(v.id)}
                  style={{ flexShrink: 0, background: "none", border: 0, color: "#6a657a", cursor: "pointer", fontSize: 14, padding: 2, lineHeight: 1, fontFamily: "inherit" }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* ── Resultados do trimestre (onde você gerencia seus OKRs) ── */}
      <QuarterlyOKRPanel autoOpenCreate={cycleCreateTrigger} initialCycles={cycles} initialGoals={activeGoals} />

      {/* ── Cascata conectada ────────────────────────────────── */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, background: "#1a1530", borderRadius: 18, border: "1px dashed rgba(167,139,250,0.15)" }}>
          <p style={{ color: "#9e96b5", fontSize: 13, margin: "0 0 12px" }}>Nenhuma meta ainda</p>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ padding: "8px 16px", borderRadius: 10, border: 0, cursor: "pointer", background: "#7C5CFF", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            + Criar primeira meta
          </button>
        </div>
      ) : (
        <div ref={cascadeRef} style={{ position: "relative", paddingLeft: 18 }}>
          {/* Fio conector (desenha conforme rola) */}
          <div style={{
            position: "absolute", left: 5, top: 6, bottom: 6, width: 2.5,
            background: "oklch(0.28 0.02 270 / 0.5)", borderRadius: 9999,
          }}>
            <div ref={fioFillRef} style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: "0%",
              background: "linear-gradient(180deg, #7C5CFF, #A78BFA)",
              borderRadius: 9999,
              boxShadow: "0 0 12px rgba(124,92,255,0.55)",
            }} />
            <span ref={fioDotRef} style={{
              position: "absolute", top: "0%", left: "50%",
              width: 11, height: 11, borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: "#A78BFA",
              boxShadow: "0 0 14px 3px rgba(167,139,250,0.7)",
            }} />
          </div>

          {areasWithGoals.map((area) => {
            const areaGoals = activeGoals.filter((g) => g.area === area);
            const conf = AREA_CONFIG[area as keyof typeof AREA_CONFIG] || { emoji: "🎯", hue: 270 };
            return (
              <div key={area} style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#5a5470" }}>
                  {conf.emoji} {AREA_FULL_LABELS[area] || AREA_LABELS[area as keyof typeof AREA_LABELS]}
                </p>

                {areaGoals.map((goal) => {
                  const isOpen = expanded.has(goal.id);
                  const st = statusByGoal.get(goal.id);
                  const streak = st?.streak ?? 0;
                  const motorList = motorByGoal.get(goal.id) ?? [];
                  const krList = krByGoal.get(goal.id) ?? [];
                  const wkTasks = weekTasks.filter((t) => t.linked_goal_id === goal.id);
                  const wkFocus = weekFocus[goal.id] ?? [];
                  const effective = st?.effective ?? null;

                  const krPct = krList.length
                    ? Math.round(krList.reduce((s, kr) => s + (kr.target > 0 ? Math.min(100, (kr.current / kr.target) * 100) : 0), 0) / krList.length)
                    : null;

                  return (
                    <div key={goal.id} style={{
                        borderRadius: 14, marginBottom: 8, overflow: "hidden",
                        border: isOpen ? "1px solid rgba(124,92,255,0.22)" : "1px solid rgba(167,139,250,0.12)",
                        background: isOpen ? "#171329" : "#14121f",
                      }}>
                        {/* Header */}
                        <button type="button" onClick={() => toggleExpand(goal.id)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "13px 14px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{conf.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e0d6ff", ...(isOpen ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>
                              {goal.title}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#9e96b5" }}>
                              {effective === "avançou" ? "✓ avançou hoje" : effective === "parcial" ? "~ parcial hoje" : effective === "nao" ? "✗ não avançou" : "sem registro hoje"}
                              {streak >= 1 ? ` · 🔥 ${streak} ${streak === 1 ? "dia" : "dias"}` : ""}
                            </p>
                          </div>
                          {isOpen ? <ChevronDown size={16} color="#9e96b5" /> : <ChevronRight size={16} color="#9e96b5" />}
                        </button>

                        {/* Corpo (cascata) */}
                        {isOpen && (
                          <div style={{ padding: "2px 14px 14px", borderTop: "1px solid rgba(167,139,250,0.06)" }}>
                            {/* Porquê */}
                            {goal.why_it_matters ? (
                              <div style={{ padding: "8px 0 6px", borderBottom: "1px solid rgba(167,139,250,0.05)" }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>Por quê</p>
                                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9e96b5", fontStyle: "italic", lineHeight: 1.45 }}>
                                  “{goal.why_it_matters}”
                                </p>
                              </div>
                            ) : null}

                            {/* OKR do trimestre */}
                            <div style={{ padding: "8px 0 6px", borderBottom: "1px solid rgba(167,139,250,0.05)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>
                                  📊 Resultados do trimestre {krPct != null ? `· ${krPct}%` : ""}
                                </p>
                                {krList.length > 0 && (
                                  <button type="button" aria-label="O que é isso?" onClick={() => toggleInfo(`${goal.id}:kr`)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "inline-flex" }}>
                                    <InfoIcon />
                                  </button>
                                )}
                              </div>
                              {krList.length === 0 ? (
                                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_RESULTADOS}</p>
                              ) : (
                                <>
                                  {infoOpen.has(`${goal.id}:kr`) && (
                                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_RESULTADOS}</p>
                                  )}
                                  {krList.map((kr) => {
                                  const pct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
                                  return (
                                    <div key={kr.id} style={{ marginTop: 4 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ flex: 1, fontSize: 11.5, color: "#c9c2e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kr.title}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "#A78BFA", flexShrink: 0 }}>{pct}%</span>
                                      </div>
                                      <div style={{ height: 3, borderRadius: 9999, background: "rgba(167,139,250,0.1)", overflow: "hidden", marginTop: 3 }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: "#7C5CFF", borderRadius: 9999 }} />
                                      </div>
                                    </div>
                                  );
                                  })}
                                </>
                              )}
                            </div>

                            {/* Motor (hábitos recorrentes) */}
                            <div style={{ padding: "8px 0 6px", borderBottom: "1px solid rgba(167,139,250,0.05)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>🔁 Motor (hábitos)</p>
                                {motorList.length > 0 && (
                                  <button type="button" aria-label="O que é isso?" onClick={() => toggleInfo(`${goal.id}:motor`)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "inline-flex" }}>
                                    <InfoIcon />
                                  </button>
                                )}
                              </div>
                              {motorList.length === 0 ? (
                                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_MOTOR}</p>
                              ) : (
                                <>
                                  {infoOpen.has(`${goal.id}:motor`) && (
                                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_MOTOR}</p>
                                  )}
                                  {motorList.slice(0, 4).map((m, i) => (
                                    <p key={i} style={{ margin: "3px 0 0", fontSize: 11.5, color: "#c9c2e0" }}>
                                      🔁 {m.title} <span style={{ color: "#6a657a" }}>· {CADENCE[m.repeat_type] ?? m.repeat_type}</span>
                                    </p>
                                  ))}
                                </>
                              )}
                            </div>

                            {/* Semana atual */}
                            <div style={{ padding: "8px 0 6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>📅 Semana</p>
                                {(wkTasks.length > 0 || wkFocus.length > 0) && (
                                  <button type="button" aria-label="O que é isso?" onClick={() => toggleInfo(`${goal.id}:semana`)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "inline-flex" }}>
                                    <InfoIcon />
                                  </button>
                                )}
                              </div>
                              {wkTasks.length === 0 && wkFocus.length === 0 ? (
                                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_SEMANA}</p>
                              ) : (
                                <>
                                  {infoOpen.has(`${goal.id}:semana`) && (
                                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6a657a", lineHeight: 1.55 }}>{HINT_SEMANA}</p>
                                  )}
                                  {wkFocus.slice(0, 2).map((f, i) => (
                                    <p key={i} style={{ margin: "3px 0 0", fontSize: 11.5, color: "#e0d6ff", fontWeight: 600 }}>🎯 {f}</p>
                                  ))}
                                  {wkTasks.slice(0, 4).map((t) => (
                                    <p key={t.id} style={{ margin: "3px 0 0", fontSize: 11.5, color: t.status === "concluida" ? "#5EEAD4" : "#9e96b5" }}>
                                      {t.status === "concluida" ? "✓" : "○"} {t.title}
                                    </p>
                                  ))}
                                </>
                              )}
                            </div>

                            {/* Ações */}
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button type="button" onClick={() => setDetailGoalId(goal.id)}
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
                                  background: "rgba(124,92,255,0.06)", color: "#A78BFA", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}>
                                Editar meta
                              </button>
                              <button type="button" onClick={() => router.push("/agenda")}
                                style={{
                                  flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
                                  background: "transparent", color: "#9e96b5", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                }}>
                                Ver na agenda
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Concluídas */}
      {completedGoals.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#5a5470" }}>
            Concluídas ({completedGoals.length})
          </p>
          {completedGoals.slice(0, 3).map((goal) => (
            <div key={goal.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12,
              background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.1)", opacity: 0.6, marginBottom: 6,
            }}>
              <span style={{ flex: 1, fontSize: 12, color: "#9e96b5", textDecoration: "line-through" }}>{goal.title}</span>
              <button type="button" onClick={async () => {
                await fetch(`/api/goals/${goal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "arquivada" }) });
                refresh();
              }} style={{ background: "none", border: 0, color: "#5a5470", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>
                Arquivar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Maya */}
      {goals.filter((g) => g.status === "ativa").length > 0 && (
        <button type="button" onClick={talkToMaya}
          style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 14, border: "1px solid rgba(167,139,250,0.15)", background: "rgba(124,92,255,0.06)", cursor: "pointer", color: "#A78BFA", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          💜 Conversar com Maya sobre uma meta
        </button>
      )}

      {/* Maya goal picker */}
      {showMayaPick && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 380, maxHeight: "70dvh", overflowY: "auto", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Qual meta?</h3>
            {goals.filter((g) => g.status === "ativa").map((g) => (
              <button key={g.id} type="button" onClick={() => { setShowMayaPick(false); router.push(`/insights?draft=Quero falar sobre minha meta: ${g.title}`); }}
                style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.15)", background: "#0B0B10", cursor: "pointer", color: "#e0d6ff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginBottom: 8 }}>
                {g.title}
              </button>
            ))}
            <button type="button" onClick={() => setShowMayaPick(false)}
              style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Adicionar visão modal */}
      {showVisionModal && (
        <div onTouchMove={(e) => e.stopPropagation()} style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "85dvh", overflowY: "auto", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e0d6ff" }}>Nova visão</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6a657a" }}>Onde você quer estar em 5 anos?</p>

            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6a657a", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              Área da vida
            </label>
            <select value={visionArea} onChange={(e) => setVisionArea(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }}>
              <option value="" disabled>Escolha uma área…</option>
              {LIFE_AREAS.map((a) => (
                <option key={a} value={a}>{AREA_CONFIG[a as keyof typeof AREA_CONFIG]?.emoji} {AREA_FULL_LABELS[a]}</option>
              ))}
            </select>

            <textarea value={visionDraft} onChange={(e) => setVisionDraft(e.target.value)} rows={6} autoFocus
              placeholder="Descreva sua visão de 5 anos para esta área..."
              style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="button" onClick={() => setShowVisionModal(false)}
                style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button type="button" onClick={saveVision} disabled={savingVision || !visionArea || !visionDraft.trim()}
                style={{ flex: 2, padding: "14px 0", borderRadius: 14, border: 0, background: (!visionArea || !visionDraft.trim()) ? "#1e1840" : "#7C5CFF", color: (!visionArea || !visionDraft.trim()) ? "#9e96b5" : "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: savingVision ? 0.7 : 1 }}>
                Salvar visão
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && <GoalCreateSheet onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {detailGoalId && <GoalDetailSheet goalId={detailGoalId} onClose={() => setDetailGoalId(null)} onUpdated={refresh} />}

      {/* FAB — menu de criação */}
      {fabMenuOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }} onClick={() => setFabMenuOpen(false)}>
          <div style={{ padding: "0 16px 152px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#151520", borderRadius: 22, border: "1px solid rgba(167,139,250,0.15)", overflow: "hidden" }}>
              <button type="button" onClick={() => { setFabMenuOpen(false); setShowCreate(true); }} style={fabItemStyle}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🎯</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>Meta anual</span>
                  <span style={{ display: "block", fontSize: 11, color: "#6a657a" }}>Um objetivo grande para o ano</span>
                </span>
              </button>
              <button type="button" onClick={() => { setFabMenuOpen(false); setVisionArea(""); setVisionDraft(""); setShowVisionModal(true); }} style={fabItemStyle}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🌳</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>Visão 5 anos</span>
                  <span style={{ display: "block", fontSize: 11, color: "#6a657a" }}>Onde você quer estar no futuro</span>
                </span>
              </button>
              <button type="button" onClick={() => { setFabMenuOpen(false); setCycleCreateTrigger((n) => n + 1); }} style={fabItemStyle}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>📊</span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>Resultados do trimestre</span>
                  <span style={{ display: "block", fontSize: 11, color: "#6a657a" }}>Ciclo e resultados mensuráveis</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setFabMenuOpen((v) => !v)}
        style={{
          position: "fixed", bottom: 84, right: 20, zIndex: 60,
          width: 56, height: 56, borderRadius: "50%",
          background: fabMenuOpen ? "#1a1a26" : "#7C5CFF",
          border: fabMenuOpen ? "1px solid rgba(167,139,250,0.3)" : 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
          transition: "transform .15s ease, background .15s ease",
          transform: fabMenuOpen ? "rotate(45deg)" : "rotate(0deg)",
        }}>
        <Plus size={24} color={fabMenuOpen ? "#A78BFA" : "#fff"} />
      </button>
    </div>
  );
}
