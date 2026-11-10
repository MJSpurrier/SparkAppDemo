import type { Nudges, Prefs } from "./types";

export const DEFAULT_NUDGES: Nudges = { day: false, hour: true, ten: true, now: true };
export const DEFAULT_QUIET_START = "22:00";
export const DEFAULT_QUIET_END = "07:00";
export const DEFAULT_FOCUS_LEAD = 2;
export const MAX_FOCUS_LEAD = 180;
export const MAX_CUSTOM_MINUTES = 12 * 60;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOfDay(hhmm: string): number | null {
  const match = TIME_RE.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when `now` falls inside the quiet range. A range with start > end crosses midnight. */
export function isQuietAt(now: Date, start: string, end: string): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = minutesOfDay(start);
  const to = minutesOfDay(end);
  if (from == null || to == null || from === to) return false;
  if (from < to) return cur >= from && cur < to;
  return cur >= from || cur < to;
}

/** Clock time `leadMin` minutes before quiet hours start, wrapping past midnight. */
export function reviewTimeBefore(quietStart: string, leadMin = 90): string {
  const mins = minutesOfDay(quietStart) ?? minutesOfDay(DEFAULT_QUIET_START) ?? 22 * 60;
  const next = (mins - leadMin + 24 * 60) % (24 * 60);
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}

/** Manual choice wins. Otherwise stay 90 minutes before the saved quiet-hours start. */
export function effectiveBoardReviewTime(prefs: Pick<Prefs, "quietStart" | "boardReviewTime" | "boardReviewManual">): string {
  const anchor = prefs.quietStart && minutesOfDay(prefs.quietStart) != null ? prefs.quietStart : DEFAULT_QUIET_START;
  if (prefs.boardReviewManual && prefs.boardReviewTime && minutesOfDay(prefs.boardReviewTime) != null) {
    const mins = minutesOfDay(prefs.boardReviewTime)!;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  return reviewTimeBefore(anchor);
}

export function quietRangeError(start: string, end: string): "invalid" | "equal" | null {
  if (minutesOfDay(start) == null || minutesOfDay(end) == null) return "invalid";
  if (start.trim() === end.trim()) return "equal";
  return null;
}

export function normalizeLead(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_FOCUS_LEAD;
  return Math.min(MAX_FOCUS_LEAD, n);
}

/**
 * Warn once, only while the session is still running, and only if the session
 * is longer than the lead. A 5-minute timer with a 10-minute lead never warns.
 */
export function shouldLeadWarn(totalSec: number, remainingSec: number, leadMin: number, already: boolean): boolean {
  if (already) return false;
  const lead = normalizeLead(leadMin) * 60;
  if (totalSec <= lead) return false;
  return remainingSec > 0 && remainingSec <= lead;
}

export function nudgeTierAllowed(prefs: Pick<Prefs, "layeredNudges" | "nudgeDefaults">, eventOn: boolean, key: keyof Nudges): boolean {
  if (!prefs.layeredNudges || !eventOn) return false;
  const defaults = prefs.nudgeDefaults ?? DEFAULT_NUDGES;
  return !!defaults[key];
}

export function parseCustomDuration(
  hoursRaw: string,
  minutesRaw: string,
): { ok: true; hours: number; minutes: number; total: number } | { ok: false; reason: "format" | "range" } {
  if (!/^\d+$/.test(hoursRaw.trim()) || !/^\d+$/.test(minutesRaw.trim())) return { ok: false, reason: "format" };
  const hours = Number(hoursRaw.trim());
  const minutes = Number(minutesRaw.trim());
  if (hours > 12 || minutes > 59) return { ok: false, reason: "range" };
  const total = hours * 60 + minutes;
  if (total < 1 || total > MAX_CUSTOM_MINUTES) return { ok: false, reason: "range" };
  return { ok: true, hours, minutes, total };
}

export function splitCustomMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.min(MAX_CUSTOM_MINUTES, Math.max(0, Math.round(total)));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export type PaletteId = "ocean" | "lavender" | "forest";
export type ThemeMode = "light" | "dark";

export function normalizePalette(value: unknown): PaletteId {
  return value === "lavender" || value === "forest" ? value : "ocean";
}

export function normalizeTheme(value: unknown): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function applyAppearance(mode: ThemeMode, palette: PaletteId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.palette = palette;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  const themeColor = mode === "light" ? "#f4f7fb" : "#0f1419";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}
