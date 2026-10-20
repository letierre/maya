"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { photoUrl } from "@/lib/photo-storage";

function formatDuration(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Bolha de nota de voz (estilo WhatsApp): botão play/pause + barra de progresso
 * + duração. O texto/transcrição fica abaixo, no balão da mensagem.
 * No iOS, tocar no play é um gesto do usuário → sempre reproduz (sem autoplay).
 */
export function VoiceNote({
  path,
  variant = "assistant",
}: {
  path: string;
  variant?: "assistant" | "user";
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const src = photoUrl(path) ?? undefined;
  const accent = variant === "user" ? "#FFFFFF" : "#A78BFA";
  const trackBg = variant === "user" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)";

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200, maxWidth: 320 }}>
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
        {playing ? (
          <Pause className="size-5" />
        ) : (
          <Play className="size-5" style={{ marginLeft: 2 }} />
        )}
      </button>

      <div
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          background: trackBg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(progress * 100, 100)}%`,
            background: accent,
            borderRadius: 2,
          }}
        />
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
