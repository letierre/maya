export interface Coord { lat: number; lng: number; timestamp: number; alt?: number; }

export interface Session {
  id: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  avg_pace: number | null;
  max_speed: number | null;
  calories_estimate: number | null;
  notes: string | null;
  route_coordinates: Coord[];
  map_snapshot: string | null;
  elevation_gain_m: number | null;
  steps: number | null;
  avg_cadence: number | null;
  activity_type: string | null;
}

export interface Split { distKm: number; sec: number; paceSecPerKm: number; partial?: boolean; }
