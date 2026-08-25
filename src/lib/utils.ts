import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Timezone utilities ────────────────────────────────────────────────
// All date functions respect the user's actual timezone when running in
// the browser. On the server, they accept a `tz` IANA timezone parameter
// and fall back to São Paulo (UTC-3) when none is provided.

const SP_OFFSET_MS = -3 * 60 * 60 * 1000; // legacy fallback only

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formats a Date object as YYYY-MM-DD using its local (system) components. */
function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Returns today's date in YYYY-MM-DD using the browser timezone (client)
 *  or the given IANA timezone (server). Falls back to UTC-3 (São Paulo). */
export function getLocalDate(tz?: string): string {
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    return dateToYMD(new Date());
  }

  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      // invalid timezone — fall through to SP legacy
    }
  }

  // Server-side legacy fallback: UTC-3 (São Paulo)
  return spDate(Date.now());
}

/** Returns yesterday's date in YYYY-MM-DD in the user's timezone. */
export function getLocalYesterday(tz?: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (typeof window !== "undefined" || !tz) {
    // Browser: uses native local time. Server without tz: SP fallback.
    if (typeof window !== "undefined") return dateToYMD(d);
    return spDate(Date.now() - 24 * 60 * 60 * 1000);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Converts a UTC ISO timestamp string to a local date string (YYYY-MM-DD).
 *  In the browser this uses the user's actual timezone; on the server
 *  pass `tz` for the target timezone (falls back to UTC-3). */
export function getLocalDateFromISO(isoStr: string, tz?: string): string {
  if (typeof window !== "undefined") {
    return dateToYMD(new Date(isoStr));
  }
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(isoStr));
    } catch {
      // invalid tz — fall through
    }
  }
  return spDate(new Date(isoStr).getTime());
}

/** Converte "YYYY-MM-DD" em rótulo relativo ("hoje", "ontem", "há N dias")
 *  em relação a `todayStr` (também "YYYY-MM-DD"). Usa UTC para evitar DST. */
export function relativeDayLabel(dateStr: string, todayStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00Z").getTime();
  let ref: number;
  if (todayStr) {
    ref = new Date(todayStr + "T00:00:00Z").getTime();
  } else {
    const n = new Date();
    ref = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  }
  const diff = Math.round((ref - d) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff === 2) return "anteontem";
  return `há ${diff} dias`;
}

/** Formats a Date as YYYY-MM-DD in the user's timezone. */
export function formatLocalDate(d: Date, tz?: string): string {
  if (typeof window !== "undefined") return dateToYMD(d);
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      // fall through
    }
  }
  return spDate(d.getTime());
}

/** Returns the user's IANA timezone string (e.g. "America/Sao_Paulo").
 *  In the browser this reads from Intl; on the server returns UTC-3. */
export function getUserTimezone(): string {
  if (typeof window !== "undefined") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // fall through
    }
  }
  return "America/Sao_Paulo";
}

/** Returns the UTC offset string (e.g. "-03:00", "+05:30") for a given IANA
 *  timezone on a specific date. Used to construct timestamp ranges for DB queries. */
export function getTimezoneOffset(tz: string, dateStr: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const parts = fmt.formatToParts(new Date(dateStr + "T12:00:00"));
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart?.value?.startsWith("GMT")) {
      return offsetPart.value.slice(3); // "GMT-03:00" → "-03:00"
    }
  } catch {
    // invalid timezone — fall through
  }
  return "-03:00"; // fallback SP
}

/** Returns the current wall-clock time/date/day-of-week in a given IANA timezone.
 *  Used by the notification cron to fire each user's reminders at their local time. */
export function getLocalNow(tz?: string): { time: string; date: string; dow: number } {
  const tzName = tz || "America/Sao_Paulo";
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tzName,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const parts = fmt.formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    let hour = get("hour");
    if (hour === "24") hour = "00";
    const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      time: `${hour.padStart(2, "0")}:${get("minute").padStart(2, "0")}`,
      date: `${get("year")}-${get("month")}-${get("day")}`,
      dow: DOW[get("weekday")] ?? 0,
    };
  } catch {
    // Fallback: São Paulo (UTC-3)
    const sp = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return {
      time: `${String(sp.getUTCHours()).padStart(2, "0")}:${String(sp.getUTCMinutes()).padStart(2, "0")}`,
      date: [sp.getUTCFullYear(), String(sp.getUTCMonth() + 1).padStart(2, "0"), String(sp.getUTCDate()).padStart(2, "0")].join("-"),
      dow: sp.getUTCDay(),
    };
  }
}

/** Returns the Monday date (YYYY-MM-DD) of the current week in the user's timezone.
 *  Pass offsetWeeks to get a different week (e.g. 1 = next Monday, -1 = previous Monday). */
export function getWeekMondayDate(offsetWeeks?: number, tz?: string): string {
  const today = getLocalDate(tz);
  const d = new Date(today + "T12:00:00");
  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + daysToMonday + (offsetWeeks ?? 0) * 7);
  return dateToYMD(d);
}

/** Returns the Sunday date (YYYY-MM-DD) of the current week in the user's timezone. */
export function getWeekSundayDate(tz?: string): string {
  const mon = getWeekMondayDate(undefined, tz);
  const d = new Date(mon + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return dateToYMD(d);
}

/** Returns the Mon–Sun range of the most recently *completed* week.
 *  On Sunday the "most recent Sunday" is today → this week (ending today);
 *  Mon–Sat it's the previous Sunday → last week. `daysSinceSunday` is 0 on
 *  Sunday, 1 on Monday, … 6 on Saturday — used to decide the visibility
 *  window (the weekly mirror is shown Sun→Wed, hidden Thu–Sat). */
export function getReflectionWeek(tz?: string): { monday: string; sunday: string; daysSinceSunday: number } {
  const today = getLocalDate(tz);
  const d = new Date(today + "T12:00:00");
  const daysSinceSunday = d.getDay(); // 0=Sun..6=Sat
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - daysSinceSunday);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  return { monday: dateToYMD(monday), sunday: dateToYMD(sunday), daysSinceSunday };
}

// ── Legacy SP helpers (server-side only) ──────────────────────────────

/** Converts UTC milliseconds to a YYYY-MM-DD string in São Paulo timezone (UTC-3). */
function spDate(ms: number): string {
  const d = new Date(ms + SP_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
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
