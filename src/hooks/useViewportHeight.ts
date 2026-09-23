"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Tracks the visual viewport height for keyboard-aware layouts.
 * Returns the current viewport height and whether the keyboard is likely open.
 *
 * Used by the chat page to set the container height to exactly what's visible,
 * preventing iOS Safari from resizing the layout awkwardly when the keyboard appears.
 */
export function useViewportHeight() {
  const [viewportH, setViewportH] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fullHeightRef = useRef(0);
  const rafRef = useRef(0);

  const handleViewportChange = useCallback(() => {
    // Use rAF to debounce — iOS fires visualViewport events rapidly
    // during the keyboard animation (~every frame)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const vv = window.visualViewport;
      if (!vv) {
        // Fallback: use window.innerHeight
        setViewportH(window.innerHeight);
        setKeyboardOpen(false);
        return;
      }
      // Reancora a página no topo a cada frame do teclado — impede o iOS de
      // deixar uma faixa de scroll entre o input e o teclado.
      window.scrollTo(0, 0);
      const h = Math.round(vv.height);
      // "Altura cheia" = a maior altura já vista (sem teclado). Só cresce, para
      // rotação/troca de teclado não deixarem o valor defasado.
      if (h > fullHeightRef.current) fullHeightRef.current = h;
      setViewportH(h);
      setKeyboardOpen(fullHeightRef.current - h > 80);
    });
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    fullHeightRef.current = vv ? Math.round(vv.height) : window.innerHeight;

    if (vv) {
      vv.addEventListener("resize", handleViewportChange);
      vv.addEventListener("scroll", handleViewportChange);
    }
    // Fallback: com resizes-content o window também redimensiona ao abrir/fechar
    // o teclado — garante que a altura restaure mesmo se o visualViewport não
    // disparar (a causa da faixa preta).
    window.addEventListener("resize", handleViewportChange);

    // Initial measurement
    handleViewportChange();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleViewportChange);
        vv.removeEventListener("scroll", handleViewportChange);
      }
      window.removeEventListener("resize", handleViewportChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleViewportChange]);

  return { viewportH, keyboardOpen };
}
