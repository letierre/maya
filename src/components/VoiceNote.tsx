"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";
import { useTranslation } from "@/lib/useTranslation";

function formatDuration(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
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
 * - Contador mostra o tempo decorrido (segue o áudio).
 * - Barras preenchem GRADUALMENTE (de baixo p/ cima) conforme o tempo avança.
 * - Arrastar o dedo nas barras retrocede/avança para aquele segundo.
 * - Largura FIXA (abrir/fechar transcrição não muda o tamanho).
 */
export function VoiceNote({
  path,
  transcript,
  variant = "assistant",
}: {
  path: string;
  transcript?: string;
  variant?: "assistant" | "user";
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

  const src = photoUrl(path) ?? undefined;
  const accent = variant === "user" ? "#FFFFFF" : "#A78BFA";
  const unfilled = variant === "user" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.16)";
  const textColor = variant === "user" ? "rgba(255,255,255,0.92)" : "rgba(216,210,231,0.92)";

  const waveform = useMemo(() => seededWaveform(path, WAVE_BARS), [path]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };

  // Arrasta/desliza nas barras → pula para aquele ponto do áudio.
  const seekTo = (clientX: number) => {
    const a = audioRef.current;
    const el = waveRef.current;
    if (!a || !el) return;
    const dur = a.duration || duration || 0;
    if (!dur) return;
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
          aria-label={playing ? "Pausar" : "Ouvir"}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: 0,
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: variant === "user" ? "rgba(255,255,255,0.22)" : "rgba(167,139,250,0.18)",
            color: accent,
          }}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" style={{ marginLeft: 2 }} />}
        </button>

        {/* Waveform — arrastável e com preenchimento gradual (de baixo p/ cima) */}
        <div
          ref={waveRef}
          onPointerDown={(e) => {
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
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 34,
            cursor: "pointer",
            touchAction: "none",
          }}
        >
          {waveform.map((h, i) => {
            const fullH = Math.max(3, h * 30);
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
                    right: 0,
                    bottom: 0,
                    height: `${fill * 100}%`,
                    background: accent,
                  }}
                />
              </span>
            );
          })}
        </div>

        <span
          style={{
            fontSize: 11.5,
            fontVariantNumeric: "tabular-nums",
            color: variant === "user" ? "rgba(255,255,255,0.85)" : "rgba(216,210,231,0.7)",
            flexShrink: 0,
          }}
        >
          {formatDuration(currentTime)}
        </span>
      </div>

      {transcript ? (
        <div style={{ marginTop: 8 }}>
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
          {transcriptOpen && (
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
          )}
        </div>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1));
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          setProgress(0);
        }}
      />
    </div>
  );
}
