"use client";

import { useCallback, useRef } from "react";

export type AmbientKey = "none" | "ocean" | "rain" | "pad";

export const AMBIENT_OPTIONS: { key: AmbientKey; emoji: string; labelKey: string }[] = [
  { key: "none", emoji: "🔇", labelKey: "md_amb_none" },
  { key: "ocean", emoji: "🌊", labelKey: "md_amb_ocean" },
  { key: "rain", emoji: "🌧️", labelKey: "md_amb_rain" },
  { key: "pad", emoji: "🎐", labelKey: "md_amb_pad" },
];

const BASE_GAIN = 0.1;

function createCtx(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

/**
 * Sons ambientes de meditação gerados por Web Audio (sem arquivos, sem licença).
 * — "ocean": ruído marrom + lowpass + onda lenta de amplitude (vaivém do mar)
 * — "rain":  ruído branco filtrado (chuva)
 * — "pad":   acorde suave de senos detonados + LFO lento (drone meditativo)
 *
 * iOS: o AudioContext nasce "suspended" e precisa de resume dentro do gesto do
 * usuário. Sem isso o som sai mudo (ou só toca depois de mexer no volume) — por
 * isso `start` aguarda o resume e toca um buffer silencioso p/ "destravar" a
 * sessão de áudio antes de ligar as fontes.
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

  // Cria o contexto, garante que está "running" e toca um buffer silencioso
  // para ativar a rota de áudio do iOS. Deve rodar dentro do gesto do usuário.
  const unlock = useCallback(async (): Promise<AudioContext | null> => {
    const ctx = createCtx();
    if (!ctx) return null;
    ctxRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* silencioso — só serve p/ destravar o iOS */
    }
    return ctx;
  }, []);

  const start = useCallback(
    async (key: AmbientKey) => {
      stop();
      const ctx = await unlock();
      if (!ctx || key === "none") return;

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
          data[i] = last * 1.8;
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
        chordGain.gain.value = 0.22;
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
          g.gain.value = 0.35;
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
    [stop, unlock],
  );

  return { start, stop, setMuted };
}
