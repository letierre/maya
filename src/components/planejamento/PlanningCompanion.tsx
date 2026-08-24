"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Sparkles, Map, Layers, Send, Plus, Check, Loader2,
  ChevronDown, ChevronRight, Compass,
} from "lucide-react";
import { MayaAvatar } from "@/components/MayaAvatar";
import { AREA_CONFIG, LIFE_AREAS, DAY_NAMES } from "@/lib/planejamento-constants";
import type { PlanningCompanionResponse, SuggestedTask, AreaSuggestion, PlanningStoneSuggestion } from "@/types";

// ── Labels & emojis (same as API route) ──────────────────────────────

const AREA_LABELS_LONG: Record<string, string> = {
  saude: "Saúde", carreira: "Carreira", financas: "Finanças",
  relacionamentos: "Relacionamentos", desenvolvimento: "Mente",
  familia: "Família", lazer: "Lazer", espiritualidade: "Espiritualidade",
};

const AREA_EMOJIS: Record<string, string> = {
  saude: "💚", carreira: "💼", financas: "💰",
  relacionamentos: "❤️", desenvolvimento: "🧠",
  familia: "🏡", lazer: "🌊", espiritualidade: "✨",
};

const STONE_COLORS = ["#7C5CFF", "#5EEAD4", "#F59E0B"];
const STONE_EMOJIS = ["💎", "🪨", "🔮"];
const STONE_LABELS = ["I", "II", "III"];

// ── Props ────────────────────────────────────────────────────────────

interface PlanningCompanionProps {
  companionData: PlanningCompanionResponse | null;
  loading: boolean;
  firstName: string;
  stones: (string | null | undefined)[];
  areasWithTasks: string[];
  tasksByArea: (area: string) => any[];
  onRequestCompanion: () => void;
  onSuggestArea: (area: string) => Promise<AreaSuggestion | null>;
  onSendMessage: (text: string, history: { role: "user" | "assistant"; content: string }[]) => Promise<string>;
  onAddTask: (title: string, area: string, dayOfWeek?: number) => Promise<boolean>;
  onSetStone: (rank: number, text: string) => Promise<void>;
  planMetrics: { strongest: string; weakest: string; balance: number; variation: number };
  activeCycle?: import("@/types").QuarterlyCycle | null;
}

type Tab = "overview" | "areas" | "stones";

// ── Component ────────────────────────────────────────────────────────

export function PlanningCompanion({
  companionData,
  loading,
  firstName,
  stones,
  areasWithTasks,
  tasksByArea,
  onRequestCompanion,
  onSuggestArea,
  onSendMessage,
  onAddTask,
  onSetStone,
  planMetrics,
}: PlanningCompanionProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set());
  const [addingTask, setAddingTask] = useState<string | null>(null);
  const [settingStone, setSettingStone] = useState<number | null>(null);
  const [focusSuggestions, setFocusSuggestions] = useState<Record<string, AreaSuggestion>>({});
  const [suggestingArea, setSuggestingArea] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "maya"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  // Identify empty areas
  const emptyAreas = useMemo(
    () => LIFE_AREAS.filter((a) => !areasWithTasks.includes(a)),
    [areasWithTasks],
  );

  // Has Maya responded yet?
  const hasData = companionData !== null;

  // ── Handlers ───────────────────────────────────────────────────

  const handleAddTask = useCallback(
    async (title: string, area: string) => {
      if (addedTasks.has(`${area}:${title}`)) return;
      setAddingTask(`${area}:${title}`);
      const ok = await onAddTask(title, area);
      if (ok) {
        setAddedTasks((prev) => new Set(prev).add(`${area}:${title}`));
      }
      setAddingTask(null);
    },
    [onAddTask, addedTasks],
  );

  const handleSetStone = useCallback(
    async (rank: number, text: string) => {
      setSettingStone(rank);
      await onSetStone(rank, text);
      setSettingStone(null);
    },
    [onSetStone],
  );

  const handleSuggestArea = useCallback(
    async (area: string) => {
      if (suggestingArea) return;
      setSuggestingArea(area);
      const suggestion = await onSuggestArea(area);
      if (suggestion && suggestion.suggestedTasks?.length) {
        setFocusSuggestions((prev) => ({ ...prev, [area]: suggestion }));
      }
      setSuggestingArea(null);
    },
    [onSuggestArea, suggestingArea],
  );

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    const history = chatMessages.map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.text }));
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatSending(true);
    const reply = await onSendMessage(text, history);
    setChatMessages((prev) => [...prev, { role: "maya", text: reply || "Hmm, não consegui responder agora. Tenta de novo?" }]);
    setChatSending(false);
  }, [chatInput, chatSending, chatMessages, onSendMessage]);

  // ── Render: Initial call-to-action ─────────────────────────────

  if (!hasData && !loading) {
    return (
      <div style={{ marginBottom: 20 }}>
        {/* Maya central */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <MayaAvatar state="hero" size={200} />
          <p style={{ margin: "12px 0 6px", fontSize: 16, fontWeight: 700, color: "#e0d6ff", textAlign: "center" }}>
            {firstName ? `${firstName}, vamos planejar sua semana?` : "Vamos planejar sua semana?"}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9e96b5", textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
            Eu analiso seu momento atual — diário, check-ins, metas — e ajudo a pensar na melhor estratégia para esta semana.
          </p>
          <button
            type="button"
            onClick={onRequestCompanion}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 14,
              border: 0,
              background: "linear-gradient(135deg, #7C5CFF, #A78BFA)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 20px rgba(124,92,255,0.35)",
              transition: "transform .15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Compass size={18} />
            Maya, analise meu plano
          </button>
        </div>

        {/* Quick stats */}
        <QuickStats stones={stones} areasWithTasks={areasWithTasks} emptyAreas={emptyAreas} tasksByArea={tasksByArea} />
      </div>
    );
  }

  // ── Render: Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <MayaAvatar state="processing" size={160} />
          <p style={{ margin: "16px 0 0", fontSize: 14, fontWeight: 600, color: "#A78BFA", textAlign: "center" }}>
            {firstName ? `Analisando seu momento, ${firstName}...` : "Analisando seu momento..."}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6a657a", textAlign: "center", maxWidth: 280 }}>
            Estou cruzando seus dados da semana com diário, check-ins e metas ativas.
          </p>
        </div>
        {/* Skeleton cards */}
        <SkeletonCards />
      </div>
    );
  }

  // ── Render: Data loaded ────────────────────────────────────────

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Maya header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
        <div style={{ position: "relative" }}>
          <MayaAvatar state="hero" size={140} />
          {/* Aura glow */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,92,255,0.12) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Greeting */}
        {companionData?.greeting && (
          <p style={{ margin: "12px 0 0", fontSize: 16, fontWeight: 700, color: "#e0d6ff", textAlign: "center", maxWidth: 360, lineHeight: 1.4 }}>
            {companionData.greeting}
          </p>
        )}
      </div>

      {/* Strategic feedback */}
      {companionData?.strategicFeedback && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(124,92,255,0.06) 0%, rgba(94,234,212,0.04) 100%)",
            borderRadius: 16,
            border: "1px solid rgba(124,92,255,0.1)",
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>🧠</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#d0c8e8", lineHeight: 1.55, letterSpacing: "-0.01em" }}>
              {companionData.strategicFeedback}
            </p>
          </div>
        </div>
      )}

      {/* Responder à Maya (resposta direta à pergunta dela) */}
      <div style={{ marginBottom: 16 }}>
        {chatMessages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {chatMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.role === "user" ? "rgba(124,92,255,0.16)" : "#151520",
                  border: m.role === "user" ? "1px solid rgba(124,92,255,0.25)" : "1px solid rgba(167,139,250,0.1)",
                  borderRadius: 14,
                  padding: "10px 12px",
                }}
              >
                <p style={{ margin: 0, fontSize: 12.5, color: m.role === "user" ? "#e0d6ff" : "#d0c8e8", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {m.text}
                </p>
              </div>
            ))}
            {chatSending && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, color: "#6a657a", fontSize: 12 }}>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                Maya está escrevendo...
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
            placeholder="Responda à Maya..."
            style={{
              flex: 1, minWidth: 0, padding: "11px 14px", borderRadius: 12,
              border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10",
              color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleSendChat}
            disabled={chatSending || !chatInput.trim()}
            style={{
              padding: "10px 14px", borderRadius: 12, border: 0, background: "#7C5CFF",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap", opacity: chatSending || !chatInput.trim() ? 0.5 : 1,
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Adicionar tarefa manualmente */}
      <QuickAddTask onAddTask={onAddTask} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {([
          { key: "overview" as const, label: "Visão geral", icon: Map, badge: undefined as number | undefined },
          { key: "areas" as const, label: "Áreas", icon: Layers, badge: companionData?.areaSuggestions?.length as number | undefined },
          { key: "stones" as const, label: "Pedras", icon: Sparkles, badge: companionData?.suggestedStones?.length as number | undefined },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "10px 6px",
              borderRadius: 12,
              border: 0,
              background: activeTab === tab.key ? "rgba(124,92,255,0.1)" : "transparent",
              color: activeTab === tab.key ? "#A78BFA" : "#6a657a",
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s ease",
            }}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  background: "#7C5CFF",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 9999,
                  minWidth: 16,
                  textAlign: "center",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "overview" && (
        <OverviewTab
          companionData={companionData}
          firstName={firstName}
          stones={stones}
          planMetrics={planMetrics}
          areasWithTasks={areasWithTasks}
          emptyAreas={emptyAreas}
          tasksByArea={tasksByArea}
        />
      )}

      {activeTab === "areas" && (
        <AreasTab
          companionData={companionData}
          stones={stones}
          areasWithTasks={areasWithTasks}
          emptyAreas={emptyAreas}
          tasksByArea={tasksByArea}
          addedTasks={addedTasks}
          addingTask={addingTask}
          onAddTask={handleAddTask}
          focusSuggestions={focusSuggestions}
          suggestingArea={suggestingArea}
          onSuggestArea={handleSuggestArea}
        />
      )}

      {activeTab === "stones" && (
        <StonesTab
          companionData={companionData}
          stones={stones}
          settingStone={settingStone}
          onSetStone={handleSetStone}
        />
      )}

      {/* Refresh button */}
      <div style={{ textAlign: "center", marginTop: 20, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onRequestCompanion}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 22px",
            borderRadius: 12,
            border: "1px solid rgba(124,92,255,0.2)",
            background: "rgba(124,92,255,0.04)",
            color: "#A78BFA",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: loading ? 0.5 : 1,
            transition: "all .15s ease",
          }}
        >
          {loading ? (
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Send size={14} />
          )}
          Maya, revise meu plano
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

// ── Quick Add Task (manual input, always available in plan mode) ────────

function QuickAddTask({ onAddTask }: { onAddTask: (title: string, area: string, dayOfWeek?: number) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("saude");
  const [adding, setAdding] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    const ok = await onAddTask(t, area);
    setAdding(false);
    if (ok) setTitle("");
  };

  return (
    <div
      style={{
        background: "#151520",
        borderRadius: 16,
        border: "1px solid rgba(167,139,250,0.1)",
        padding: 14,
        marginBottom: 16,
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#A78BFA", letterSpacing: ".06em", textTransform: "uppercase" }}>
        ➕ Adicionar tarefa
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Nova tarefa..."
          style={{
            flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10,
            border: "1px solid rgba(167,139,250,0.2)", background: "#0B0B10",
            color: "#e0d6ff", fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
        />
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{
            padding: "10px 8px", borderRadius: 10, border: "1px solid rgba(167,139,250,0.2)",
            background: "#0B0B10", color: "#e0d6ff", fontSize: 12, fontFamily: "inherit",
            outline: "none", maxWidth: 130,
          }}
        >
          {LIFE_AREAS.map((a) => (
            <option key={a} value={a}>{AREA_EMOJIS[a] || ""} {AREA_LABELS_LONG[a] || a}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={adding || !title.trim()}
          style={{
            padding: "10px 14px", borderRadius: 10, border: 0, background: "#7C5CFF",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            whiteSpace: "nowrap", opacity: !title.trim() || adding ? 0.5 : 1,
          }}
        >
          {adding ? "..." : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

// ── Quick Stats (shown before first AI response) ────────────────────────

function QuickStats({
  stones,
  areasWithTasks,
  emptyAreas,
  tasksByArea,
}: {
  stones: (string | null | undefined)[];
  areasWithTasks: string[];
  emptyAreas: string[];
  tasksByArea: (area: string) => any[];
}) {
  const totalTasks = LIFE_AREAS.reduce((sum, a) => sum + tasksByArea(a).length, 0);
  const definedStones = stones.filter(Boolean).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
      <StatCard emoji="💎" value={String(definedStones)} label="Pedras" />
      <StatCard emoji="📋" value={String(totalTasks)} label="Tarefas" />
      <StatCard emoji="🌱" value={String(emptyAreas.length)} label="Áreas vazias" />
    </div>
  );
}

function StatCard({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div
      style={{
        background: "#151520",
        borderRadius: 16,
        border: "1px solid rgba(167,139,250,0.08)",
        padding: "14px 10px",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 22, display: "block", marginBottom: 4 }}>{emoji}</span>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e0d6ff", fontFamily: "monospace" }}>
        {value}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: "#6a657a" }}>{label}</p>
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Strategic feedback skeleton */}
      <div
        style={{
          background: "#151520",
          borderRadius: 16,
          border: "1px solid rgba(167,139,250,0.06)",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(124,92,255,0.1)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, width: "100%", borderRadius: 4, background: "rgba(167,139,250,0.06)", marginBottom: 6 }} />
            <div style={{ height: 8, width: "80%", borderRadius: 4, background: "rgba(167,139,250,0.06)", marginBottom: 6 }} />
            <div style={{ height: 8, width: "60%", borderRadius: 4, background: "rgba(167,139,250,0.06)" }} />
          </div>
        </div>
      </div>
      {/* Area cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.06)",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(167,139,250,0.08)" }} />
            <div style={{ height: 10, width: 80, borderRadius: 5, background: "rgba(167,139,250,0.08)" }} />
          </div>
          <div style={{ height: 8, width: "90%", borderRadius: 4, background: "rgba(167,139,250,0.05)", marginBottom: 6 }} />
          <div style={{ height: 8, width: "65%", borderRadius: 4, background: "rgba(167,139,250,0.05)" }} />
        </div>
      ))}
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────

function OverviewTab({
  companionData,
  firstName,
  stones,
  planMetrics,
  areasWithTasks,
  emptyAreas,
  tasksByArea,
}: {
  companionData: PlanningCompanionResponse | null;
  firstName: string;
  stones: (string | null | undefined)[];
  planMetrics: { strongest: string; weakest: string; balance: number; variation: number };
  areasWithTasks: string[];
  emptyAreas: string[];
  tasksByArea: (area: string) => any[];
}) {
  const definedStones = stones.filter(Boolean);
  const totalTasks = LIFE_AREAS.reduce((sum, a) => sum + tasksByArea(a).length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
        <div
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.08)",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 600, color: "#6a657a", letterSpacing: ".04em" }}>
            Tarefas planejadas
          </p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e0d6ff", fontFamily: "monospace" }}>
            {totalTasks}
          </p>
        </div>
        <div
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.08)",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 600, color: "#6a657a", letterSpacing: ".04em" }}>
            Pedras definidas
          </p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e0d6ff", fontFamily: "monospace" }}>
            {definedStones.length}/3
          </p>
        </div>
        <div
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.08)",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 600, color: "#6a657a", letterSpacing: ".04em" }}>
            Áreas vazias
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: emptyAreas.length > 0 ? "#FF9F43" : "#5EEAD4",
              fontFamily: "monospace",
            }}
          >
            {emptyAreas.length}
          </p>
        </div>
        <div
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.08)",
            padding: "14px",
          }}
        >
          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 600, color: "#6a657a", letterSpacing: ".04em" }}>
            Equilíbrio
          </p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e0d6ff", fontFamily: "monospace" }}>
            {planMetrics.balance}%
          </p>
        </div>
      </div>

      {/* Defined stones */}
      {definedStones.length > 0 && (
        <div
          style={{
            background: "#151520",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.08)",
            padding: "16px",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
            Compromisso da semana
          </p>
          {definedStones.map((text, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 0",
                borderTop: i > 0 ? "1px solid rgba(94,234,212,0.06)" : "none",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: `rgba(${i === 0 ? "124,92,255" : i === 1 ? "94,234,212" : "245,158,11"},0.1)`,
                  color: STONE_COLORS[i],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                {STONE_LABELS[i]}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.4, paddingTop: 2 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Maya's analysis highlight */}
      {(companionData?.strategicFeedback || companionData?.areaSuggestions?.length) && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(124,92,255,0.08) 0%, rgba(94,234,212,0.05) 100%)",
            borderRadius: 16,
            border: "1px solid rgba(124,92,255,0.12)",
            padding: "14px 16px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#A78BFA" }}>
            Análise da Maya
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#d0c8e8", lineHeight: 1.55 }}>
            {companionData?.strategicFeedback}
          </p>
          {companionData?.areaSuggestions && companionData.areaSuggestions.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#A78BFA", fontWeight: 600 }}>
              {companionData.areaSuggestions.length} {companionData.areaSuggestions.length === 1 ? "área" : "áreas"} com sugestões na aba Áreas →
            </p>
          )}
        </div>
      )}

      {/* Empty areas callout */}
      {emptyAreas.length > 0 && (
        <div
          style={{
            background: "rgba(255,159,67,0.06)",
            borderRadius: 14,
            border: "1px solid rgba(255,159,67,0.15)",
            padding: "12px 14px",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#FF9F43" }}>
            ⚠️ {emptyAreas.length} {emptyAreas.length === 1 ? "área está" : "áreas estão"} sem tarefas
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#9e96b5", lineHeight: 1.45 }}>
            {emptyAreas.map((a) => `${AREA_EMOJIS[a] || "•"} ${AREA_LABELS_LONG[a] || a}`).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Areas Tab ───────────────────────────────────────────────────────────

function AreasTab({
  companionData,
  stones,
  areasWithTasks,
  emptyAreas,
  tasksByArea,
  addedTasks,
  addingTask,
  onAddTask,
  focusSuggestions,
  suggestingArea,
  onSuggestArea,
}: {
  companionData: PlanningCompanionResponse | null;
  stones: (string | null | undefined)[];
  areasWithTasks: string[];
  emptyAreas: string[];
  tasksByArea: (area: string) => any[];
  addedTasks: Set<string>;
  addingTask: string | null;
  onAddTask: (title: string, area: string) => void;
  focusSuggestions: Record<string, AreaSuggestion>;
  suggestingArea: string | null;
  onSuggestArea: (area: string) => void;
}) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(() => {
    // Auto-expand empty areas and areas with Maya suggestions
    const suggestionAreas =
      companionData?.areaSuggestions?.map((s: AreaSuggestion) => s.area) || [];
    return new Set([...emptyAreas, ...suggestionAreas]);
  });

  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  // Build a map of Maya suggestions by area
  const suggestionByArea = useMemo(() => {
    const map: Record<string, AreaSuggestion> = {};
    companionData?.areaSuggestions?.forEach((s: AreaSuggestion) => {
      map[s.area] = s;
    });
    return map;
  }, [companionData?.areaSuggestions]);

  // Sort areas: empty first, then by task count, then alphabetically
  const sortedAreas = useMemo(() => {
    return [...LIFE_AREAS].sort((a, b) => {
      const aEmpty = emptyAreas.includes(a) ? 0 : 1;
      const bEmpty = emptyAreas.includes(b) ? 0 : 1;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      const aCount = tasksByArea(a).length;
      const bCount = tasksByArea(b).length;
      if (aCount !== bCount) return bCount - aCount;
      return (AREA_LABELS_LONG[a] || a).localeCompare(AREA_LABELS_LONG[b] || b);
    });
  }, [emptyAreas, tasksByArea]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sortedAreas.map((area) => {
        const tasks = tasksByArea(area);
        const doneTasks = tasks.filter((t: any) => t.status === "concluida").length;
        const suggestion = suggestionByArea[area];
        const focused = focusSuggestions[area];
        const effectiveSuggestion = focused ?? suggestion;
        const isSuggesting = suggestingArea === area;
        const isEmpty = tasks.length === 0;
        const isExpanded = expandedAreas.has(area);
        const hue = AREA_CONFIG[area as keyof typeof AREA_CONFIG]?.hue || 200;

        return (
          <div
            key={area}
            style={{
              background: "#151520",
              borderRadius: 16,
              border: isEmpty
                ? "1px solid rgba(255,159,67,0.18)"
                : "1px solid rgba(167,139,250,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => toggleArea(area)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{AREA_EMOJIS[area] || "•"}</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e0d6ff" }}>
                  {AREA_LABELS_LONG[area] || area}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6a657a" }}>
                  {isEmpty
                    ? "Nenhuma tarefa"
                    : `${doneTasks}/${tasks.length} feitas`}
                </p>
              </div>
              {/* Mini gauge */}
              {!isEmpty && (
                <div
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 9999,
                    background: "rgba(167,139,250,0.08)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 9999,
                      width: `${tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0}%`,
                      background: `oklch(0.55 0.13 ${hue})`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              )}
              {isEmpty && <span style={{ fontSize: 10, color: "#FF9F43", fontWeight: 600 }}>Vazia</span>}
              {isExpanded ? (
                <ChevronDown size={14} color="#6a657a" style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRight size={14} color="#6a657a" style={{ flexShrink: 0 }} />
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: "8px 14px 14px", borderTop: "1px solid rgba(167,139,250,0.04)" }}>
                {/* Maya's message for this area */}
                {effectiveSuggestion?.message && (
                  <div
                    style={{
                      background: "rgba(124,92,255,0.06)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 10,
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#A78BFA",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>🧠</span> Maya observou
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "#d0c8e8", lineHeight: 1.5 }}>
                      {effectiveSuggestion.message}
                    </p>
                  </div>
                )}

                {/* Current tasks */}
                {tasks.length > 0 && (
                  <div style={{ marginBottom: effectiveSuggestion ? 10 : 0 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: "#6a657a" }}>
                      Tarefas atuais
                    </p>
                    {tasks.map((task: any) => (
                      <div
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 0",
                          fontSize: 12,
                          color: task.status === "concluida" ? "#5a5470" : "#9e96b5",
                          textDecoration: task.status === "concluida" ? "line-through" : "none",
                        }}
                      >
                        {task.status === "concluida" ? (
                          <Check size={12} color="#7C5CFF" style={{ flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: task.task_type === "manutencao" ? "50%" : 3,
                              border: "1.5px solid rgba(167,139,250,0.3)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ flex: 1 }}>{task.title}</span>
                        {task.day_of_week != null && (
                          <span style={{ fontSize: 9, color: "#5a5470", flexShrink: 0 }}>
                            {DAY_NAMES[task.day_of_week]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Maya's suggested tasks */}
                {effectiveSuggestion?.suggestedTasks && effectiveSuggestion.suggestedTasks.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, color: "#A78BFA" }}>
                      Sugestões da Maya
                    </p>
                    {effectiveSuggestion.suggestedTasks.map((st: SuggestedTask, i: number) => {
                      const key = `${area}:${st.title}`;
                      const alreadyAdded = addedTasks.has(key);
                      const isAdding = addingTask === key;
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 0",
                            borderTop: i > 0 ? "1px solid rgba(167,139,250,0.04)" : "none",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: st.taskType === "crescimento" ? "#5EEAD4" : "#A78BFA",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "#e0d6ff" }}>
                            {st.title}
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              color: st.taskType === "crescimento" ? "#5EEAD4" : "#A78BFA",
                              background:
                                st.taskType === "crescimento"
                                  ? "rgba(94,234,212,0.1)"
                                  : "rgba(124,92,255,0.1)",
                              padding: "2px 6px",
                              borderRadius: 9999,
                              flexShrink: 0,
                            }}
                          >
                            {st.taskType === "crescimento" ? "Crescer" : "Hábito"}
                          </span>
                          <button
                            type="button"
                            onClick={() => onAddTask(st.title, area)}
                            disabled={alreadyAdded || isAdding}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              border: 0,
                              background: alreadyAdded
                                ? "rgba(94,234,212,0.15)"
                                : "rgba(124,92,255,0.12)",
                              color: alreadyAdded ? "#5EEAD4" : "#A78BFA",
                              cursor: alreadyAdded ? "default" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all .15s ease",
                            }}
                          >
                            {alreadyAdded ? (
                              <Check size={12} />
                            ) : isAdding ? (
                              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                            ) : (
                              <Plus size={12} />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Suggest button — any area without suggestions yet */}
                {!effectiveSuggestion?.suggestedTasks?.length && (
                  <button
                    type="button"
                    onClick={() => onSuggestArea(area)}
                    disabled={isSuggesting}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px dashed rgba(124,92,255,0.35)",
                      background: "rgba(124,92,255,0.04)",
                      color: "#A78BFA",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isSuggesting ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: isSuggesting ? 0.6 : 1,
                      transition: "all .15s ease",
                    }}
                  >
                    {isSuggesting ? (
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {isSuggesting ? "Maya pensando..." : "Maya, sugira tarefas para esta área"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Stones Tab ───────────────────────────────────────────────────────────

function StonesTab({
  companionData,
  stones,
  settingStone,
  onSetStone,
}: {
  companionData: PlanningCompanionResponse | null;
  stones: (string | null | undefined)[];
  settingStone: number | null;
  onSetStone: (rank: number, text: string) => void;
}) {
  const suggestions = companionData?.suggestedStones || [];

  // Map suggestions to ranks
  const suggestionMap = useMemo(() => {
    const map: Record<number, PlanningStoneSuggestion> = {};
    suggestions.forEach((s: PlanningStoneSuggestion) => {
      map[s.rank] = s;
    });
    return map;
  }, [suggestions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => {
        const rank = i + 1;
        const currentText = stones[i] || null;
        const suggestion = suggestionMap[rank];
        const isSetting = settingStone === rank;

        return (
          <div
            key={rank}
            style={{
              background: "linear-gradient(135deg, #1a1530 0%, rgba(124,92,255,0.06) 100%)",
              borderRadius: 18,
              border: `1px solid ${STONE_COLORS[i]}22`,
              padding: "16px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Rank badge */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 14,
                fontSize: 32,
                fontWeight: 800,
                color: STONE_COLORS[i],
                opacity: 0.2,
                fontFamily: "monospace",
                lineHeight: 1,
              }}
            >
              {STONE_LABELS[i]}
            </div>

            {/* Current stone or empty */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{STONE_EMOJIS[i]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#6a657a", letterSpacing: ".06em", textTransform: "uppercase" }}>
                  Pedra {STONE_LABELS[i]}
                </p>
                {currentText ? (
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e0d6ff", lineHeight: 1.3 }}>
                    {currentText}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "#5a5470", fontStyle: "italic" }}>
                    Não definida
                  </p>
                )}
              </div>
            </div>

            {/* Maya's suggestion for this stone */}
            {suggestion && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(124,92,255,0.08)",
                  border: "1px solid rgba(124,92,255,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>🧠</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#A78BFA" }}>
                    Maya sugere
                  </span>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#e0d6ff", lineHeight: 1.4 }}>
                  {suggestion.text}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6a657a", lineHeight: 1.4 }}>
                  {suggestion.rationale}
                </p>
                <button
                  type="button"
                  onClick={() => onSetStone(rank, suggestion.text)}
                  disabled={isSetting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
                    borderRadius: 10,
                    border: 0,
                    background: isSetting
                      ? "rgba(124,92,255,0.3)"
                      : "rgba(124,92,255,0.15)",
                    color: "#A78BFA",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: isSetting ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    transition: "all .15s ease",
                  }}
                >
                  {isSetting ? (
                    <>
                      <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                      Definindo...
                    </>
                  ) : currentText ? (
                    <>
                      <Send size={11} />
                      Substituir minha pedra
                    </>
                  ) : (
                    <>
                      <Plus size={11} />
                      Usar esta pedra
                    </>
                  )}
                </button>
              </div>
            )}

            {/* No suggestion — generic hint */}
            {!suggestion && !currentText && (
              <p style={{ margin: "12px 0 0", fontSize: 11, color: "#5a5470" }}>
                ✨ Defina um foco principal para guiar sua semana.
              </p>
            )}

            {/* Has stone but no matching suggestion */}
            {!suggestion && currentText && (
              <p style={{ margin: "10px 0 0", fontSize: 10, color: "#5a5470" }}>
                ✅ Sua pedra está definida.
              </p>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
