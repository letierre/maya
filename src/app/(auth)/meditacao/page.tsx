"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { MEDITATION_PRACTICES } from "@/lib/practice-scripts";
import { BreathingCircle, type BreathPhase } from "@/components/practices/BreathingCircle";
import { AMBIENT_OPTIONS, useAmbient, type AmbientKey } from "@/components/practices/useAmbient";
import { usePracticeNarration, type NarrationCue } from "@/components/practices/usePracticeNarration";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";

const DURATIONS = [3, 5, 10]; // minutos

const FOREGROUND = "#e0d6ff";
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.2)";
const PURPLE = "#7C5CFF";
const LILAC = "#A78BFA";

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const phaseLabelKey = (p: BreathPhase): string =>
  p === "inhale" ? "rb_inspire" : p === "exhale" ? "rb_expire" : "rb_segure";

export default function MeditacaoPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();

  const [practiceKey, setPracticeKey] = useState(MEDITATION_PRACTICES[0].key);
  const [durationMin, setDurationMin] = useState(5);
  const [ambientKey, setAmbientKey] = useState<AmbientKey>("none");
  const [ambientMuted, setAmbientMuted] = useState(false);
  const [phase, setPhase] = useState<"select" | "running" | "done">("select");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>("inhale");

  const { start: startAmbient, stop: stopAmbient, setMuted: setAmbientGain } = useAmbient();
  const { voiceActive, start: startNarration, skip: skipNarration, clearAll: clearNarration } = usePracticeNarration();

  const blocksRef = useRef<NarrationCue[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const totalSeconds = durationMin * 60;
  const practice = MEDITATION_PRACTICES.find((p) => p.key === practiceKey) ?? MEDITATION_PRACTICES[0];

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handlePhase = useCallback((p: BreathPhase) => setBreathPhase(p), []);

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
            kind: "meditation",
            pattern: practiceKey,
            duration_seconds: Math.max(elapsedSeconds, 1),
            date: getLocalDate(),
          }),
        });
        toast.success(t("pr_concluido"));
      } catch {
        /* silencioso — a prática fica registrada no próximo check-in */
      }
    },
    [clearTimer, clearNarration, stopAmbient, practiceKey, t],
  );

  const start = useCallback(async () => {
    finishedRef.current = false;
    setSecondsLeft(totalSeconds);
    setAmbientMuted(false);
    setBreathPhase("inhale");
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
    let cancelled = false;
    fetch("/api/practices/narration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "meditation", pattern: practiceKey, language: lang, duration_seconds: totalSeconds }),
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
  }, [practiceKey, lang, totalSeconds]);

  // Cronômetro da sessão + fallback da narração (caso o prefetch não resolva).
  useEffect(() => {
    if (phase !== "running") return;

    if (!blocksRef.current) {
      setVoiceLoading(true);
      fetch("/api/practices/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "meditation", pattern: practiceKey, language: lang, duration_seconds: totalSeconds }),
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
  }, [phase, practiceKey, lang, totalSeconds, clearTimer, clearNarration, stopAmbient, startNarration]);

  // Conclusão ao zerar o cronômetro.
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
        <div style={{ padding: "22px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => router.push("/dashboard")} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: LILAC }}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: FOREGROUND }}>{t("md_titulo")}</h1>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{t("md_subtitulo")}</p>
          </div>
        </div>

        <div style={{ padding: "8px 16px", flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, margin: "12px 0 8px" }}>{t("md_escolha")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MEDITATION_PRACTICES.map((p) => {
              const selected = p.key === practiceKey;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPracticeKey(p.key)}
                  style={{
                    padding: "16px 14px",
                    borderRadius: 16,
                    border: selected ? `1.5px solid ${PURPLE}` : `1px solid ${BORDER}`,
                    background: selected ? "rgba(124,92,255,0.14)" : "#1a1530",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "flex-start",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{p.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: FOREGROUND, lineHeight: 1.25 }}>{t(p.labelKey)}</span>
                </button>
              );
            })}
          </div>

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
            style={{
              width: "100%",
              height: 52,
              borderRadius: 14,
              border: 0,
              background: PURPLE,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 20px rgba(124,92,255,0.4)",
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: FOREGROUND, textAlign: "center" }}>{t("pr_concluido")}</h2>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, textAlign: "center" }}>{t("md_subtitulo")}</p>
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
      <div style={{ padding: "22px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
        <button type="button" onClick={handleBack} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: LILAC }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: FOREGROUND }}>{t(practice.labelKey)}</h1>
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
        <BreathingCircle phases={{ inhale: 4, hold1: 0, exhale: 6, hold2: 0 }} running onPhase={handlePhase} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: LILAC }}>{t(phaseLabelKey(breathPhase))}</div>
          <div style={{ fontSize: 40, fontWeight: 200, color: FOREGROUND, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", marginTop: 4 }}>{fmtClock(secondsLeft)}</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>{t(practice.guideKey)}</p>
        </div>
      </div>
    </div>
  );
}
