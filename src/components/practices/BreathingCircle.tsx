"use client";

import { useEffect, useRef, useState } from "react";
import type { BreathingPhase } from "@/lib/practice-scripts";

export type BreathPhase = "inhale" | "hold1" | "exhale" | "hold2";

const MIN_SCALE = 0.6;
const MAX_SCALE = 1.0;

/**
 * Círculo de respiração animado: expande na inspiração e contrai na expiração,
 * com pausas (holds). Dirige as fases por timer e notifica o pai via onPhase /
 * onCycle (para rótulo de fase e contador de ciclos).
 */
export function BreathingCircle({
  phases,
  running,
  onPhase,
  onCycle,
}: {
  phases: BreathingPhase;
  running: boolean;
  onPhase?: (p: BreathPhase) => void;
  onCycle?: () => void;
}) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [dur, setDur] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!running) {
      setScale(MIN_SCALE);
      setDur(0);
      return;
    }

    const seq: { phase: BreathPhase; seconds: number; target: number }[] = [];
    if (phases.inhale > 0) seq.push({ phase: "inhale", seconds: phases.inhale, target: MAX_SCALE });
    if (phases.hold1 > 0) seq.push({ phase: "hold1", seconds: phases.hold1, target: MAX_SCALE });
    if (phases.exhale > 0) seq.push({ phase: "exhale", seconds: phases.exhale, target: MIN_SCALE });
    if (phases.hold2 > 0) seq.push({ phase: "hold2", seconds: phases.hold2, target: MIN_SCALE });
    if (seq.length === 0) return;

    let i = 0;
    let cancelled = false;

    const step = () => {
      if (cancelled) return;
      const s = seq[i % seq.length];
      if (i > 0 && i % seq.length === 0) onCycle?.();
      onPhase?.(s.phase);
      setDur(s.seconds);
      setScale(s.target);
      i += 1;
      timerRef.current = setTimeout(step, s.seconds * 1000);
    };
    step();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, phases.inhale, phases.hold1, phases.exhale, phases.hold2, onPhase, onCycle]);

  return (
    <div
      style={{
        position: "relative",
        width: 240,
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* halo externo fixo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "1px solid rgba(167,139,250,0.22)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 14,
          borderRadius: "50%",
          border: "1px dashed rgba(167,139,250,0.18)",
        }}
      />
      {/* círculo que respira */}
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 38%, #A78BFA 0%, #7C5CFF 58%, #45357f 100%)",
          boxShadow: "0 0 70px rgba(124,92,255,0.5)",
          transform: `scale(${scale})`,
          transition: `transform ${dur}s ease-in-out`,
        }}
      />
    </div>
  );
}
