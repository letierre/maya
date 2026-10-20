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
 * Nota de voz (estilo WhatsApp): play/pause + waveform de barras + duração.
 * - Largura FIXA (não muda ao abrir/fechar a transcrição).
 * - As barras vão se preenchendo com a cor conforme o usuário escuta.
 * - A transcrição fica RECOLHIDA por padrão (botão "Transcrição").
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
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
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

        {/* Waveform de barras — preenche com a cor conforme o áudio avança */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 30, overflow: "hidden" }}>
          {waveform.map((h, i) => {
            const filled = (i + 0.5) / WAVE_BARS <= progress;
            return (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(3, h * 30)}px`,
                  borderRadius: 1.5,
                  background: filled ? accent : unfilled,
                  transition: "background 120ms linear",
                }}
              />
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
          {formatDuration(duration ?? progress)}
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
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />
    </div>
  );
}
