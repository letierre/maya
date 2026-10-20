"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 30;

/**
 * Waveform em tempo real (Web Audio) que pulsa conforme a voz: fala mais forte
 * → barras maiores; silêncio → barras pequenas. Substitui o input enquanto grava.
 * Barras finas + movimento suave (decay lento) — sutil, não agressivo.
 */
export function RecordingWaveform({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let raf = 0;

    try {
      audioCtx = new AC();
      audioCtx.resume().catch(() => {});
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch {
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    const bars = new Array<number>(BAR_COUNT).fill(0);

    const draw = () => {
      raf = requestAnimationFrame(draw);

      analyser!.getByteTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / data.length); // 0..1

      for (let i = 0; i < BAR_COUNT; i++) {
        const peak =
          Math.random() < 0.12 ? Math.min(1, rms * 1.8 + Math.random() * 0.18) : bars[i] * 0.9;
        bars[i] = Math.max(bars[i] * 0.9, peak);
        if (bars[i] < 0.02) bars[i] = 0.015 + Math.random() * 0.015;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const slot = w / BAR_COUNT;
      const barW = slot * 0.5;
      for (let i = 0; i < BAR_COUNT; i++) {
        const bh = Math.max(2, Math.min(bars[i], 0.85) * h);
        const x = i * slot + (slot - barW) / 2;
        const y = (h - bh) / 2;
        ctx.fillStyle = "#A78BFA";
        ctx.fillRect(x, y, barW, bh);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      source?.disconnect();
      analyser?.disconnect();
      audioCtx?.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={260} height={44} style={{ display: "block", width: "100%", height: 44 }} />;
}
