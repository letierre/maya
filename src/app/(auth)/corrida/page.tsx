"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square, Timer, Footprints, Zap, ChevronLeft, Share2 } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { uploadToCloud, photoUrl } from "@/lib/photo-storage";
import { emitCareDataChanged } from "@/lib/care-events";

interface Coord { lat: number; lng: number; timestamp: number; }
interface Session { id: string; start_time: string; end_time: string | null; distance_meters: number; duration_seconds: number; avg_pace: number | null; max_speed: number | null; calories_estimate: number | null; notes: string | null; route_coordinates: Coord[]; map_snapshot: string | null; }

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s}s`;
}

const RUN_KEY = "maya_running_session";

// ── Helpers de canvas para o compartilhamento (PNG estilo Roda da Vida) ──
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

export default function CorridaPage() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const watchId = useRef<number | null>(null);
  const routeLineRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  const runStats = useRef<{ totalDist: number; maxSpeed: number; startedAt: number } | null>(null);
  const pointsRef = useRef<Coord[]>([]);
  const lastPointRef = useRef<Coord | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsErrorShownRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Init map — cria imediatamente (sem aguardar geolocalização) e recentraliza depois
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const tk = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!tk) { setMapError("Mapa indisponível: token do Mapbox ausente neste build — redeploie no Vercel"); return; }
    mapboxgl.accessToken = tk;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-46.6333, -23.5505], // fallback: São Paulo (recentraliza abaixo)
        zoom: 13,
        preserveDrawingBuffer: true, // necessário para capturar o mapa em imagem ao finalizar a corrida
      });
    } catch {
      setMapError("Não foi possível carregar o mapa");
      return;
    }
    mapRef.current = map;

    // Centraliza na localização real sem bloquear a criação do mapa
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapRef.current) mapRef.current.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
        },
        () => { /* mantém fallback */ },
        { timeout: 5000, maximumAge: 600000 }
      );
    }

    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true }));
    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#7C5CFF", "line-width": 4, "line-opacity": 0.8 } });
      routeLineRef.current = map.getSource("route") as mapboxgl.GeoJSONSource;
      // Redesenha uma corrida em andamento que foi restaurada de localStorage
      if (pointsRef.current.length >= 2) {
        routeLineRef.current.setData({
          type: "Feature", properties: {},
          geometry: { type: "LineString", coordinates: pointsRef.current.map(p => [p.lng, p.lat]) },
        });
      }
      // Track map load
      fetch("/api/running/mapbox-usage", { method: "POST" }).catch(() => {});
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Load history
  useEffect(() => { fetch("/api/running?limit=20").then(r => r.json()).then(d => { if (Array.isArray(d)) setHistory(d); }).catch(() => {}); }, []);

  // Limpa GPS/timer se o usuário sair da tela durante uma corrida
  useEffect(() => () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      clearInterval((watchId as any).timer);
      watchId.current = null;
    }
    if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
  }, []);

  // GPS tracking
  const persistSnapshot = () => {
    const stats = runStats.current;
    if (!stats) return;
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify({
        sessionId: sessionIdRef.current,
        startedAt: stats.startedAt,
        totalDist: stats.totalDist,
        maxSpeed: stats.maxSpeed,
        coords: pointsRef.current,
      }));
    } catch { /* storage indisponível/cheio — ignora */ }
  };

  // Sincroniza o estado atual da corrida com o servidor (PATCH na sessão ativa)
  const syncToServer = () => {
    const stats = runStats.current;
    const id = sessionIdRef.current;
    if (!stats || !id) return;
    const duration = Math.floor((Date.now() - stats.startedAt) / 1000);
    const dist = Math.round(stats.totalDist);
    const avgPace = dist > 10 ? duration / (dist / 1000) : null;
    fetch("/api/running", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        distance_meters: dist,
        duration_seconds: duration,
        avg_pace: avgPace ? Math.round(avgPace) : null,
        max_speed: Math.round(stats.maxSpeed * 10) / 10,
        route_coordinates: pointsRef.current,
      }),
    }).catch(() => { /* rede falhou — localStorage ainda segura */ });
  };

  const startSyncInterval = () => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(syncToServer, 5000);
  };

  const beginTracking = () => {
    const stats = runStats.current;
    if (!stats) return;
    const startedAt = stats.startedAt;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      persistSnapshot();
    }, 1000);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Ignora fixos imprecisos (GPS indoor/sinal fraco) que inflam a distância parado
        if (pos.coords.accuracy != null && pos.coords.accuracy > 20) return;

        const pt: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        if (pos.coords.speed != null) {
          const kmh = pos.coords.speed * 3.6;
          if (kmh > stats.maxSpeed) stats.maxSpeed = kmh;
          setSpeed(kmh);
        }
        if (lastPointRef.current) {
          const d = haversine(lastPointRef.current.lat, lastPointRef.current.lng, pt.lat, pt.lng);
          // Ignora micro-jitter (< 1 m) que o GPS gera mesmo parado
          if (d < 1) return;
          stats.totalDist += d;
          setDistance(Math.round(stats.totalDist));
          const elapsedSec = (Date.now() - startedAt) / 1000;
          if (stats.totalDist > 10) setPace(elapsedSec / (stats.totalDist / 1000));
        }
        lastPointRef.current = pt;
        pointsRef.current = [...pointsRef.current, pt];
        // Update route line
        if (routeLineRef.current && pointsRef.current.length >= 2) {
          routeLineRef.current.setData({
            type: "Feature", properties: {},
            geometry: { type: "LineString", coordinates: pointsRef.current.map(p => [p.lng, p.lat]) },
          });
        }
      },
      (err) => {
        console.warn("GPS error:", err);
        if (!gpsErrorShownRef.current) {
          gpsErrorShownRef.current = true;
          toast.error(err.code === err.PERMISSION_DENIED ? "Permissão de localização negada — ative o GPS para registrar a corrida" : "Sinal de GPS instável");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    watchId.current = id as unknown as number;
    (watchId as any).timer = timer;
  };

  const startRun = async () => {
    if (!navigator.geolocation) { toast.error("GPS não disponível"); return; }

    // Cria a sessão no servidor (end_time NULL) — o banco vira a fonte da verdade
    let id: string | null = null;
    try {
      const res = await fetch("/api/running", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: new Date().toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      id = data.id || null;
    } catch { id = null; }
    sessionIdRef.current = id;

    setRunning(true); setStartTime(new Date()); setDistance(0); setElapsed(0); setPace(0); setSpeed(0);
    runStats.current = { totalDist: 0, maxSpeed: 0, startedAt: Date.now() };
    pointsRef.current = [];
    lastPointRef.current = null;
    gpsErrorShownRef.current = false;
    persistSnapshot();
    beginTracking();
    startSyncInterval();
  };

  // Restaura uma corrida ativa: 1) servidor (fonte da verdade) → 2) localStorage (cache)
  useEffect(() => {
    let cancelled = false;
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24h — acima disso é corrida abandonada

    const resume = (snap: { sessionId: string | null; startedAt: number; totalDist: number; maxSpeed: number; coords: Coord[] }) => {
      sessionIdRef.current = snap.sessionId || null;
      runStats.current = { totalDist: snap.totalDist || 0, maxSpeed: snap.maxSpeed || 0, startedAt: snap.startedAt };
      pointsRef.current = Array.isArray(snap.coords) ? snap.coords : [];
      lastPointRef.current = pointsRef.current.length ? pointsRef.current[pointsRef.current.length - 1] : null;
      setRunning(true);
      setStartTime(new Date(snap.startedAt));
      setDistance(Math.round(snap.totalDist || 0));
      setElapsed(Math.floor((Date.now() - snap.startedAt) / 1000));
      beginTracking();
      startSyncInterval();
    };

    fetch("/api/running?active=1")
      .then((r) => r.json())
      .then((list) => {
        if (cancelled) return;
        const active = Array.isArray(list) ? list[0] : null;
        if (active?.start_time) {
          const age = Date.now() - new Date(active.start_time).getTime();
          if (age > MAX_AGE) {
            // abandonada — descarta
            fetch(`/api/running?id=${active.id}`, { method: "DELETE" }).catch(() => {});
            try { localStorage.removeItem(RUN_KEY); } catch { /* noop */ }
            return;
          }
          resume({
            sessionId: active.id,
            startedAt: new Date(active.start_time).getTime(),
            totalDist: active.distance_meters || 0,
            maxSpeed: active.max_speed || 0,
            coords: Array.isArray(active.route_coordinates) ? active.route_coordinates : [],
          });
          return;
        }
        // Fallback: sem sessão ativa no servidor — tenta o cache local
        let raw: string | null = null;
        try { raw = localStorage.getItem(RUN_KEY); } catch { return; }
        if (!raw) return;
        try {
          const snap = JSON.parse(raw) as { sessionId?: string | null; startedAt: number; totalDist: number; maxSpeed: number; coords: Coord[] };
          if (!snap?.startedAt) return;
          if (Date.now() - snap.startedAt > MAX_AGE) { try { localStorage.removeItem(RUN_KEY); } catch { /* noop */ } return; }
          resume({ sessionId: snap.sessionId || null, startedAt: snap.startedAt, totalDist: snap.totalDist || 0, maxSpeed: snap.maxSpeed || 0, coords: snap.coords || [] });
          // Se o id se perdeu, recria a sessão no servidor
          if (!snap.sessionId) {
            fetch("/api/running", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ start_time: new Date(snap.startedAt).toISOString() }),
            }).then((r) => r.json()).then((d) => { if (d?.id) sessionIdRef.current = d.id; }).catch(() => {});
          }
        } catch {
          try { localStorage.removeItem(RUN_KEY); } catch { /* noop */ }
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush no servidor no exato momento em que o app vai pro segundo plano (trocar pra WhatsApp/câmera)
  useEffect(() => {
    const flush = () => { if (sessionIdRef.current) syncToServer(); };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquadra a rota inteira e captura o mapa como imagem, para salvar junto da corrida
  const captureMapSnapshot = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const map = mapRef.current;
      const points = pointsRef.current;
      if (!map || points.length < 2) { resolve(null); return; }
      try {
        const bounds = points.reduce(
          (b, p) => b.extend([p.lng, p.lat]),
          new mapboxgl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
        );
        const capture = () => {
          try { resolve(map.getCanvas().toDataURL("image/jpeg", 0.9)); }
          catch { resolve(null); }
        };
        const fallback = setTimeout(capture, 2500);
        map.once("idle", () => { clearTimeout(fallback); capture(); });
        map.fitBounds(bounds, { padding: 56, animate: false });
      } catch { resolve(null); }
    });
  };

  const stopRun = async () => {
    if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); clearInterval((watchId as any).timer); watchId.current = null; }
    if (syncTimerRef.current) { clearInterval(syncTimerRef.current); syncTimerRef.current = null; }
    setRunning(false);
    try { localStorage.removeItem(RUN_KEY); } catch { /* noop */ }

    const stats = runStats.current;
    const dist = stats ? Math.round(stats.totalDist) : distance;
    const maxSpeed = stats ? Math.round(stats.maxSpeed * 10) / 10 : Math.round(speed * 10) / 10;
    const duration = stats ? Math.max(1, Math.floor((Date.now() - stats.startedAt) / 1000)) : elapsed;

    if (dist < 10) {
      // corrida curta demais — descarta (remove a sessão ativa do servidor)
      if (sessionIdRef.current) {
        fetch(`/api/running?id=${sessionIdRef.current}`, { method: "DELETE" }).catch(() => {});
      }
      toast.error("Corrida muito curta para salvar");
      runStats.current = null;
      sessionIdRef.current = null;
      return;
    }
    setSaving(true);
    const avgPace = dist > 10 ? duration / (dist / 1000) : 0;
    const startedIso = startTime ? startTime.toISOString() : new Date().toISOString();

    // Melhor esforço: captura uma foto do mapa com o trajeto para o usuário compartilhar (ex.: Stories)
    let mapSnapshotPath: string | null = null;
    try {
      const snapshot = await captureMapSnapshot();
      if (snapshot) mapSnapshotPath = await uploadToCloud(snapshot, "running");
    } catch { /* falha na captura/upload não deve impedir salvar a corrida */ }

    try {
      const payload = {
        end_time: new Date().toISOString(),
        distance_meters: dist,
        duration_seconds: duration,
        avg_pace: Math.round(avgPace),
        max_speed: maxSpeed,
        route_coordinates: pointsRef.current,
        map_snapshot: mapSnapshotPath,
      };
      let res: Response;
      if (sessionIdRef.current) {
        // finaliza a sessão ativa
        res = await fetch("/api/running", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionIdRef.current, ...payload }),
        });
      } else {
        // fallback: não havia sessão no servidor (ex.: start falhou) — insere direto
        res = await fetch("/api/running", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_time: startedIso, ...payload }),
        });
      }
      if (res.ok) {
        emitCareDataChanged();
        toast.success("Corrida salva!");
        const fresh = await fetch("/api/running?limit=20").then((r) => r.json()).catch(() => []);
        if (Array.isArray(fresh)) setHistory(fresh);
        const savedId = sessionIdRef.current || (await res.json().catch(() => null))?.id;
        const saved: Session = {
          id: savedId,
          start_time: startedIso,
          end_time: payload.end_time,
          distance_meters: dist,
          duration_seconds: duration,
          avg_pace: Math.round(avgPace),
          max_speed: maxSpeed,
          calories_estimate: null,
          notes: null,
          route_coordinates: pointsRef.current,
          map_snapshot: mapSnapshotPath,
        };
        setShowHistory(true);
        setSelectedSession(saved);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao salvar");
      }
    } catch { toast.error("Erro ao salvar"); }
    setSaving(false);
    runStats.current = null;
    sessionIdRef.current = null;
  };

  const deleteSession = async () => {
    if (!selectedSession) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/running?id=${selectedSession.id}`, { method: "DELETE" });
      if (res.ok) {
        emitCareDataChanged();
        toast.success("Corrida excluída");
        setHistory(prev => prev.filter(s => s.id !== selectedSession.id));
        setSelectedSession(null);
        setConfirmDelete(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao excluir");
      }
    } catch { toast.error("Erro ao excluir"); }
    setDeleting(false);
  };

  // Monta uma imagem de compartilhamento (mapa completo + estatísticas) no estilo Roda da Vida
  const shareRun = async () => {
    const s = selectedSession;
    if (!s) return;
    setSharing(true);
    try {
      const W = 1080, H = 1920, SCALE = 2;
      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE; canvas.height = H * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(SCALE, SCALE);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // 1. Fundo escuro + vinheta
      ctx.fillStyle = "#0F0F14"; ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H * 0.35, W * 0.3, W / 2, H * 0.55, W * 0.95);
      vg.addColorStop(0, "transparent"); vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // 2. Header — avatar Maya + MAYA APP (alinhados verticalmente, mesmo offset da Roda da Vida)
      let avatar: HTMLImageElement | null = null;
      try { avatar = await loadImage("/maya-avatar.webp"); } catch { /* segue sem avatar */ }
      const headerY = 130;
      const avatarSize = 44, avatarCx = W / 2 - 82, avatarCy = headerY - 58;
      if (avatar) ctx.drawImage(avatar, avatarCx - avatarSize / 2, avatarCy - avatarSize / 2, avatarSize, avatarSize);
      ctx.fillStyle = "#FFFFFF"; ctx.font = "600 24px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("MAYA APP", W / 2 + 12, headerY - 48);

      // 3. Título
      const titleY = headerY + 60;
      const titulo = "Corrida";
      ctx.font = "700 84px Inter, system-ui, sans-serif";
      const tw = ctx.measureText(titulo).width;
      const tg = ctx.createLinearGradient(W / 2 - tw / 2, titleY, W / 2 + tw / 2, titleY);
      tg.addColorStop(0, "#7C5CFF"); tg.addColorStop(1, "#A78BFA");
      ctx.fillStyle = tg;
      ctx.fillText(titulo, W / 2, titleY);

      // 4. Data da corrida
      const dateStr = new Date(s.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      ctx.fillStyle = "#A0A0B3"; ctx.font = "400 28px Inter, system-ui, sans-serif";
      ctx.fillText(dateStr, W / 2, titleY + 50);

      // 5. Mapa (trajeto completo)
      const mapX = 90, mapY = titleY + 110, mapW = W - 180, mapH = 700;
      const mapUrl = photoUrl(s.map_snapshot);
      if (mapUrl) {
        try {
          const mapImg = await loadImage(mapUrl);
          drawImageCover(ctx, mapImg, mapX, mapY, mapW, mapH, 32);
          ctx.strokeStyle = "rgba(167,139,250,0.25)"; ctx.lineWidth = 2;
          drawRoundRect(ctx, mapX, mapY, mapW, mapH, 32); ctx.stroke();
        } catch { /* sem mapa */ }
      }

      // 6. Card de estatísticas
      const statsY = mapY + mapH + 70;
      const statsH = 400;
      ctx.fillStyle = "rgba(26,26,36,0.85)"; ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      drawRoundRect(ctx, mapX, statsY, mapW, statsH, 28); ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#FFFFFF"; ctx.font = "600 28px Inter, system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText("Estatísticas", mapX + 40, statsY + 64);

      const stats = [
        { label: "Distância", value: `${(s.distance_meters / 1000).toFixed(2)} km` },
        { label: "Tempo", value: formatDuration(s.duration_seconds) },
        { label: "Ritmo médio", value: formatPace(s.avg_pace || 0) },
        { label: "Velocidade máx", value: s.max_speed ? `${s.max_speed.toFixed(1)} km/h` : "--" },
      ];
      const gap = 20, cellW = (mapW - 80 - gap) / 2, cellH = 120, gridTop = statsY + 104;
      stats.forEach((st, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const cx = mapX + 40 + col * (cellW + gap);
        const cy = gridTop + row * (cellH + gap);
        ctx.fillStyle = "rgba(15,15,20,0.7)"; ctx.strokeStyle = "rgba(167,139,250,0.15)"; ctx.lineWidth = 1;
        drawRoundRect(ctx, cx, cy, cellW, cellH, 18); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e0d6ff"; ctx.font = "700 38px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(st.value, cx + cellW / 2, cy + 50);
        ctx.fillStyle = "#A0A0B3"; ctx.font = "600 20px Inter, system-ui, sans-serif";
        ctx.fillText(st.label.toUpperCase(), cx + cellW / 2, cy + 88);
      });

      // 7. Rodapé
      const footerY = H - 130;
      ctx.fillStyle = "#A0A0B3"; ctx.font = "500 20px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("MAYA APP · SUA MELHOR VERSÃO, TODOS OS DIAS.", W / 2, footerY);

      // 8. Exporta e compartilha (mantém dentro do app)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) return;
      const file = new File([blob], "corrida.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Minha corrida" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "corrida.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch { /* usuário cancelou o share */ }
    setSharing(false);
  };

  return (
    <div style={{ height: "100dvh", background: "#0B0B10", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 10, background: "#0B0B10" }}>
        <button type="button" onClick={() => router.push("/dashboard")} style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>Corrida</h1>
        </div>
        <button type="button" onClick={() => setShowHistory(!showHistory)}
          style={{ padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {showHistory ? "Mapa" : "Histórico"}
        </button>
      </div>

      {/* Stats bar */}
      {!showHistory && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "rgba(167,139,250,0.1)", padding: 2, margin: "0 12px", borderRadius: 14, marginBottom: 8 }}>
          <StatChip icon={<Timer size={14} />} label="Tempo" value={running ? formatDuration(elapsed) : "--"} />
          <StatChip icon={<Footprints size={14} />} label="Distância" value={running ? `${(distance / 1000).toFixed(2)} km` : "--"} />
          <StatChip icon={<Zap size={14} />} label="Ritmo" value={running ? formatPace(pace) : "--"} />
        </div>
      )}

      {/* Map (sempre montado — o histórico sobrepõe, para não recriar o mapa) */}
      <div style={{ position: "relative", flex: 1, minHeight: 300 }}>
        <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />
        {mapError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#0B0B10", zIndex: 5 }}>
            <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center" }}>{mapError}</p>
          </div>
        )}

        {/* History overlay */}
        {showHistory && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "0 16px", background: "#0B0B10", zIndex: 5 }}>
            {history.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>Nenhuma corrida ainda</p>
            ) : history.map(s => (
              <button key={s.id} type="button" onClick={() => { setSelectedSession(s); setConfirmDelete(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(167,139,250,0.1)", background: "#1a1530", marginBottom: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 22 }}>🏃</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e0d6ff", display: "block" }}>{(s.distance_meters / 1000).toFixed(2)} km</span>
                  <span style={{ fontSize: 11, color: "#9e96b5" }}>{formatDuration(s.duration_seconds)} · {formatPace(s.avg_pace || 0)}</span>
                </div>
                <span style={{ fontSize: 10, color: "#5a5470" }}>{new Date(s.start_time).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action button — floating over map */}
      {!showHistory && (
        <div style={{ position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom) + 20px)", left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
          {!running ? (
            <button type="button" onClick={startRun}
              style={{ width: 72, height: 72, borderRadius: "50%", background: "#7C5CFF", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(124,92,255,0.5)" }}>
              <Play size={28} color="#fff" style={{ marginLeft: 3 }} />
            </button>
          ) : (
            <button type="button" onClick={stopRun} disabled={saving}
              style={{ width: 72, height: 72, borderRadius: "50%", background: "#FF4D4D", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(255,77,77,0.5)", opacity: saving ? 0.5 : 1 }}>
              <Square size={24} color="#fff" />
            </button>
          )}
        </div>
      )}

      {/* Detalhes da corrida selecionada */}
      {selectedSession && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { if (!deleting) setSelectedSession(null); }}>
          <div style={{ background: "#1a1530", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 20, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            {selectedSession.map_snapshot && (
              <div style={{ margin: "-20px -20px 16px" }}>
                <img src={photoUrl(selectedSession.map_snapshot) || ""} alt="Trajeto da corrida" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover", borderRadius: "20px 20px 0 0" }} />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0d6ff" }}>Corrida</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9e96b5" }}>
                  {new Date(selectedSession.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSession(null)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(167,139,250,0.1)", border: 0, color: "#A78BFA", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <StatBox label="Distância" value={`${(selectedSession.distance_meters / 1000).toFixed(2)} km`} />
              <StatBox label="Tempo" value={formatDuration(selectedSession.duration_seconds)} />
              <StatBox label="Ritmo médio" value={formatPace(selectedSession.avg_pace || 0)} />
              <StatBox label="Velocidade máx" value={selectedSession.max_speed ? `${selectedSession.max_speed.toFixed(1)} km/h` : "--"} />
            </div>

            <button type="button" onClick={shareRun} disabled={sharing}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: 0, background: "#7C5CFF", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, opacity: sharing ? 0.5 : 1 }}>
              <Share2 size={16} />
              {sharing ? "Preparando…" : "Compartilhar resultado"}
            </button>

            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={deleting}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,77,77,0.4)", background: "rgba(255,77,77,0.1)", color: "#FF4D4D", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Excluir corrida
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: "#e0d6ff", marginBottom: 10, textAlign: "center" }}>
                  Excluir esta corrida? Ela também será removida do check-in do dia. Essa ação não pode ser desfeita.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid rgba(167,139,250,0.2)", background: "transparent", color: "#A78BFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={deleteSession} disabled={deleting}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: 0, background: "#FF4D4D", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? "Excluindo…" : "Excluir"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "#1a1530", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
        <span style={{ color: "#A78BFA" }}>{icon}</span>
        <span style={{ fontSize: 10, color: "#9e96b5", fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#e0d6ff" }}>{value}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 12, padding: "12px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#9e96b5", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#e0d6ff", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// Haversine formula for distance between two GPS points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
