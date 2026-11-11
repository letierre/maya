import type { Coord, Session } from "./types";
import { formatDuration, formatPace } from "./format";

// Layout do bloco móvel de dados no compartilhamento (rota + card), em px
// lógicos do canvas 1080×1920. O bloco é arrastado e redimensionado pelo usuário.
export const SHARE_GROUP_W = 900;
export const SHARE_GROUP_ROUTE_H = 700;
export const SHARE_GROUP_GAP = 70;
export const SHARE_GROUP_STATS_H = 404; // 4 métricas em grade 2×2
export const SHARE_GROUP_H = SHARE_GROUP_ROUTE_H + SHARE_GROUP_GAP + SHARE_GROUP_STATS_H; // 1174

export type TFunc = (key: string, vars?: Record<string, string>) => string;

export interface ShareLayer {
  bg: (HTMLImageElement | HTMLCanvasElement) | null;
  avatar: HTMLImageElement | null;
}

export interface ShareBlock {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  routeShiftY: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Reduz a foto de fundo para caber no canvas (evita estourar memória no iOS
// com HEIC/12MP da galeria). Devolve um canvas, que serve direto no drawImage.
export function limitImage(img: HTMLImageElement, maxDim: number): HTMLImageElement | HTMLCanvasElement {
  const longest = Math.max(img.width, img.height);
  if (longest <= maxDim) return img;
  const scale = maxDim / longest;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Projeta as coordenadas da corrida num retângulo (x,y) preservando a proporção,
// para desenhar o percurso (só as linhas) sobre uma foto de fundo.
export function projectRoute(coords: Coord[], x: number, y: number, w: number, h: number, pad: number) {
  if (!coords || coords.length < 2) return [];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat; if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng; if (c.lng > maxLng) maxLng = c.lng;
  }
  const cosLat = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const spanX = (maxLng - minLng) * cosLat || 1e-9;
  const spanY = (maxLat - minLat) || 1e-9;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const drawW = spanX * scale, drawH = spanY * scale;
  const ox = x + (w - drawW) / 2, oy = y + (h - drawH) / 2;
  return coords.map(c => ({
    x: ox + (c.lng - minLng) * cosLat * scale,
    y: oy + (maxLat - c.lat) * scale,
  }));
}

// Desenha o bloco móvel de dados (percurso em linhas + card de 4 métricas)
// em coordenadas locais: rota em (0,0,900,700), card em (0,770,900,404).
function drawDataBlock(ctx: CanvasRenderingContext2D, s: Session, isWhite: boolean, rotationDeg: number, routeShiftY: number, t: TFunc) {
  const mapW = SHARE_GROUP_W, mapH = SHARE_GROUP_ROUTE_H;
  const pts = projectRoute(s.route_coordinates || [], 0, 0, mapW, mapH, 60);
  if (pts.length >= 2) {
    ctx.save();
    // Aproxima/afasta do card: deslocamento vertical aplicado NA TELA (depois da rotação),
    // para que o movimento seja sempre para cima/baixo independente do ângulo do percurso.
    ctx.translate(0, routeShiftY);
    // Rotaciona o percurso em torno do centro da área da rota (o card fica reto)
    ctx.translate(mapW / 2, mapH / 2);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.translate(-mapW / 2, -mapH / 2);
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (isWhite) {
      ctx.strokeStyle = "#7C5CFF";
      ctx.lineWidth = 12;
      ctx.shadowColor = "rgba(124,92,255,0.3)"; ctx.shadowBlur = 10;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#7C5CFF";
      ctx.lineWidth = 14;
      ctx.shadowColor = "rgba(124,92,255,0.9)"; ctx.shadowBlur = 24;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.fillStyle = "#22D18B"; ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FF4D4D"; ctx.beginPath(); ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Card de 4 métricas (distância, tempo, ritmo, velocidade máx)
  const statsY = mapH + SHARE_GROUP_GAP;
  const stats = [
    { label: t("co_distancia"), value: `${(s.distance_meters / 1000).toFixed(2)} km` },
    { label: t("co_tempo"), value: formatDuration(s.duration_seconds) },
    { label: t("co_ritmo_medio"), value: formatPace(s.avg_pace || 0) },
    { label: t("co_velocidade_max"), value: s.max_speed ? `${s.max_speed.toFixed(1)} km/h` : "--" },
  ];
  const gap = 20, cellW = (mapW - 80 - gap) / 2, cellH = 120, gridTop = statsY + 104;
  const statsH = SHARE_GROUP_STATS_H;
  ctx.fillStyle = "rgba(26,26,36,0.85)"; ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  drawRoundRect(ctx, 0, statsY, mapW, statsH, 28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#FFFFFF"; ctx.font = "600 28px Inter, system-ui, sans-serif"; ctx.textAlign = "left";
  ctx.fillText(t("co_estatisticas"), 40, statsY + 64);
  stats.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = 40 + col * (cellW + gap);
    const cy = gridTop + row * (cellH + gap);
    ctx.fillStyle = "rgba(15,15,20,0.7)"; ctx.strokeStyle = "rgba(167,139,250,0.15)"; ctx.lineWidth = 1;
    drawRoundRect(ctx, cx, cy, cellW, cellH, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e0d6ff"; ctx.font = "700 38px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(st.value, cx + cellW / 2, cy + 50);
    ctx.fillStyle = "#A0A0B3"; ctx.font = "600 20px Inter, system-ui, sans-serif";
    ctx.fillText(st.label.toUpperCase(), cx + cellW / 2, cy + 88);
  });
}

// Desenha a composição inteira em coordenadas lógicas 1080×1920. Header/título/
// data e rodapé são fixos; o bloco de dados é posicionado/escalado por `block`.
export function drawShare(ctx: CanvasRenderingContext2D, s: Session, layer: ShareLayer, block: ShareBlock, t: TFunc, locale: string) {
  const W = 1080, H = 1920;
  const isWhite = !layer.bg;

  if (layer.bg) {
    const scale = Math.max(W / layer.bg.width, H / layer.bg.height);
    const dw = layer.bg.width * scale, dh = layer.bg.height * scale;
    ctx.drawImage(layer.bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  }

  // Header — sombra no fundo de foto para manter contraste
  const headerY = 130;
  const avatarSize = 44, avatarCx = W / 2 - 82, avatarCy = headerY - 58;
  if (layer.avatar) ctx.drawImage(layer.avatar, avatarCx - avatarSize / 2, avatarCy - avatarSize / 2, avatarSize, avatarSize);
  ctx.fillStyle = isWhite ? "#0F0F14" : "#FFFFFF"; ctx.font = "600 24px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  if (!isWhite) { ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 8; }
  ctx.fillText("MAYA APP", W / 2 + 12, headerY - 48);
  ctx.shadowBlur = 0;

  // Título (respeita o toggle: Corrida ou Caminhada)
  const titleY = headerY + 46;
  const titulo = s.activity_type === "walk" ? t("co_caminhada") : t("co_titulo");
  ctx.font = "700 84px Inter, system-ui, sans-serif";
  const tw = ctx.measureText(titulo).width;
  const tg = ctx.createLinearGradient(W / 2 - tw / 2, titleY, W / 2 + tw / 2, titleY);
  tg.addColorStop(0, "#7C5CFF"); tg.addColorStop(1, "#A78BFA");
  ctx.fillStyle = tg;
  if (!isWhite) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 18; }
  ctx.fillText(titulo, W / 2, titleY);
  ctx.shadowBlur = 0;

  // Data — branca com sombra forte no fundo de foto; escura no fundo branco
  const dateStr = new Date(s.start_time).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  ctx.font = "500 28px Inter, system-ui, sans-serif";
  if (isWhite) {
    ctx.fillStyle = "#3f3a52";
    ctx.fillText(dateStr, W / 2, titleY + 50);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 12;
    ctx.fillText(dateStr, W / 2, titleY + 50);
    ctx.shadowBlur = 0;
  }

  // Bloco móvel (rota + card)
  ctx.save();
  ctx.translate(block.x, block.y);
  ctx.scale(block.scale, block.scale);
  drawDataBlock(ctx, s, isWhite, block.rotation, block.routeShiftY, t);
  ctx.restore();

  // Rodapé — sombra no fundo de foto
  const footerY = H - 130;
  ctx.fillStyle = isWhite ? "#6a657a" : "#FFFFFF"; ctx.font = "600 24px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
  if (!isWhite) { ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 8; }
  ctx.fillText(t("co_footer_share"), W / 2, footerY);
  ctx.shadowBlur = 0;
}

// Renderiza o preview (meia resolução) no canvas do editor.
export function renderSharePreview(canvas: HTMLCanvasElement, s: Session, layer: ShareLayer, block: ShareBlock, t: TFunc, locale: string) {
  const W = 1080, H = 1920, PREV = 0.5;
  canvas.width = W * PREV; canvas.height = H * PREV;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(PREV, PREV);
  drawShare(ctx, s, layer, block, t, locale);
}

// Exporta o PNG em resolução final (2×) e devolve o blob.
export async function exportSharePng(s: Session, layer: ShareLayer, block: ShareBlock, t: TFunc, locale: string): Promise<Blob | null> {
  const W = 1080, H = 1920, SCALE = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(SCALE, SCALE);
  drawShare(ctx, s, layer, block, t, locale);
  return await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
}
