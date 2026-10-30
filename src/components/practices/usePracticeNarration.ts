"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface NarrationCue {
  url: string; // URL completa (já passada por photoUrl)
  atSec: number; // instante de início dentro da sessão (s)
}

/**
 * Agendador da narração em blocos. Toca o 1º bloco sincronamente (autoplay no
 * iOS exige o play() dentro do gesto do usuário) e agenda os demais via
 * setTimeout no instante de cada um. Entre blocos há silêncio (o som ambiente
 * segue tocando). Mantém `voiceActive` para o avatar/onda e o botão "pular".
 */
export function usePracticeNarration() {
  const [voiceActive, setVoiceActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    audioRef.current?.pause();
    audioRef.current = null;
    setVoiceActive(false);
  }, []);

  const skip = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setVoiceActive(false);
  }, []);

  const start = useCallback((cues: NarrationCue[]) => {
    clearAll();

    cues.forEach((cue, i) => {
      const play = () => {
        // Garante que não há sobreposição (bloco anterior ainda tocando).
        audioRef.current?.pause();
        const a = new Audio(cue.url);
        a.onplay = () => setVoiceActive(true);
        a.onended = () => setVoiceActive(false);
        a.onerror = () => setVoiceActive(false);
        audioRef.current = a;
        a.play().catch(() => setVoiceActive(false));
      };

      if (i === 0) {
        play();
      } else {
        timeoutsRef.current.push(setTimeout(play, Math.max(0, cue.atSec) * 1000));
      }
    });
  }, [clearAll]);

  // Limpa tudo ao desmontar.
  useEffect(() => () => clearAll(), [clearAll]);

  return { voiceActive, start, skip, clearAll };
}
