"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Shield, Trophy, AlertOctagon, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/useTranslation";
import { MayaAvatar } from "@/components/MayaAvatar";

const AREA_CONFIG: Record<string, { emoji: string; hue: number }> = {
  saude: { emoji: "💚", hue: 160 }, carreira: { emoji: "💼", hue: 220 },
  financas: { emoji: "💰", hue: 85 }, relacionamentos: { emoji: "❤️", hue: 15 },
  desenvolvimento: { emoji: "🧠", hue: 270 }, familia: { emoji: "🏡", hue: 40 },
  lazer: { emoji: "🌊", hue: 185 }, espiritualidade: { emoji: "✨", hue: 300 },
};

const inputS: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px",
  borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)",
  background: "#0B0B10", color: "#e0d6ff", fontSize: 14,
  fontFamily: "inherit", outline: "none",
};

export function GoalDetailSheet({ goalId, onClose, onUpdated }: { goalId: string; onClose: () => void; onUpdated: () => void }) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [addingActions, setAddingActions] = useState<Record<string, string>>({});

  // Modo edição (título, porquê, guardião, recompensa, punição + renomear etapas/ações)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftWhy, setDraftWhy] = useState("");
  const [draftGuardian, setDraftGuardian] = useState("");
  const [draftReward, setDraftReward] = useState("");
  const [draftPunishment, setDraftPunishment] = useState("");
  const [draftStages, setDraftStages] = useState<{ id: string; title: string }[]>([]);
  const [draftActions, setDraftActions] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "stage" | "action"; id: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals/${goalId}`);
    if (res.ok) setGoal(await res.json());
    setLoading(false);
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  const toggleStage = async (stageId: string, current: string) => {
    const next = current === "concluida" ? "pendente" : "concluida";
    setGoal((prev: any) => ({
      ...prev,
      goal_stages: prev.goal_stages.map((s: any) => s.id === stageId ? { ...s, status: next } : s),
    }));
    await fetch(`/api/goals/${goalId}/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    onUpdated();
  };

  const toggleAction = async (actionId: string, current: string) => {
    const next = current === "concluida" ? "pendente" : "concluida";
    setGoal((prev: any) => ({
      ...prev,
      goal_stages: prev.goal_stages.map((s: any) => ({
        ...s, goal_actions: s.goal_actions?.map((a: any) => a.id === actionId ? { ...a, status: next } : a),
      })),
    }));
    await fetch(`/api/goals/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const addStage = async () => {
    if (!newStageTitle.trim()) return;
    const res = await fetch(`/api/goals/${goalId}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newStageTitle.trim() }),
    });
    if (res.ok) { setNewStageTitle(""); setAddingStage(false); load(); onUpdated(); }
  };

  const addAction = async (stageId: string) => {
    const title = addingActions[stageId]?.trim();
    if (!title) return;
    const res = await fetch(`/api/goals/${goalId}/stages/${stageId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) { setAddingActions(prev => { const n = { ...prev }; delete n[stageId]; return n; }); load(); }
  };

  const startEdit = () => {
    if (!goal) return;
    setDraftTitle(goal.title || "");
    setDraftWhy(goal.why_it_matters || "");
    setDraftGuardian(goal.guardian_name || "");
    setDraftReward(goal.reward || "");
    setDraftPunishment(goal.punishment || "");
    setDraftStages((goal.goal_stages || []).map((s: any) => ({ id: s.id, title: s.title || "" })));
    const acts: Record<string, string> = {};
    for (const s of goal.goal_stages || []) for (const a of s.goal_actions || []) acts[a.id] = a.title || "";
    setDraftActions(acts);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!draftTitle.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          why_it_matters: draftWhy.trim() || null,
          guardian_name: draftGuardian.trim() || null,
          reward: draftReward.trim() || null,
          punishment: draftPunishment.trim() || null,
        }),
      });

      // Renomeia etapas alteradas
      const stages = goal.goal_stages || [];
      for (const ds of draftStages) {
        const orig = stages.find((s: any) => s.id === ds.id);
        if (orig && orig.title !== ds.title.trim()) {
          await fetch(`/api/goals/${goalId}/stages/${ds.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: ds.title.trim() }),
          });
        }
      }

      // Renomeia ações (sub-etapas) alteradas
      for (const s of stages) {
        for (const a of s.goal_actions || []) {
          const nt = (draftActions[a.id] ?? "").trim();
          if (nt && nt !== a.title) {
            await fetch(`/api/goals/actions/${a.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: nt }),
            });
          }
        }
      }

      setEditing(false);
      await load();
      onUpdated();
      toast.success(t("goal_salva"));
    } catch {}
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, id } = deleteTarget;
    try {
      if (kind === "stage") {
        await fetch(`/api/goals/${goalId}/stages/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/goals/actions/${id}`, { method: "DELETE" });
      }
      setDeleteTarget(null);
      await load();
      onUpdated();
    } catch {}
  };

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#9e96b5" }}>{t("carregando")}</p>
    </div>
  );

  if (!goal) return null;

  const area = AREA_CONFIG[goal.area] || { emoji: "🎯", hue: 270 };
  const totalStages = goal.goal_stages?.length || 0;
  const doneStages = goal.goal_stages?.filter((s: any) => s.status === "concluida").length || 0;
  const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, maxHeight: "85dvh", overflowY: "auto", background: "#151520", borderRadius: 24, padding: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>{area.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder={t("goal_titulo_meta")} autoFocus
                style={{ ...inputS, fontSize: 16, fontWeight: 700 }} />
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e0d6ff" }}>{goal.title}</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9e96b5" }}>{goal.type === "destino" ? "🎯" : "🧭"} {t(goal.type === "destino" ? "goal_destino" : "goal_direcao")}</p>
              </>
            )}
          </div>
          {!editing && (
            <button type="button" onClick={startEdit} title={t("editar")}
              style={{ background: "none", border: 0, color: "#A78BFA", cursor: "pointer", padding: 4, display: "inline-flex", flexShrink: 0 }}>
              <Pencil size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} style={{ background: "none", border: 0, color: "#9e96b5", fontSize: 18, cursor: "pointer", padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {editing ? (
          <>
            {/* Porquê */}
            <textarea value={draftWhy} onChange={e => setDraftWhy(e.target.value)} rows={2} placeholder={t("goal_porque_importa")}
              style={{ ...inputS, resize: "none", height: 60, marginBottom: 8 }} />
            {/* Guardião / Recompensa / Punição */}
            <input value={draftGuardian} onChange={e => setDraftGuardian(e.target.value)} placeholder={t("goal_guardiao")} style={{ ...inputS, marginBottom: 8 }} />
            <input value={draftReward} onChange={e => setDraftReward(e.target.value)} placeholder={t("goal_recompensa")} style={{ ...inputS, marginBottom: 8 }} />
            <input value={draftPunishment} onChange={e => setDraftPunishment(e.target.value)} placeholder={t("goal_punicao")} style={inputS} />
          </>
        ) : (
          <>
            {goal.why_it_matters && (
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9e96b5", fontStyle: "italic", lineHeight: 1.4 }}>
                "{goal.why_it_matters}"
              </p>
            )}

            {/* Commit chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {goal.guardian_name && (
                <span style={{ padding: "4px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 600, background: "rgba(167,139,250,0.1)", color: "#A78BFA", display: "flex", alignItems: "center", gap: 4 }}>
                  <Shield size={10} /> {goal.guardian_name}
                </span>
              )}
              {goal.reward && (
                <span style={{ padding: "4px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 600, background: "rgba(34,197,94,0.1)", color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
                  <Trophy size={10} /> {goal.reward}
                </span>
              )}
              {goal.punishment && (
                <span style={{ padding: "4px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 600, background: "rgba(255,92,92,0.1)", color: "#FF5C5C", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertOctagon size={10} /> {goal.punishment}
                </span>
              )}
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#9e96b5" }}>{t("goal_x_etapas", { done: String(doneStages), total: String(totalStages) })}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#A78BFA" }}>{pct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 9999, background: "rgba(167,139,250,0.1)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#7C5CFF", borderRadius: 9999, transition: "width .3s" }} />
              </div>
            </div>
          </>
        )}

        {/* Stages */}
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#A78BFA", margin: "0 0 10px" }}>
          {t("goal_etapas")}
        </p>
        {goal.goal_stages?.map((stage: any, i: number) => {
          const done = stage.status === "concluida";
          const actions = stage.goal_actions || [];
          const showAddAction = addingActions[stage.id] !== undefined;
          const stageDraft = draftStages.find(ds => ds.id === stage.id);

          return (
            <div key={stage.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => !editing && toggleStage(stage.id, stage.status)}
                  style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    border: done ? "none" : "2px solid rgba(167,139,250,0.3)",
                    background: done ? "#7C5CFF" : "transparent", cursor: editing ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {done && <CheckCircle2 size={14} color="#fff" />}
                </button>

                {editing ? (
                  <>
                    <input value={stageDraft?.title ?? ""} onChange={e => setDraftStages(prev => prev.map(ds => ds.id === stage.id ? { ...ds, title: e.target.value } : ds))}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
                    <button type="button" onClick={() => setDeleteTarget({ kind: "stage", id: stage.id })} title={t("deletar")}
                      style={{ background: "none", border: 0, color: "#FF5C5C", cursor: "pointer", padding: 2, flexShrink: 0, display: "inline-flex" }}>
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: done ? "#5a5470" : "#e0d6ff", textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {stage.title}
                  </span>
                )}
              </div>

              {/* Actions (sub-etapas) */}
              {actions.map((action: any) => (
                <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 34, marginTop: 4 }}>
                  <button type="button" onClick={() => !editing && toggleAction(action.id, action.status)}
                    style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: action.status === "concluida" ? "none" : "1.5px solid rgba(167,139,250,0.2)",
                      background: action.status === "concluida" ? "#7C5CFF" : "transparent", cursor: editing ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {action.status === "concluida" && <CheckCircle2 size={10} color="#fff" />}
                  </button>
                  {editing ? (
                    <>
                      <input value={draftActions[action.id] ?? ""} onChange={e => setDraftActions(prev => ({ ...prev, [action.id]: e.target.value }))}
                        style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#9e96b5", fontSize: 11, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
                      <button type="button" onClick={() => setDeleteTarget({ kind: "action", id: action.id })} title={t("deletar")}
                        style={{ background: "none", border: 0, color: "#FF5C5C", cursor: "pointer", padding: 2, flexShrink: 0, display: "inline-flex" }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: action.status === "concluida" ? "#5a5470" : "#9e96b5", textDecoration: action.status === "concluida" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {action.title}
                    </span>
                  )}
                </div>
              ))}

              {/* Add action (sub-etapa) */}
              {!editing && (showAddAction ? (
                <div style={{ marginLeft: 34, marginTop: 6, display: "flex", gap: 6 }}>
                  <input value={addingActions[stage.id]} onChange={e => setAddingActions(prev => ({ ...prev, [stage.id]: e.target.value }))}
                    placeholder={t("goal_nova_acao")} autoFocus
                    onKeyDown={e => { if (e.key === "Enter") addAction(stage.id); }}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  <button type="button" onClick={() => addAction(stage.id)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>OK</button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingActions(prev => ({ ...prev, [stage.id]: "" }))}
                  style={{ marginLeft: 34, marginTop: 6, background: "none", border: 0, padding: 0, color: "#9e96b5", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("goal_adicionar_acao")}
                </button>
              ))}
            </div>
          );
        })}

        {/* Add stage */}
        {!editing && (addingStage ? (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={newStageTitle} onChange={e => setNewStageTitle(e.target.value)}
              placeholder={t("goal_nova_etapa")} autoFocus
              onKeyDown={e => { if (e.key === "Enter") addStage(); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10", color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button type="button" onClick={addStage}
              style={{ padding: "8px 12px", borderRadius: 10, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>OK</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingStage(true)}
            style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1px dashed rgba(167,139,250,0.2)", background: "transparent", cursor: "pointer", color: "#A78BFA", fontSize: 12, fontWeight: 600, fontFamily: "inherit", marginTop: 8 }}>
            {t("goal_adicionar_etapa")}
          </button>
        ))}

        {/* Save / Cancel (edit mode) */}
        {editing && (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={() => setEditing(false)}
              style={{ flex: 1, padding: "13px 0", borderRadius: 14, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {t("cancelar")}
            </button>
            <button type="button" onClick={saveEdit} disabled={saving || !draftTitle.trim()}
              style={{ flex: 2, padding: "13px 0", borderRadius: 14, border: 0, background: draftTitle.trim() ? "#7C5CFF" : "#1e1840", color: draftTitle.trim() ? "#fff" : "#9e96b5", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
              {saving ? "…" : t("salvar")}
            </button>
          </div>
        )}

        {deleteTarget && (
          <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ width: "100%", maxWidth: 320, background: "#1a1530", borderRadius: 20, padding: 24, border: "1px solid rgba(167,139,250,0.25)", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <MayaAvatar state="mini" size={40} />
              </div>
              <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.5 }}>
                {deleteTarget.kind === "stage" ? t("goal_excluir_etapa_confirm") : t("goal_excluir_acao_confirm")}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setDeleteTarget(null)}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#9e96b5", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("cancelar")}
                </button>
                <button type="button" onClick={confirmDelete}
                  style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: 0, background: "#FF5C5C", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("deletar")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
