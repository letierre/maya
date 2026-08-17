"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseChatScrollOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  messageCount: number;
  typing: boolean;
  hydrated: boolean;
}

/**
 * Chat scroll management:
 * - ResizeObserver fires BEFORE paint → no flash/bounce
 * - When container SHRINKS (textarea grows, keyboard opens): ALWAYS scroll to
 *   bottom, regardless of isAtBottomRef. The user didn't scroll — the layout
 *   changed. And if they tapped the input, they want to type, not read history.
 * - When content GROWS (new message, typing indicator): scroll only if user
 *   is already at the bottom (respects reading history).
 */
export function useChatScroll({
  containerRef,
  bottomRef,
  messageCount,
  typing,
  hydrated,
}: UseChatScrollOptions) {
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(messageCount);

  const checkAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, [containerRef]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "instant") => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior });
    },
    [bottomRef],
  );

  // ── ResizeObserver ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let prevClientHeight = el.clientHeight;

    const ro = new ResizeObserver(() => {
      const newClientHeight = el.clientHeight;

      if (newClientHeight < prevClientHeight) {
        // Container SHRUNK (textarea grew to 3rd+ line, keyboard opened).
        // Always scroll to bottom — layout changed, user didn't scroll.
        scrollToBottom("instant");
      } else if (newClientHeight > prevClientHeight) {
        // Container GREW (keyboard closed, textarea shrunk).
        // If user was at bottom, keep them there.
        if (isAtBottomRef.current) {
          scrollToBottom("instant");
        }
      }
      // If same height but content grew (scrollHeight increased) —
      // handled by the messageCount/typing effects below.

      prevClientHeight = newClientHeight;
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, scrollToBottom]);

  // ── Scroll on new messages ──────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;

    if (messageCount > prevMessageCountRef.current) {
      if (isAtBottomRef.current) {
        scrollToBottom("smooth");
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount, hydrated, scrollToBottom]);

  // ── Scroll when typing indicator appears ────────────────────────
  useEffect(() => {
    if (typing && isAtBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [typing, scrollToBottom]);

  // ── Initial scroll after hydration ──────────────────────────────
  useEffect(() => {
    if (hydrated) {
      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
    }
  }, [hydrated, scrollToBottom]);

  // ── Track user scroll position ──────────────────────────────────
  const handleScroll = useCallback(() => {
    isAtBottomRef.current = checkAtBottom();
  }, [checkAtBottom]);

  return { handleScroll, scrollToBottom, isAtBottomRef };
}
