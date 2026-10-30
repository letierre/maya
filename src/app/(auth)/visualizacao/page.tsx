"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { MayaAvatar } from "@/components/MayaAvatar";
import { AMBIENT_OPTIONS, useAmbient, type AmbientKey } from "@/components/practices/useAmbient";
import { usePracticeNarration, type NarrationCue } from "@/components/practices/usePracticeNarration";
import { AREA_CONFIG } from "@/lib/planejamento-constants";
import { safeCachedFetch } from "@/lib/fetch-cache";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";

const DURATIONS = [3, 5, 10]; // minutos

const FOREGROUND = "#e0d6ff";
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.2)";
const PURPLE = "#7C5CFF";
const LILAC = "#A78BFA";

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type GoalOpt = { id: string; title: string; area: string; status: string };

const areaEmoji = (area: string) =>
  (AREA_CONFIG as Record<string, { emoji: string }>)[area]?.emoji ?? "🎯";

export default function VisualizacaoPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();

  const [goals, setGoals] = useState<GoalOpt[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalId, setGoalId] = useState<string>("");
  const [durationMin, setDurationMin] = useState(5);
  const [phase, setPhase] = useState<"select" | "running" | "done">("select");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [ambientKey, setAmbientKey] = useState<AmbientKey>("none");
  const [ambientMuted, setAmbientMuted] = useState(false);

  const { start: startAmbient, stop: stopAmbient, setMuted: setAmbientGain } = useAmbient();
  const { voiceActive, start: startNarration, skip: skipNarration, clearAll: clearNarration } = usePracticeNarration();

  const blocksRef = useRef<NarrationCue[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const totalSeconds = durationMin * 60;
  const activeGoals = goals.filter((g) => g.status === "ativa");
  const selectedGoal = activeGoals.find((g) => g.id === goalId) ?? null;

  // Carrega as metas ativas para escolher a que será visualizada.
  useEffect(() => {
    let cancelled = false;
    safeCachedFetch<GoalOpt[]>("/api/goals").then((data) => {
      if (cancelled) return;
      setGoals(data ?? []);
      setGoalsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const finish = useCallback(
    async (elapsedSeconds: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimer();
      clearNarration();
      stopAmbient();
      setPhase("done");
      try {
        await fetch("/api/practices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "visualization",
            pattern: goalId,
            duration_seconds: Math.max(elapsedSeconds, 1),
            date: getLocalDate(),
          }),
        });
        toast.success(t("vi_concluido"));
      } catch {
        /* silencioso */
      }
    },
    [clearTimer, clearNarration, stopAmbient, goalId, t],
  );

  const start = useCallback(async () => {
    finishedRef.current = false;
    setSecondsLeft(totalSeconds);
    setAmbientMuted(false);
    setPhase("running");
    // Destrava o áudio (iOS) e liga o ambiente, depois inicia a narração em
    // blocos — tudo dentro do gesto de "Começar" (autoplay no iOS exige o play
    // no clique, que o hook faz para o 1º bloco).
    await startAmbient(ambientKey);
    if (blocksRef.current) startNarration(blocksRef.current);
  }, [totalSeconds, startAmbient, ambientKey, startNarration]);

  // Pré-busca a playlist de blocos já na seleção: deixa tudo pronto para tocar
  // dentro do gesto de "Começar" (autoplay no iOS exige o play no clique).
  useEffect(() => {
    blocksRef.current = null;
    if (!goalId) return;
    let cancelled = false;
    fetch("/api/practices/narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "visualization", goal_id: goalId, language: lang, duration_seconds: totalSeconds }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        blocksRef.current = (d.blocks ?? []).map((b: { url: string; atSec: number }) => ({ url: photoUrl(b.url) ?? "", atSec: b.atSec }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goalId, lang, totalSeconds]);

  // Cronômetro da sessão + fallback da narração (caso o prefetch não resolva).
  useEffect(() => {
    if (phase !== "running") return;

    if (!blocksRef.current) {
      setVoiceLoading(true);
      fetch("/api/practices/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "visualization", goal_id: goalId, language: lang, duration_seconds: totalSeconds }),
      })
        .then((r) => r.json())
        .then((d) => {
          const cues: NarrationCue[] = (d.blocks ?? []).map((b: { url: string; atSec: number }) => ({ url: photoUrl(b.url) ?? "", atSec: b.atSec }));
          blocksRef.current = cues;
          startNarration(cues);
        })
        .catch(() => {})
        .finally(() => setVoiceLoading(false));
    }

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      clearTimer();
      clearNarration();
      stopAmbient();
    };
  }, [phase, goalId, lang, totalSeconds, clearTimer, clearNarration, stopAmbient, startNarration]);

  useEffect(() => {
    if (phase === "running" && secondsLeft === 0) {
      void finish(totalSeconds);
    }
  }, [phase, secondsLeft, finish, totalSeconds]);

  const handleBack = () => {
    if (phase === "running") {
      void finish(totalSeconds - secondsLeft);
    } else {
      router.push("/dashboard");
    }
  };

  const reset = () => {
    finishedRef.current = false;
    setSecondsLeft(0);
    setPhase("select");
  };

  // ── Seleção ──────────────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div style={{ minHeight: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column", paddingBottom: "calc(48px + env(safe-area-inset-bottom))" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => router.push("/dashboard")} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: LILAC }}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: FOREGROUND }}>{t("vi_titulo")}</h1>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{t("vi_subtitulo")}</p>
          </div>
        </div>

        <div style={{ padding: "8px 16px", flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, margin: "12px 0 8px" }}>{t("vi_escolha_meta")}</p>

          {goalsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 64, borderRadius: 16, background: "#1a1530", border: `1px solid ${BORDER}` }} />
              ))}
            </div>
          ) : activeGoals.length === 0 ? (
            <div style={{ padding: "24px 16px", borderRadius: 16, background: "#1a1530", border: `1px solid ${BORDER}`, textAlign: "center" }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED }}>{t("vi_sem_metas")}</p>
              <button type="button" onClick={() => router.push("/agenda?tab=metas")} style={{ padding: "12px 20px", borderRadius: 12, border: 0, background: PURPLE, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {t("vi_criar_meta")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activeGoals.map((g) => {
                const selected = g.id === goalId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoalId(g.id)}
                    style={{
                      padding: "16px",
                      borderRadius: 16,
                      border: selected ? `1.5px solid ${PURPLE}` : `1px solid ${BORDER}`,
                      background: selected ? "rgba(124,92,255,0.14)" : "#1a1530",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{areaEmoji(g.area)}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: FOREGROUND }}>{g.title}</span>
                    <span style={{ fontSize: 13, color: selected ? PURPLE : "transparent" }}>●</span>
                  </button>
                );
              })}
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, margin: "20px 0 8px" }}>{t("pr_duracao")}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {DURATIONS.map((d) => {
              const selected = d === durationMin;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationMin(d)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: selected ? `1.5px solid ${PURPLE}` : `1px solid ${BORDER}`,
                    background: selected ? "rgba(124,92,255,0.14)" : "#1a1530",
                    color: selected ? FOREGROUND : MUTED,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {d} min
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, margin: "20px 0 8px" }}>{t("md_ambiente")}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {AMBIENT_OPTIONS.map((a) => {
              const selected = a.key === ambientKey;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAmbientKey(a.key)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: selected ? `1.5px solid ${PURPLE}` : `1px solid ${BORDER}`,
                    background: selected ? "rgba(124,92,255,0.14)" : "#1a1530",
                    color: selected ? FOREGROUND : MUTED,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{a.emoji}</span>
                  {t(a.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0 16px" }}>
          <button
            type="button"
            onClick={start}
            disabled={!goalId}
            style={{
              width: "100%",
              height: 52,
              borderRadius: 14,
              border: 0,
              background: goalId ? PURPLE : "#2a2440",
              color: goalId ? "#fff" : MUTED,
              fontSize: 15,
              fontWeight: 800,
              cursor: goalId ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              boxShadow: goalId ? "0 4px 20px rgba(124,92,255,0.4)" : "none",
            }}
          >
            {t("pr_comecar")}
          </button>
        </div>
      </div>
    );
  }

  // ── Concluído ────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div style={{ height: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(94,234,212,0.12)", border: "1.5px solid #5EEAD4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>✓</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: FOREGROUND, textAlign: "center" }}>{t("vi_concluido")}</h2>
        {selectedGoal && <p style={{ margin: 0, fontSize: 13, color: MUTED, textAlign: "center" }}>{selectedGoal.title}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320, marginTop: 8 }}>
          <button type="button" onClick={reset} style={{ width: "100%", height: 48, borderRadius: 14, border: 0, background: PURPLE, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            {t("pr_comecar")}
          </button>
          <button type="button" onClick={() => router.push("/dashboard")} style={{ width: "100%", height: 48, borderRadius: 14, border: `1px solid ${BORDER}`, background: "transparent", color: FOREGROUND, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t("pr_voltar")}
          </button>
        </div>
      </div>
    );
  }

  // ── Sessão ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
        <button type="button" onClick={handleBack} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: LILAC }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: FOREGROUND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedGoal?.title ?? t("vi_titulo")}
          </h1>
          {voiceLoading && <p style={{ margin: 0, fontSize: 11, color: MUTED }}>…</p>}
        </div>
        {voiceActive && (
          <button type="button" onClick={skipNarration} style={{ padding: "6px 12px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t("pr_pular")}
          </button>
        )}
        {ambientKey !== "none" && (
          <button type="button" onClick={() => setAmbientMuted((m) => { const next = !m; setAmbientGain(next); return next; })} style={{ padding: "6px 12px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 16, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>
            {ambientMuted ? "🔇" : "🔊"}
          </button>
        )}
        <button type="button" onClick={() => void finish(totalSeconds - secondsLeft)} style={{ padding: "6px 14px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {t("pr_encerrar")}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 24px" }}>
        <MayaAvatar state={voiceActive ? "speaking" : "idle"} size={160} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 200, color: FOREGROUND, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{fmtClock(secondsLeft)}</div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>{t("vi_subtitulo")}</p>
        </div>
      </div>
    </div>
  );
}
