import type { Coord, Session, Split } from "./types";

// Haversine formula for distance between two GPS points
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Divide a corrida em parciais por km usando as coordenadas com timestamp.
export function computeSplits(coords: Coord[]): Split[] {
  const out: Split[] = [];
  if (!coords || coords.length < 2) return out;
  let cum = 0; // metros acumulados
  let startT = coords[0].timestamp;
  let nextKm = 1;
  for (let i = 1; i < coords.length; i++) {
    cum += haversine(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng);
    if (cum >= nextKm * 1000) {
      const sec = (coords[i].timestamp - startT) / 1000;
      out.push({ distKm: 1, sec, paceSecPerKm: sec });
      startT = coords[i].timestamp;
      nextKm++;
    }
  }
  // Última parcial (restante inferior a 1 km), com ritmo extrapolado
  const rest = cum - (nextKm - 1) * 1000;
  if (rest > 100) {
    const sec = (coords[coords.length - 1].timestamp - startT) / 1000;
    if (sec > 3) out.push({ distKm: rest / 1000, sec, paceSecPerKm: sec / (rest / 1000), partial: true });
  }
  return out;
}

// Quais recordes pessoais esta corrida bateu (distância, ritmo, duração).
export function sessionPRs(s: Session, st: { best_distance_m: number; best_pace: number; longest_duration: number }): ("dist" | "pace" | "dur")[] {
  const prs: ("dist" | "pace" | "dur")[] = [];
  if (st.best_distance_m > 0 && Math.round(s.distance_meters) === st.best_distance_m) prs.push("dist");
  if (st.best_pace > 0 && s.avg_pace && Math.round(s.avg_pace) === st.best_pace) prs.push("pace");
  if (st.longest_duration > 0 && s.duration_seconds === st.longest_duration) prs.push("dur");
  return prs;
}
