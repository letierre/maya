"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/useTranslation";
import { MEDITATION_PRACTICES } from "@/lib/practice-scripts";
import { BreathingCircle } from "@/components/practices/BreathingCircle";
import { photoUrl } from "@/lib/photo-storage";
import { getLocalDate } from "@/lib/utils";

const DURATIONS = [3, 5, 10]; // minutos

const FOREGROUND = "#e0d6ff";
const MUTED = "#9e96b5";
const BORDER = "rgba(167,139,250,0.2)";
const PURPLE = "#7C5CFF";
const LILAC = "#A78BFA";

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function MeditacaoPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();

  const [practiceKey, setPracticeKey] = useState(MEDITATION_PRACTICES[0].key);
  const [durationMin, setDurationMin] = useState(5);
  const [phase, setPhase] = useState<"select" | "running" | "done">("select");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const totalSeconds = durationMin * 60;
  const practice = MEDITATION_PRACTICES.find((p) => p.key === practiceKey) ?? MEDITATION_PRACTICES[0];

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
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
      stopAudio();
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
    [clearTimer, stopAudio, practiceKey, t],
  );

  const start = useCallback(() => {
    finishedRef.current = false;
    setSecondsLeft(totalSeconds);
    setPhase("running");
  }, [totalSeconds]);

  // Voz + cronômetro durante a sessão.
  useEffect(() => {
    if (phase !== "running") return;

    setVoiceLoading(true);
    fetch("/api/practices/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "meditation", pattern: practiceKey, language: lang }),
    })
      .then((r) => r.json())
      .then((d) => {
        const url = photoUrl(d.audioUrl);
        if (url) {
          const a = new Audio(url);
          audioRef.current = a;
          a.play().catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setVoiceLoading(false));

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    return () => {
      clearTimer();
      stopAudio();
    };
  }, [phase, practiceKey, lang, clearTimer, stopAudio]);

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
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
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
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 10 }}>
        <button type="button" onClick={handleBack} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: LILAC }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: FOREGROUND }}>{t(practice.labelKey)}</h1>
          {voiceLoading && <p style={{ margin: 0, fontSize: 11, color: MUTED }}>…</p>}
        </div>
        <button type="button" onClick={() => void finish(totalSeconds - secondsLeft)} style={{ padding: "6px 14px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {t("pr_encerrar")}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 24px" }}>
        <BreathingCircle phases={{ inhale: 4, hold1: 0, exhale: 6, hold2: 0 }} running />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 200, color: FOREGROUND, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{fmtClock(secondsLeft)}</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>{t("md_subtitulo")}</p>
        </div>
      </div>
    </div>
  );
}
