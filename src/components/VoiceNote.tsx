"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";
import { MessageTicks } from "@/components/MessageTicks";

function formatDuration(s: number): string {
  if (!isFinite(s) || s < 0 || s > 36000) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const WAVE_BARS = 34;

/** Gera um "waveform" determinístico (sempre igual p/ o mesmo path), suavizado
 *  p/ parecer uma onda natural. Como não temos a amplitude real do áudio sem
 *  decodificar, usamos ruído com seed — cada áudio tem um visual único. */
function seededWaveform(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const raw: number[] = [];
  for (let i = 0; i < count; i++) raw.push(0.25 + rand() * 0.75);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(count - 1, i + 1)];
    out.push((a + b * 2 + c) / 4);
  }
  return out;
}

/**
 * Nota de voz (estilo WhatsApp): play/pause + waveform de barras + contador.
 * - Contador: mostra o TOTAL quando parado no início; o decorrido ao tocar/pausar.
 * - Barras preenchem da ESQUERDA → DIREITA conforme o tempo; uma bolinha marca a
 *   posição atual e acompanha o arrasto do dedo (seek).
 * - Largura FIXA (abrir/fechar transcrição não muda o tamanho).
 * - `duration` é uma duração conhecida (fallback): o webm do MediaRecorder não
 *   grava a duração no header (`audio.duration === Infinity`), então usamos a
 *   duração cronometrada na gravação p/ mostrar o total e permitir o seek.
 * - `loading` exibe o esqueleto da nota de voz enquanto o áudio processa.
 */
export function VoiceNote({
  path,
  transcript,
  variant = "assistant",
  loading = false,
  duration: knownDuration,
  time,
  status,
}: {
  path?: string | null;
  transcript?: string;
  variant?: "assistant" | "user";
  loading?: boolean;
  duration?: number | null;
  time?: string;
  status?: "sent" | "delivered" | "read";
}) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const src = path ? (photoUrl(path) ?? undefined) : undefined;
  const accent = variant === "user" ? "#FFFFFF" : "#A78BFA";
  const unfilled = variant === "user" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.16)";
  const textColor = variant === "user" ? "rgba(255,255,255,0.92)" : "rgba(216,210,231,0.92)";
  const metaColor = variant === "user" ? "rgba(255,255,255,0.72)" : "rgba(216,210,231,0.45)";

  const waveform = useMemo(() => seededWaveform(path ?? "maya-voice", WAVE_BARS), [path]);

  // Duração total confiável: prefere a do <audio> (se finita), senão a conhecida.
  const total = duration ?? knownDuration ?? 0;

  // Total quando parado no início; decorrido quando tocando/pausado no meio.
  const displayTime = playing || currentTime > 0 ? currentTime : total;

  const resolvedDuration = () => {
    const ad = audioRef.current?.duration ?? 0;
    if (Number.isFinite(ad) && ad > 0) return ad;
    if (duration != null && Number.isFinite(duration) && duration > 0) return duration;
    if (knownDuration != null && Number.isFinite(knownDuration) && knownDuration > 0) return knownDuration;
    return 0;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || loading) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };

  // Arrasta/desliza nas barras → pula para aquele ponto do áudio.
  const seekTo = (clientX: number) => {
    const a = audioRef.current;
    const el = waveRef.current;
    if (!a || !el || loading) return;
    const dur = resolvedDuration();
    if (dur <= 0) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    a.currentTime = frac * dur;
    setCurrentTime(frac * dur);
    setProgress(frac);
  };

  return (
    <div style={{ width: 288, maxWidth: "82vw" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pausar" : "Ouvir"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: 0,
            cursor: loading ? "default" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: variant === "user" ? "rgba(255,255,255,0.22)" : "rgba(167,139,250,0.18)",
            color: accent,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" style={{ marginLeft: 2 }} />}
        </button>

        {/* Waveform — preenche da esquerda p/ direita + bolinha de posição */}
        <div
          ref={waveRef}
          className={loading ? "animate-pulse" : undefined}
          onPointerDown={(e) => {
            if (loading) return;
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) seekTo(e.clientX);
          }}
          onPointerUp={() => (draggingRef.current = false)}
          onPointerCancel={() => (draggingRef.current = false)}
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 28,
            cursor: loading ? "default" : "pointer",
            touchAction: "none",
          }}
        >
          {waveform.map((h, i) => {
            const fullH = Math.max(3, h * 24);
            const fill = Math.max(0, Math.min(1, progress * WAVE_BARS - i));
            return (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: fullH,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 1.5,
                  background: unfilled,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${fill * 100}%`,
                    background: accent,
                  }}
                />
              </span>
            );
          })}

          {/* Bolinha que marca a posição atual (segue o arrasto) */}
          {!loading && (
            <span
              style={{
                position: "absolute",
                left: `${progress * 100}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#FFFFFF",
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        <span
          style={{
            fontSize: 11.5,
            fontVariantNumeric: "tabular-nums",
            color: variant === "user" ? "rgba(255,255,255,0.85)" : "rgba(216,210,231,0.7)",
            flexShrink: 0,
          }}
        >
          {formatDuration(displayTime)}
        </span>
      </div>

      {/* Transcrição (colapsável) + hora da mensagem na MESMA linha */}
      {(transcript || time) && (
        <div
          style={{
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minHeight: 15,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {transcript ? (
              <button
                type="button"
                onClick={() => setTranscriptOpen((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  border: 0,
                  cursor: "pointer",
                  background: "transparent",
                  padding: 0,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: variant === "user" ? "rgba(255,255,255,0.8)" : "rgba(167,139,250,0.9)",
                }}
              >
                {t("maya_voice_transcript")}
                {transcriptOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            ) : null}
          </div>
          {time && (
            <span
              className="whitespace-nowrap"
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                lineHeight: 1,
                color: metaColor,
              }}
            >
              {time}
              {status && <MessageTicks status={status} />}
            </span>
          )}
        </div>
      )}

      {transcriptOpen && transcript ? (
        <div
          style={{
            marginTop: 5,
            whiteSpace: "pre-line",
            fontSize: 13.5,
            lineHeight: 1.45,
            color: textColor,
            opacity: 0.9,
          }}
        >
          {transcript}
        </div>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
          else if (knownDuration != null && Number.isFinite(knownDuration) && knownDuration > 0) setDuration(knownDuration);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          const d = resolvedDuration();
          setCurrentTime(Number.isFinite(t) && t >= 0 ? t : 0);
          setProgress(d > 0 ? t / d : 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(total);
          setProgress(1);
        }}
      />
    </div>
  );
}
