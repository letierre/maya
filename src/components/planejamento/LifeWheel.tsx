"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// Ordered to place longer labels where there's more horizontal space
// Top (0) & bottom (4) = most space for long labels
// Left (6) & right (2) = tight — shorter labels
const AREAS = [
  { key: "espiritualidade", label: "Espiritualidade", color: "#F97316", emoji: "✨" }, // top — long label, centered
  { key: "carreira",        label: "Carreira",        color: "#5EEAD4", emoji: "💼" }, // top-right
  { key: "desenvolvimento", label: "Mente",           color: "#A78BFA", emoji: "🧠" }, // right — short label
  { key: "familia",         label: "Família",         color: "#22D18B", emoji: "🏡" }, // bottom-right
  { key: "relacionamentos", label: "Relacionamentos", color: "#EC4899", emoji: "❤️" }, // bottom — long label, centered
  { key: "financas",        label: "Finanças",        color: "#F59E0B", emoji: "💰" }, // bottom-left — longer label
  { key: "lazer",           label: "Lazer",           color: "#38BDF8", emoji: "🌊" }, // left — short label
  { key: "saude",           label: "Saúde",           color: "#7C5CFF", emoji: "💚" }, // top-left
];

// Default custom emoji icons (fallback to text emoji if image fails to load)
const DEFAULT_EMOJIS: Record<string, string> = {
  espiritualidade: "/emojis/Espiritualidade-emoji-roda-da-vida.png?v=2",
  carreira: "/emojis/Carreira-emoji-roda-da-vida.png",
  desenvolvimento: "/emojis/Mente-emoji-roda-da-vida.png",
  familia: "/emojis/Familia-emoji-roda-da-vida.png",
  relacionamentos: "/emojis/Relacionamentos-emoji-roda-da-vida.png",
  financas: "/emojis/Financas-emoji-roda-da-vida.png",
  lazer: "/emojis/Lazer-emoji-roda-da-vida.png",
  saude: "/emojis/Saude-emoji-roda-da-vida.png",
};

interface LifeWheelProps {
  done: Record<string, number>;
  totals: Record<string, number>;
  /** Custom emoji images — map of area key to PNG URL. Falls back to system emoji. */
  emojis?: Partial<Record<string, string>>;
  /** Week date range label, e.g. "4 a 10 de agosto" — used in share PNG */
  weekLabel?: string;
  /** Focus stones for the week (max 3) — used in share PNG bottom card */
  stones?: (string | null)[];
}

const N = AREAS.length;
const CX = 150, CY = 150, R = 108;

function angle(i: number) { return -Math.PI / 2 + (i * 2 * Math.PI) / N; }

function vertPt(i: number, pct: number) {
  const a = angle(i);
  const r = R * (Math.min(Math.max(pct, 0), 100) / 100);
  return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`;
}

function ringPt(i: number, ratio: number) {
  const a = angle(i);
  return `${CX + R * ratio * Math.cos(a)},${CY + R * ratio * Math.sin(a)}`;
}

export function LifeWheel({ done, totals, emojis, weekLabel, stones }: LifeWheelProps) {
  const [mounted, setMounted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // Preload all custom emoji images so they render instantly (no pop-in delay)
  useEffect(() => {
    AREAS.forEach((a) => {
      const src = emojis?.[a.key] ?? DEFAULT_EMOJIS[a.key];
      const img = new Image();
      img.src = src;
    });
  }, [emojis]);

  const maxTotal = Math.max(...AREAS.map(a => totals[a.key] ?? 0), 1);

  // Volume planejado — quantidade de itens relativa à área com mais itens.
  const planned = AREAS.map(a => {
    const t = totals[a.key] ?? 0;
    return t > 0 ? Math.round((t / maxTotal) * 100) : 0;
  });

  // Volume concluído — quantidade concluída relativa à área com mais itens.
  // (mesma escala da linha "planejado"; evita a ilusão de 1/1 === 6/6)
  const doneVolume = AREAS.map(a => {
    const d = done[a.key] ?? 0;
    return d > 0 ? Math.round((d / maxTotal) * 100) : 0;
  });

  const hasData = planned.some(p => p > 0);
  const hasDone = doneVolume.some(p => p > 0);

  const donePoints  = AREAS.map((_, i) => vertPt(i, mounted ? doneVolume[i] : 0)).join(" ");
  const plannedPts  = AREAS.map((_, i) => vertPt(i, mounted ? planned[i] : 0)).join(" ");
  const outerRing   = AREAS.map((_, i) => ringPt(i, 1)).join(" ");
  const ring75      = AREAS.map((_, i) => ringPt(i, 0.75)).join(" ");
  const ring50      = AREAS.map((_, i) => ringPt(i, 0.5)).join(" ");
  const ring25      = AREAS.map((_, i) => ringPt(i, 0.25)).join(" ");

  const totalPlanned = AREAS.reduce((s, a) => s + (totals[a.key] ?? 0), 0);
  const totalDone    = AREAS.reduce((s, a) => s + (done[a.key] ?? 0), 0);
  const pctGlobal    = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;

  // Helper: draw rounded rectangle on canvas (roundRect not available in all TypeScript DOM libs)
  function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // Helper: wrap text to fit maxWidth, returns up to 2 lines
  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (ctx.measureText(text).width <= maxWidth) return [text];
    // Try to split roughly in half at a space
    const mid = Math.floor(text.length / 2);
    let splitAt = text.lastIndexOf(" ", mid);
    if (splitAt < 0 || splitAt < text.length * 0.2) splitAt = text.indexOf(" ", mid);
    if (splitAt < 0) splitAt = mid; // no spaces, hard split
    let line1 = text.slice(0, splitAt).trim();
    let line2 = text.slice(splitAt).trim();
    // If line2 still too long, truncate with ellipsis
    if (ctx.measureText(line2).width > maxWidth) {
      while (line2.length > 2 && ctx.measureText(line2 + "…").width > maxWidth) line2 = line2.slice(0, -1);
      line2 += "…";
    }
    // If line1 also too long (shouldn't happen with 2-line allowance), truncate
    if (ctx.measureText(line1).width > maxWidth) {
      while (line1.length > 2 && ctx.measureText(line1 + "…").width > maxWidth) line1 = line1.slice(0, -1);
      line1 += "…";
      return [line1];
    }
    return [line1, line2];
  }

  const handleShare = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setSharing(true);
    try {
      // ── Clone SVG & boost everything for export ──
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      // Force full opacity on ALL area groups — every label vibrant, even empty areas
      clone.querySelectorAll("g").forEach((el: Element) => {
        const g = el as SVGElement;
        const op = g.getAttribute("opacity");
        if (op && parseFloat(op) < 1) g.setAttribute("opacity", "1");
      });
      // Boost text sizes modestly for export
      clone.querySelectorAll("text").forEach((el: Element) => {
        const t = el as SVGElement;
        const fs = parseFloat(t.getAttribute("font-size") || "8");
        t.setAttribute("font-size", String(fs * 1.2));
        const fill = t.getAttribute("fill");
        // Boost opacity on rgba fills to full
        if (fill && fill.includes("rgba")) {
          t.setAttribute("fill", fill.replace(/[\d.]+\)$/, () => "1)"));
        }
        // Make subdued text fully vibrant
        if (fill && fill === "#6a657a") t.setAttribute("fill", "#c0b8d8");
      });
      // Boost structural elements (rings, axes, polygons) for export clarity
      clone.querySelectorAll("polygon, line, circle").forEach((el: Element) => {
        const s = el as SVGElement;
        const stroke = s.getAttribute("stroke");
        const fill = s.getAttribute("fill");
        if (stroke && stroke.includes("rgba")) {
          s.setAttribute("stroke", stroke.replace(/[\d.]+\)$/, m => {
            const v = parseFloat(m);
            return `${Math.min(v * 3, 0.85)})`;
          }));
        }
        if (fill && fill.includes("rgba")) {
          s.setAttribute("fill", fill.replace(/[\d.]+\)$/, m => {
            const v = parseFloat(m);
            return `${Math.min(v * 2.5, 0.75)})`;
          }));
        }
      });
      // Remove <image> elements — blob-URL SVGs don't load nested images reliably;
      // we draw the custom emoji icons directly on canvas instead.
      clone.querySelectorAll("image").forEach(el => el.remove());
      const svgData = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // ── Canvas setup (2x internal resolution = 4K quality) ──
      const canvas = document.createElement("canvas");
      const W = 1080, H = 1920;
      const SCALE = 2; // 2160×3840 internal → crisp text
      canvas.width = W * SCALE; canvas.height = H * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(SCALE, SCALE);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // ── 1. BACKGROUND ──────────────────────────────────────────
      // Solid dark base
      ctx.fillStyle = "#0F0F14"; ctx.fillRect(0, 0, W, H);

      // Subtle particles / blurred lights
      const particleSeeds = [23, 67, 112, 189, 245, 312, 378, 421, 489, 534, 601, 678, 723, 789, 845, 901, 956, 1003];
      particleSeeds.forEach(seed => {
        const px = (seed * 173) % W;
        const py = (seed * 337) % H;
        const pr = 1.5 + (seed % 5);
        const alpha = 0.08 + (seed % 4) * 0.03;
        const hue = seed % 3 === 0 ? "124,92,255" : seed % 3 === 1 ? "94,234,212" : "167,139,250";
        ctx.fillStyle = `rgba(${hue},${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      });

      // Vignette
      const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.55, W / 2, H / 2, W * 0.95);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

      // ── 2. HEADER ──────────────────────────────────────────────
      // Load Maya avatar image
      const mayaAvatar = new Image();
      mayaAvatar.src = "/maya-avatar.webp";
      await new Promise<void>((resolve, reject) => { mayaAvatar.onload = () => resolve(); mayaAvatar.onerror = reject; });

      const headerY = 120;
      // Maya avatar (estilo home — sem crop circular) + MAYA APP
      const avatarSize = 44, avatarCx = W / 2 - 82, avatarCy = headerY - 58;
      // Draw avatar full-image, no glow
      ctx.drawImage(mayaAvatar, avatarCx - avatarSize / 2, avatarCy - avatarSize / 2, avatarSize, avatarSize);

      // MAYA APP text — with breathing room from avatar
      ctx.fillStyle = "#FFFFFF"; ctx.font = "600 24px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("MAYA APP", W / 2 + 12, headerY - 48);

      // Title: "Hub da" + "Semana" in gradient — more breathing room from header
      const titleY = headerY + 52;
      ctx.font = "700 84px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "center";
      const hubDaW = ctx.measureText("Hub da ").width;
      const semanaW = ctx.measureText("Semana").width;
      const titleStartX = (W - hubDaW - semanaW) / 2;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("Hub da ", titleStartX + hubDaW / 2, titleY);
      // Gradient for "Semana"
      const semanaGrad = ctx.createLinearGradient(titleStartX + hubDaW, titleY, titleStartX + hubDaW + semanaW, titleY);
      semanaGrad.addColorStop(0, "#7C5CFF"); semanaGrad.addColorStop(1, "#A78BFA");
      ctx.fillStyle = semanaGrad;
      ctx.fillText("Semana", titleStartX + hubDaW + semanaW / 2, titleY);

      // Subtitle
      ctx.fillStyle = "#A0A0B3"; ctx.font = "400 28px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("Meu equilíbrio. Minhas escolhas. Minha melhor versão.", W / 2, titleY + 48);

      // ── 3. DATE BADGE ──────────────────────────────────────────
      const badgeY = titleY + 100;
      const badgeLabel = weekLabel || "";
      const badgeW = badgeLabel ? ctx.measureText(`📅 ${badgeLabel}`).width + 44 : 0;
      if (badgeW > 0) {
        const badgeX = (W - badgeW) / 2;
        ctx.fillStyle = "rgba(124,92,255,0.12)"; ctx.strokeStyle = "rgba(167,139,250,0.2)"; ctx.lineWidth = 1;
        drawRoundRect(ctx, badgeX, badgeY - 20, badgeW, 40, 22); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#E0D6FF"; ctx.font = "500 19px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`📅  ${badgeLabel}`, W / 2, badgeY + 6);
      }

      // ── 4. WHEEL ───────────────────────────────────────────────
      // SVG internal content is centered at x=150 (not 160) in 320-wide viewBox
      // Compensate so visual wheel center aligns with canvas center
      const wheelSize = 820;
      const svgCenterOffset = (160 - 150) / 320 * wheelSize; // ~26px right shift
      const wheelX = (W - wheelSize) / 2 + svgCenterOffset;
      const wheelY = badgeY + 110;
      const wheelCx = W / 2, wheelCy = wheelY + wheelSize / 2;

      // Load & render SVG wheel (no background glow)
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = svgUrl; });
      ctx.drawImage(img, wheelX, wheelY, wheelSize, wheelSize);

      // ── Draw custom emoji icons directly on canvas ──────────────
      // (SVG <image> elements don't load reliably inside blob-URL SVGs)
      const svgToCanvas = wheelSize / 320; // 2.5625
      const emojiCanvasSize = 88;
      const emojiImgs: Record<string, HTMLImageElement> = {};
      await Promise.all(AREAS.map(async (a) => {
        const src = emojis?.[a.key] ?? DEFAULT_EMOJIS[a.key];
        const imgEl = new Image();
        imgEl.src = src;
        await new Promise<void>((resolve, reject) => { imgEl.onload = () => resolve(); imgEl.onerror = reject; });
        emojiImgs[a.key] = imgEl;
      }));
      AREAS.forEach((a, i) => {
        const a2 = angle(i);
        const labelDist = 108 + (i === 1 ? 36 : i === 7 ? 33 : 26); // Carreira & Saúde need extra breathing room
        const lx = 150 + labelDist * Math.cos(a2); // SVG x coordinate (emoji center)
        const ly = 150 + labelDist * Math.sin(a2); // SVG y coordinate
        const cx = wheelX + lx * svgToCanvas;
        const cy = wheelY + (ly - 5) * svgToCanvas; // emoji sits slightly above the center radial line
        ctx.drawImage(emojiImgs[a.key], cx - emojiCanvasSize / 2, cy - emojiCanvasSize / 2, emojiCanvasSize, emojiCanvasSize);
      });

      // center dot removed — clean wheel

      // ── 5. BOTTOM CARD — "MEU FOCO DA SEMANA" ──────────────────
      const cardStartY = wheelY + wheelSize + 90;

      // Collect actual stones (filter out null/empty)
      const activeStones = (stones || []).filter(Boolean);
      const stoneCount = activeStones.length;

      // Only render card if there are stones
      if (stoneCount > 0) {
        const cardW = 900, cardX = (W - cardW) / 2;
        const cardPadding = 40;
        const cardTopPad = 70;
        const cardRadius = 28;
        const miniH = 220;
        const miniGap = 20;

        // Mini card accent colors
        const stoneMeta = [
          { color: "#5EEAD4", rgb: "94,234,212" },
          { color: "#7C5CFF", rgb: "124,92,255" },
          { color: "#EC4899", rgb: "236,72,153" },
        ];

        // Calculate mini card widths based on count
        let miniW: number;
        if (stoneCount === 1) {
          miniW = 500; // one wide card, centered
        } else if (stoneCount === 2) {
          miniW = (cardW - cardPadding * 2 - miniGap) / 2;
        } else {
          miniW = (cardW - cardPadding * 2 - miniGap * 2) / 3;
        }

        const cardH = cardTopPad + miniH + 60; // top pad + cards + bottom pad
        const cardBottomY = cardStartY + cardH;

        // Glass card background
        ctx.fillStyle = "rgba(26,26,36,0.85)"; ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
        drawRoundRect(ctx, cardX, cardStartY, cardW, cardH, cardRadius); ctx.fill(); ctx.stroke();

        // Card header
        const cardHeaderY = cardStartY + cardTopPad;
        ctx.fillStyle = "#FFFFFF"; ctx.font = "600 28px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("🎯  Meu foco da semana", cardX + cardPadding, cardHeaderY);

        const miniY = cardHeaderY + 28;

        activeStones.forEach((s, idx) => {
          if (idx >= 3) return;
          const rawTitle = (s ?? "").trim().toUpperCase();

          // Center each card configuration
          const totalMiniW = stoneCount * miniW + (stoneCount - 1) * miniGap;
          const miniStartX = cardX + (cardW - totalMiniW) / 2;
          const mx = miniStartX + idx * (miniW + miniGap);
          const meta = stoneMeta[idx];

          // Mini card bg
          ctx.fillStyle = "rgba(15,15,20,0.7)"; ctx.strokeStyle = `rgba(${meta.rgb},0.2)`; ctx.lineWidth = 1;
          drawRoundRect(ctx, mx, miniY, miniW, miniH, 18); ctx.fill(); ctx.stroke();
          // Colored top glow line
          const topGlow = ctx.createLinearGradient(mx, miniY, mx + miniW, miniY);
          topGlow.addColorStop(0, "transparent");
          topGlow.addColorStop(0.5, meta.color);
          topGlow.addColorStop(1, "transparent");
          ctx.strokeStyle = topGlow; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(mx + 20, miniY + 2); ctx.lineTo(mx + miniW - 20, miniY + 2); ctx.stroke();

          // Title — UPPERCASE, 2-line wrapping if needed
          ctx.fillStyle = "#FFFFFF"; ctx.font = "700 18px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "center";
          const availableW = miniW - 28; // padding inside card
          const lines = wrapText(ctx, rawTitle, availableW);

          if (lines.length === 1) {
            ctx.fillText(lines[0], mx + miniW / 2, miniY + 96);
          } else {
            // Two lines, vertically balanced
            ctx.fillText(lines[0], mx + miniW / 2, miniY + 86);
            ctx.fillText(lines[1], mx + miniW / 2, miniY + 112);
          }

          // Subtitle — bigger, below title lines
          const subtitleY = lines.length === 1 ? miniY + 128 : miniY + 140;
          ctx.fillStyle = "#A0A0B3"; ctx.font = "400 16px Inter, system-ui, -apple-system, sans-serif";
          ctx.fillText("Meu compromisso da semana.", mx + miniW / 2, subtitleY);
        });
      }

      // ── 6. HERO STATEMENT ──────────────────────────────────────
      // Where content ends: card bottom if cards exist, otherwise just wheel + gap
      const contentEndY = stoneCount > 0 ? cardStartY + 350 /* cardH */ : cardStartY;
      const heroY = contentEndY + 100;
      ctx.font = "700 50px Inter, system-ui, -apple-system, sans-serif"; ctx.textAlign = "center";
      const planejoW = ctx.measureText("Planejo hoje, ").width;
      const vivoW = ctx.measureText("vivo meu amanhã.").width;
      const heroStartX = (W - planejoW - vivoW) / 2;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("Planejo hoje, ", heroStartX + planejoW / 2, heroY);
      const vivoGrad = ctx.createLinearGradient(heroStartX + planejoW, heroY, heroStartX + planejoW + vivoW, heroY);
      vivoGrad.addColorStop(0, "#7C5CFF"); vivoGrad.addColorStop(1, "#A78BFA");
      ctx.fillStyle = vivoGrad;
      ctx.fillText("vivo meu amanhã.", heroStartX + planejoW + vivoW / 2, heroY);

      // Subtitle — larger, replaces old footer
      ctx.fillStyle = "#A0A0B3"; ctx.font = "400 20px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("SUA MELHOR VERSÃO, TODOS OS DIAS.", W / 2, heroY + 42);

      // ── 10. EXPORT & SHARE ─────────────────────────────────────
      const pngBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
      URL.revokeObjectURL(svgUrl);
      if (!pngBlob) return;
      const file = new File([pngBlob], "roda-da-vida.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Minha Roda da Vida" });
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(pngBlob); a.download = "roda-da-vida.png"; a.click();
      }
    } catch { /* cancelled */ }
    setSharing(false);
  }, [totalPlanned, totalDone, pctGlobal, weekLabel, stones, mounted, doneVolume]);

  return (
    <div
      style={{
        background: `
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(124,92,255,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 80% 70%, rgba(94,234,212,0.05) 0%, transparent 60%),
          linear-gradient(180deg, #181825 0%, #12121c 100%)
        `,
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.04)",
        padding: "24px 20px 20px",
        marginBottom: 16,
        position: "relative",
        overflow: "hidden",
        boxShadow: `
          0 1px 0 rgba(255,255,255,0.03) inset,
          0 8px 32px rgba(0,0,0,0.4)
        `,
      }}
    >
      {/* Glass grain texture overlay */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/></filter><rect width=\"100\" height=\"100\" filter=\"url(#n)\" opacity=\"0.03\"/></svg>')",
        }}
      />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, position: "relative" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "#e0d6ff" }}>
            Roda da Vida
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 10, color: "#6a657a", fontWeight: 500 }}>
            Como sua energia está distribuída
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {totalPlanned > 0 && (
            <div style={{
              background: "rgba(124,92,255,0.08)", borderRadius: 20,
              padding: "6px 14px", border: "1px solid rgba(124,92,255,0.12)",
              display: "flex", alignItems: "center",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#A78BFA", lineHeight: 1 }}>{pctGlobal}%</span>
              <span style={{ fontSize: 9, color: "#6a657a", marginLeft: 5, lineHeight: 1 }}>concluído</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            aria-label="Compartilhar Roda da Vida"
            style={{
              width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(167,139,250,0.15)",
              background: "rgba(124,92,255,0.06)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: sharing ? 0.5 : 1,
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Wheel container ── */}
      <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
        {/* Glow behind wheel */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: 220, height: 220, transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,92,255,0.12) 0%, transparent 60%)",
          pointerEvents: "none",
          animation: "lwPulse 4s ease-in-out infinite",
        }} />

        <svg ref={svgRef} viewBox="0 0 320 320" style={{ width: "100%", maxWidth: 300 }}>
          <defs>
            <linearGradient id="lwDoneFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(124,92,255,0.3)" />
              <stop offset="50%" stopColor="rgba(94,234,212,0.18)" />
              <stop offset="100%" stopColor="rgba(245,158,11,0.22)" />
            </linearGradient>
            <filter id="lwGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid rings — visible, alive */}
          <polygon points={outerRing} fill="none" stroke="rgba(124,92,255,0.25)" strokeWidth="1.5" />
          <polygon points={ring75}  fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="0.8" />
          <polygon points={ring50}  fill="none" stroke="rgba(167,139,250,0.1)" strokeWidth="0.7" />
          <polygon points={ring25}  fill="none" stroke="rgba(167,139,250,0.06)" strokeWidth="0.5" />

          {/* Axis lines — each with its area color, visible */}
          {AREAS.map((a, i) => {
            const [ex, ey] = ringPt(i, 1).split(",");
            return <line key={i} x1={CX} y1={CY} x2={ex} y2={ey} stroke={a.color} strokeWidth="0.6" opacity="0.35" />;
          })}

          {/* Planned polygon */}
          {hasData && (
            <polygon points={plannedPts}
              fill="rgba(167,139,250,0.03)"
              stroke="rgba(167,139,250,0.2)"
              strokeWidth="1.2"
              strokeDasharray="4,4"
              strokeLinejoin="round"
              style={{ transition: "all 1.1s cubic-bezier(0.34, 1.4, 0.5, 1)" }}
            />
          )}

          {/* Done polygon */}
          {hasDone && (
            <polygon points={donePoints}
              fill="url(#lwDoneFill)"
              stroke="rgba(124,92,255,0.6)"
              strokeWidth="2"
              strokeLinejoin="round"
              filter="url(#lwGlow)"
              style={{ transition: "all 1.1s cubic-bezier(0.34, 1.4, 0.5, 1)" }}
            />
          )}

          {/* Vertex dots — rótulo "feitos/total" (ex.: 6/6) */}
          {AREAS.map((a, i) => {
            const d = done[a.key] ?? 0;
            const t = totals[a.key] ?? 0;
            const pct = mounted ? doneVolume[i] : 0;
            if (d <= 0) return null;
            const [px, py] = vertPt(i, pct).split(",");
            const isFull = t > 0 && d >= t;
            return (
              <g key={a.key}>
                <circle cx={px} cy={py} r={isFull ? 6 : 5} fill={a.color} opacity={0.2} />
                <circle cx={px} cy={py} r={isFull ? 3 : 2.5} fill={a.color} stroke="#fff" strokeWidth="0.8" />
                <text x={px} y={Number(py) - 14} textAnchor="middle" fontSize={isFull ? 10 : 9} fontWeight="700" fill={a.color}>
                  {`${d}/${t}`}
                </text>
              </g>
            );
          })}

          {/* Area labels */}
          {AREAS.map((a, i) => {
            const a2 = angle(i);
            const labelDist = R + (i === 1 ? 36 : i === 7 ? 33 : 26); // Carreira & Saúde need extra breathing room
            const lx = CX + labelDist * Math.cos(a2);
            const ly = CY + labelDist * Math.sin(a2);
            const pct = mounted ? doneVolume[i] : 0;
            const planPct = mounted ? planned[i] : 0;
            const empty = pct === 0 && planPct === 0;
            const customEmoji = emojis?.[a.key] ?? DEFAULT_EMOJIS[a.key];
            return (
              <g key={a.key} opacity={empty ? 0.4 : 1} style={{ transition: "opacity .6s" }}>
                {customEmoji ? (
                  <image href={customEmoji} x={lx - 16} y={ly - 21} width="32" height="32" />
                ) : (
                  <text x={lx} y={ly - 3} textAnchor="middle" dominantBaseline="middle" fontSize="16">
                    {a.emoji}
                  </text>
                )}
                <text x={lx} y={ly + 14} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8.5" fontWeight="600" fill={a.color} letterSpacing=".03em">
                  {a.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Legend row ── */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 16, marginTop: 6,
        fontSize: 9, color: "#6a657a", fontWeight: 500, position: "relative",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px dashed rgba(167,139,250,0.4)" }} />
          Planejado
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(124,92,255,0.5)", border: "1px solid rgba(124,92,255,0.6)" }} />
          Concluído
        </span>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: "flex", justifyContent: "space-around", marginTop: 14, paddingTop: 14,
        borderTop: "1px solid rgba(255,255,255,0.03)", position: "relative",
      }}>
        <StatCell value={totalPlanned} label="Planejadas" />
        <StatCell value={totalDone} label="Concluídas" color={totalDone > 0 ? "#22D18B" : undefined} />
        <StatCell value={`${Math.min(AREAS.filter((_, i) => (totals[AREAS[i].key] ?? 0) > 0).length, N)}`} label="Áreas" />
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes lwPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
}

function StatCell({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: color || "#e0d6ff", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 9, color: "#6a657a", fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
      </p>
    </div>
  );
}
