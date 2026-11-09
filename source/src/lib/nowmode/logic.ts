import type { NowEvent, Step } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function eventDate(ev: Pick<NowEvent, "date" | "time">): Date {
  const [y = 2026, m = 1, d = 1] = ev.date.split("-").map(Number);
  const [hh = 0, mm = 0] = ev.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** "15:00" -> "3:00 PM" */
export function formatTime(hhmm: string, withPeriod = true): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${withPeriod ? ` ${period}` : ""}`;
}

export function formatClock(d: Date): string {
  return formatTime(`${d.getHours()}:${d.getMinutes()}`, false);
}

export function addMinutes(hhmm: string, mins: number): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const TIME_RE =
  /\b(?:at\s+)?(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)|([01]?\d|2[0-3]):([0-5]\d))(?!\w)/i;

/**
 * Find a time in natural text. "3pm" -> "15:00", "9:30am" -> "09:30", "14:05" -> "14:05".
 * Returns null when there is no recognisable time.
 */
export function parseTime(text: string): string | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const word = (m[1] ?? "").toLowerCase();
  if (word === "noon") return "12:00";
  if (word === "midnight") return "00:00";
  if (m[2]) {
    let h = Number(m[2]);
    const min = m[3] ? Number(m[3]) : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    const pm = (m[4] ?? "").toLowerCase().startsWith("p");
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${pad(h)}:${pad(min)}`;
  }
  return `${pad(Number(m[5]))}:${m[6]}`;
}

export interface ParsedCapture {
  title: string;
  time: string | null;
  dayOffset: number;
}

/** Turn "call mom tomorrow at 3pm" into { title: "Call mom", time: "15:00", dayOffset: 1 } */
export function parseCapture(text: string): ParsedCapture {
  const time = parseTime(text);
  let rest = text.replace(TIME_RE, " ");
  let dayOffset = 0;
  if (/\btomorrow\b/i.test(rest)) {
    dayOffset = 1;
    rest = rest.replace(/\btomorrow\b/i, " ");
  } else {
    rest = rest.replace(/\btoday\b/i, " ");
  }
  rest = rest
    .replace(/\s+/g, " ")
    .replace(/\s+(at|@|by)\s*$/i, "")
    .trim()
    .replace(/[,.\-–—]+$/, "")
    .trim();
  const title = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "Quick capture";
  return { title, time, dayOffset };
}

/** Next half hour from a date, as HH:MM. */
export function nextHalfHour(now: Date): string {
  const mins = now.getHours() * 60 + now.getMinutes();
  const next = Math.min(23 * 60 + 30, Math.ceil((mins + 1) / 30) * 30);
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}

export function sortByTime<T extends Pick<NowEvent, "date" | "time">>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function eventsOn(events: NowEvent[], dateKey: string): NowEvent[] {
  return sortByTime(events.filter((e) => e.date === dateKey));
}

/** The first unfinished event of the day, in time order. */
export function nextUp(events: NowEvent[], dateKey: string): NowEvent | null {
  return eventsOn(events, dateKey).find((e) => !e.done) ?? null;
}

export function countByDate(events: NowEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) out[e.date] = (out[e.date] ?? 0) + 1;
  return out;
}

/** Break a task into three tiny, doable micro-steps. */
export function splitIntoSteps(title: string): Step[] {
  const t = title.length > 28 ? `${title.slice(0, 28).trim()}…` : title;
  return [
    { id: uid(), title: `Open it & set up — just 2 min`, done: false },
    { id: uid(), title: `Do the smallest first piece of “${t}”`, done: false },
    { id: uid(), title: `Save, close, and call it good enough`, done: false },
  ];
}

/** Toggle a micro-step; when every step is done the parent event is marked done too. */
export function toggleStep(ev: NowEvent, stepId: string): NowEvent {
  if (!ev.steps) return ev;
  const steps = ev.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
  const allDone = steps.length > 0 && steps.every((s) => s.done);
  return { ...ev, steps, done: allDone };
}

export const NUDGE_TIERS = [
  { key: "day", label: "1 day", word: "Glance", offsetMin: 24 * 60 },
  { key: "hour", label: "1 hour", word: "Nudge", offsetMin: 60 },
  { key: "ten", label: "10 min", word: "Pull", offsetMin: 10 },
  { key: "now", label: "Now", word: "Due", offsetMin: 0 },
] as const;

export type NudgeKey = (typeof NUDGE_TIERS)[number]["key"];

export function nudgeCopy(key: NudgeKey, ev: Pick<NowEvent, "title" | "time">): string {
  const t = formatTime(ev.time);
  switch (key) {
    case "day":
      return `Glance · Tomorrow at ${t}: ${ev.title}. No action needed yet.`;
    case "hour":
      return `Nudge · In about an hour: ${ev.title}.`;
    case "ten":
      return `Pull · 10 min until ${ev.title} — start landing what you're on.`;
    case "now":
      return `Due · ${ev.title} is now. Just one thing.`;
  }
}

export const ENERGY_COPY = {
  low: "Low battery is valid. Just the first tiny step counts.",
  okay: "Steady is great. One thing, then the next.",
  high: "You're in flow — ride it, then rest.",
} as const;