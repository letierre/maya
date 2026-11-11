export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s}s`;
}

export function formatPaceShort(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
