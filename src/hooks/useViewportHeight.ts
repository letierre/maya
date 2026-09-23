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
      const h = vv.height;
      setViewportH(h);
      setKeyboardOpen(fullHeightRef.current - h > 80);
    });
  }, []);

  useEffect(() => {
    fullHeightRef.current = window.innerHeight;

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleViewportChange);
      vv.addEventListener("scroll", handleViewportChange);
    }

    // Initial measurement
    handleViewportChange();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleViewportChange);
        vv.removeEventListener("scroll", handleViewportChange);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleViewportChange]);

  return { viewportH, keyboardOpen };
}
