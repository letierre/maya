"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square, MapPin, Timer, Footprints, Zap, ChevronLeft } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Coord { lat: number; lng: number; timestamp: number; }
interface Session { id: string; start_time: string; end_time: string | null; distance_meters: number; duration_seconds: number; avg_pace: number | null; route_coordinates: Coord[]; }

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

export default function CorridaPage() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const watchId = useRef<number | null>(null);
  const routeLineRef = useRef<mapboxgl.GeoJSONSource | null>(null);
  const runStats = useRef<{ totalDist: number; maxSpeed: number; startedAt: number } | null>(null);

  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [pace, setPace] = useState(0);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [speed, setSpeed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Init map — cria imediatamente (sem aguardar geolocalização) e recentraliza depois
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const tk = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!tk) { setMapError("Mapa indisponível: token do Mapbox não configurado"); return; }
    mapboxgl.accessToken = tk;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-46.6333, -23.5505], // fallback: São Paulo (recentraliza abaixo)
        zoom: 13,
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
  }, []);

  // GPS tracking
  const startRun = () => {
    if (!navigator.geolocation) { toast.error("GPS não disponível"); return; }
    setRunning(true); setStartTime(new Date()); setDistance(0); setElapsed(0); setPace(0); setCoords([]);
    const startedAt = Date.now();
    const points: Coord[] = [];
    let lastPoint: Coord | null = null;
    runStats.current = { totalDist: 0, maxSpeed: 0, startedAt };

    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Ignora fixos imprecisos (GPS indoor/sinal fraco) que inflam a distância parado
        if (pos.coords.accuracy != null && pos.coords.accuracy > 20) return;

        const pt: Coord = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        if (pos.coords.speed != null) {
          const kmh = pos.coords.speed * 3.6;
          if (kmh > runStats.current!.maxSpeed) runStats.current!.maxSpeed = kmh;
          setSpeed(kmh);
        }
        if (lastPoint) {
          const d = haversine(lastPoint.lat, lastPoint.lng, pt.lat, pt.lng);
          // Ignora micro-jitter (< 1 m) que o GPS gera mesmo parado
          if (d < 1) return;
          runStats.current!.totalDist += d;
          setDistance(Math.round(runStats.current!.totalDist));
          const elapsedSec = (Date.now() - startedAt) / 1000;
          if (runStats.current!.totalDist > 10) setPace(elapsedSec / (runStats.current!.totalDist / 1000));
        }
        lastPoint = pt;
        points.push(pt);
        setCoords([...points]);
        // Update route line
        if (routeLineRef.current && points.length >= 2) {
          routeLineRef.current.setData({
            type: "Feature", properties: {},
            geometry: { type: "LineString", coordinates: points.map(p => [p.lng, p.lat]) },
          });
        }
      },
      (err) => { console.warn("GPS error:", err); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    watchId.current = id as unknown as number;
    (watchId as any).timer = timer;
  };

  const stopRun = async () => {
    if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); clearInterval((watchId as any).timer); watchId.current = null; }
    setRunning(false);

    const stats = runStats.current;
    const dist = stats ? Math.round(stats.totalDist) : distance;
    const maxSpeed = stats ? Math.round(stats.maxSpeed * 10) / 10 : Math.round(speed * 10) / 10;
    const duration = stats ? Math.max(1, Math.floor((Date.now() - stats.startedAt) / 1000)) : elapsed;

    if (dist < 10) { toast.error("Corrida muito curta para salvar"); runStats.current = null; return; }
    setSaving(true);
    const avgPace = dist > 10 ? duration / (dist / 1000) : 0;
    try {
      const res = await fetch("/api/running", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startTime ? startTime.toISOString() : new Date().toISOString(),
          end_time: new Date().toISOString(),
          distance_meters: dist, duration_seconds: duration,
          avg_pace: Math.round(avgPace), max_speed: maxSpeed,
          route_coordinates: coords,
        }),
      });
      if (res.ok) {
        toast.success("Corrida salva!");
        const saved = await res.json();
        setHistory(prev => [saved, ...prev]);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao salvar");
      }
    } catch { toast.error("Erro ao salvar"); }
    setSaving(false);
    runStats.current = null;
  };

  const viewSession = (s: Session) => {
    setSelectedSession(s);
    if (mapRef.current && s.route_coordinates?.length > 0) {
      const coords = s.route_coordinates.map((c: Coord) => [c.lng, c.lat] as [number, number]);
      if (routeLineRef.current) routeLineRef.current.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
      mapRef.current.fitBounds(coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0])), { padding: 40 });
    }
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

      {/* Map */}
      {!showHistory && (
        <div style={{ position: "relative", flex: 1, minHeight: 300, display: "flex", flexDirection: "column" }}>
          <div ref={mapContainer} style={{ flex: 1, minHeight: 300 }} />
          {mapError && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#0B0B10" }}>
              <p style={{ color: "#9e96b5", fontSize: 13, textAlign: "center" }}>{mapError}</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
          {history.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9e96b5", padding: 40 }}>Nenhuma corrida ainda</p>
          ) : history.map(s => (
            <button key={s.id} type="button" onClick={() => { viewSession(s); setShowHistory(false); }}
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

// Haversine formula for distance between two GPS points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
