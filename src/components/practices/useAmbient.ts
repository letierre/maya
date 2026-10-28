"use client";

import { useCallback, useRef } from "react";

export type AmbientKey = "none" | "ocean" | "rain" | "pad";

export const AMBIENT_OPTIONS: { key: AmbientKey; emoji: string; labelKey: string }[] = [
  { key: "none", emoji: "🔇", labelKey: "md_amb_none" },
  { key: "ocean", emoji: "🌊", labelKey: "md_amb_ocean" },
  { key: "rain", emoji: "🌧️", labelKey: "md_amb_rain" },
  { key: "pad", emoji: "🎐", labelKey: "md_amb_pad" },
];

const BASE_GAIN = 0.2;

/**
 * Sons ambientes de meditação gerados por Web Audio (sem arquivos, sem licença).
 * — "ocean": ruído marrom + lowpass + onda lenta de amplitude (vaivém do mar)
 * — "rain":  ruído branco filtrado (chuva)
 * — "pad":   acorde suave de senos detonados + LFO lento (drone meditativo)
 * O toque dentro do gesto de "Começar" inicia o AudioContext (requisito do iOS).
 */
export function useAmbient() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    masterGainRef.current = null;
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : BASE_GAIN;
    }
  }, []);

  const start = useCallback(
    (key: AmbientKey) => {
      stop();
      if (key === "none") return;

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      void ctx.resume().catch(() => {});

      const master = ctx.createGain();
      master.gain.value = BASE_GAIN;
      master.connect(ctx.destination);
      masterGainRef.current = master;

      if (key === "ocean") {
        const size = 2 * ctx.sampleRate;
        const buf = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < size; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          data[i] = last * 3.5;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 420;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain);
        lfoGain.connect(master.gain);

        src.connect(lp);
        lp.connect(master);
        src.start();
        lfo.start();
      } else if (key === "rain") {
        const size = 2 * ctx.sampleRate;
        const buf = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 700;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 9000;
        src.connect(hp);
        hp.connect(lp);
        lp.connect(master);
        src.start();
      } else {
        // pad: acorde de A maior (A2, E3, A3, C#4) em senos levemente detonados
        const freqs = [110, 164.81, 220, 277.18];
        const chordGain = ctx.createGain();
        chordGain.gain.value = 0.4;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1000;
        chordGain.connect(lp);
        lp.connect(master);

        for (const f of freqs) {
          const o1 = ctx.createOscillator();
          o1.type = "sine";
          o1.frequency.value = f;
          o1.detune.value = -5;
          const o2 = ctx.createOscillator();
          o2.type = "sine";
          o2.frequency.value = f;
          o2.detune.value = 5;
          const g = ctx.createGain();
          g.gain.value = 0.5;
          o1.connect(g);
          o2.connect(g);
          g.connect(chordGain);
          o1.start();
          o2.start();
        }

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(chordGain.gain);
        lfo.start();
      }
    },
    [stop],
  );

  return { start, stop, setMuted };
}
