import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// São Paulo timezone offset: UTC-3 (Brazil no longer observes DST since 2019)
const SP_OFFSET_MS = -3 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Converts UTC milliseconds to a YYYY-MM-DD string in São Paulo timezone. */
function spDate(ms: number): string {
  const d = new Date(ms + SP_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

/** Returns today's date in YYYY-MM-DD in São Paulo timezone (UTC-3). */
export function getLocalDate(): string {
  return spDate(Date.now());
}

/** Returns yesterday's date in YYYY-MM-DD in São Paulo timezone (UTC-3). */
export function getLocalYesterday(): string {
  return spDate(Date.now() - 24 * 60 * 60 * 1000);
}

/** Converts a UTC ISO timestamp string to a São Paulo date string (YYYY-MM-DD). */
export function getLocalDateFromISO(isoStr: string): string {
  return spDate(new Date(isoStr).getTime());
}

/** Formats a Date as YYYY-MM-DD in São Paulo timezone (UTC-3). */
export function formatLocalDate(d: Date): string {
  return spDate(d.getTime());
}

/** Returns the Monday date (YYYY-MM-DD) of the current week in São Paulo timezone. */
export function getWeekMondayDate(): string {
  const today = getLocalDate();
  const d = new Date(today + "T12:00:00");
  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + daysToMonday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns the Sunday date (YYYY-MM-DD) of the current week in São Paulo timezone. */
export function getWeekSundayDate(): string {
  const mon = getWeekMondayDate();
  const d = new Date(mon + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Counts consecutive days from the most recent check-in.
 * Timezone-independent: uses date arithmetic, not "today" strings.
 */
export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  // Sort descending
  const sorted = [...dates].sort(
    (a, b) => new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()
  );

  // Check if latest is within 2.5 days of now (grace period for timezone gaps)
  const latestMs = new Date(sorted[0] + "T12:00:00").getTime();
  const graceMs = 2.5 * 86400000;
  if (Date.now() - latestMs > graceMs) return 0;

  // Count consecutive days
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = new Date(sorted[i] + "T12:00:00").getTime();
    const prev = new Date(sorted[i + 1] + "T12:00:00").getTime();
    const diff = Math.abs((curr - prev) / 86400000);
    if (diff >= 0.9 && diff <= 1.1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
