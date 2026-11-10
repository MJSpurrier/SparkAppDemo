import { eventDate, formatTime, toDateKey } from "./logic";
import type { AppState, FocusState, NowEvent, RecurrenceRule, ScheduleType, Win } from "./types";

export const MAX_BLOCK_MINUTES = 12 * 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "14:00" or "14:00:00" → "14:00". */
export function normalizeTime(time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(time.trim());
  return match ? `${match[1]}:${match[2]}` : time.trim();
}

export function scheduleOf(ev: { schedule?: ScheduleType | null }): ScheduleType {
  return ev.schedule === "flexible" ? "flexible" : "fixed";
}

/** A real length turns on the timer, extension, and overlap checks. */
export function hasDuration(ev: { duration?: number | null }): ev is { duration: number } {
  return typeof ev.duration === "number" && Number.isInteger(ev.duration) && ev.duration >= 1 && ev.duration <= MAX_BLOCK_MINUTES;
}

export function eventStartMs(ev: Pick<NowEvent, "date" | "time">): number {
  return eventDate(ev).getTime();
}

export function eventEndMs(ev: Pick<NowEvent, "date" | "time"> & { duration?: number | null }): number {
  const start = eventStartMs(ev);
  if (!hasDuration(ev)) return start;
  return start + ev.duration * 60_000;
}

export function eventEndClock(ev: Pick<NowEvent, "date" | "time" | "duration">): string {
  const end = new Date(eventEndMs(ev));
  return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

/** "2:00 PM – 3:00 PM" using the real end, without wrapping past midnight. */
export function formatRange(ev: Pick<NowEvent, "date" | "time" | "duration">): string {
  return `${formatTime(ev.time)} – ${formatTime(eventEndClock(ev))}`;
}

export interface SlotInput {
  date: string;
  time: string;
  duration?: number;
}

export function validateSlot(input: SlotInput): { ok: true } | { ok: false; message: string } {
  if (!DATE_RE.test(input.date)) return { ok: false, code: "date" as const, message: "Choose a real date." };
  const [y, m, d] = input.date.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== (m ?? 1) - 1 || dt.getDate() !== d) {
    return { ok: false, code: "date" as const, message: "Choose a real date." };
  }
  if (!TIME_RE.test(input.time.trim())) return { ok: false, code: "time" as const, message: "Use a start time like 14:00." };
  if (input.duration == null) return { ok: true };
  if (!Number.isInteger(input.duration) || input.duration < 1 || input.duration > MAX_BLOCK_MINUTES) {
    return { ok: false, code: "minutes" as const, message: "Duration needs to be a whole number of minutes, from 1 to 720." };
  }
  const start = eventDate({ date: input.date, time: input.time });
  const end = new Date(start.getTime() + input.duration * 60_000);
  if (toDateKey(end) !== input.date) {
    return {
      ok: false,
      code: "midnight" as const,
      message: "That runs past midnight. Shorten it so it finishes the same day, or start it earlier.",
    };
  }
  return { ok: true };
}

export function parseMinutesInput(raw: string): { ok: true; minutes?: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, code: "format" as const, message: "Enter a whole number of minutes, like 10." };
  }
  const minutes = Number(trimmed);
  if (minutes < 1 || minutes > MAX_BLOCK_MINUTES) {
    return { ok: false, code: "range" as const, message: "Enter between 1 and 720 minutes." };
  }
  return { ok: true, minutes };
}

export interface ExtensionPlan {
  duration: number;
  endMs: number;
}

/**
 * Add minutes onto a flexible block.
 * If the block has already ended, the extra time starts from now so it doesn't expire immediately.
 * If it's still running, the extra time is added onto the scheduled end.
 */
export function planExtension(
  ev: Pick<NowEvent, "date" | "time" | "duration">,
  minutes: number,
  now: Date,
): { ok: true; plan: ExtensionPlan } | { ok: false; message: string } {
  if (!hasDuration(ev)) {
    return { ok: false, code: "minutes" as const, message: "Add a length before extending this block." };
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_BLOCK_MINUTES) {
    return { ok: false, code: "minutes" as const, message: "Enter a whole number of minutes, from 1 to 720." };
  }
  const start = eventDate(ev);
  const scheduledEnd = eventEndMs(ev);
  const base = Math.max(scheduledEnd, now.getTime());
  const end = new Date(base + minutes * 60_000);
  if (toDateKey(end) !== ev.date) {
    const latest = new Date(start);
    latest.setHours(23, 59, 0, 0);
    const maxMin = Math.floor((latest.getTime() - base) / 60_000);
    if (maxMin < 1) {
      return {
        ok: false,
        code: "late" as const,
        message: "This block is already at the end of the day. Reschedule it if you want time tomorrow.",
      };
    }
    return {
      ok: false,
      code: "upTo" as const,
      maxMin,
      message: `That runs past midnight. You can add up to ${maxMin} minutes and still finish today.`,
    };
  }
  const duration = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (duration < 1 || duration > MAX_BLOCK_MINUTES) {
    return { ok: false, code: "long" as const, message: "That would make the block longer than 12 hours." };
  }
  return { ok: true, plan: { duration, endMs: end.getTime() } };
}

/** Touching endpoints (end === next start) is not an overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Next upcoming fixed event whose time overlaps [rangeStart, rangeEnd). Done events are skipped. */
export function fixedConflict(
  events: NowEvent[],
  selfId: string,
  rangeStart: number,
  rangeEnd: number,
  now = Date.now(),
): NowEvent | null {
  let hit: NowEvent | null = null;
  for (const other of events) {
    if (other.id === selfId || other.done) continue;
    if (scheduleOf(other) !== "fixed" || !hasDuration(other)) continue;
    const b0 = eventStartMs(other);
    const b1 = eventEndMs(other);
    if (b1 <= now) continue;
    if (!rangesOverlap(rangeStart, rangeEnd, b0, b1)) continue;
    if (!hit || b0 < eventStartMs(hit)) hit = other;
  }
  return hit;
}

export function conflictMessage(other: Pick<NowEvent, "title" | "time">): string {
  return `This overlaps ${other.title} at ${formatTime(other.time)}. That one stays put — nothing else moves.`;
}

export function planBlockTimer(
  ev: Pick<NowEvent, "date" | "time" | "duration">,
  now: Date,
): { remainingSec: number; endsAt: number; ended: boolean } {
  const endsAt = eventEndMs(ev);
  const remainingSec = Math.max(0, Math.ceil((endsAt - now.getTime()) / 1000));
  return { remainingSec, endsAt, ended: remainingSec === 0 };
}

export type SwitchGate = "start" | "same" | "confirm";

/** Don't replace a different running (or paused) focus session unless the user says so. */
export function focusSwitchGate(f: FocusState, eventId: string): SwitchGate {
  const same = f.eventId === eventId;
  const pausedMidway = !f.running && !f.finished && !f.endPromptFor && f.remainingSec > 0 && f.remainingSec < f.totalSec;
  const busy = f.running || pausedMidway;
  if (same && (f.linkedToBlock || busy)) return "same";
  if (!same && busy) return "confirm";
  return "start";
}

export function clearFiredFor(fired: string[], eventId: string): string[] {
  const prefix = `${eventId}:`;
  return fired.filter((key) => !key.startsWith(prefix));
}

export function applyReschedule(
  ev: NowEvent,
  input: SlotInput & { schedule: ScheduleType },
): NowEvent {
  return {
    ...ev,
    date: input.date,
    time: input.time,
    duration: input.duration,
    schedule: input.schedule,
  };
}

export function slotChanged(ev: Pick<NowEvent, "date" | "time" | "duration">, input: SlotInput): boolean {
  return ev.date !== input.date || ev.time !== input.time || ev.duration !== input.duration;
}

const defaultPrefs = { layeredNudges: true, focusReminders: true, quietHours: false };

export function defaultFocus(partial: Partial<FocusState> = {}): FocusState {
  return {
    presetId: "study",
    label: "Focus",
    totalSec: 25 * 60,
    remainingSec: 25 * 60,
    running: false,
    endsAt: null,
    eventId: null,
    bodyDouble: false,
    twoMinNotified: false,
    finished: false,
    customMin: 10,
    alarmedAt: null,
    linkedToBlock: false,
    endPromptFor: null,
    nameEdited: false,
    ...partial,
  };
}

function isWinLike(w: Partial<Win> | null | undefined): w is Partial<Win> & Pick<Win, "id" | "label"> {
  return !!w && typeof w.id === "string" && typeof w.label === "string";
}

export function migrateWin(raw: Partial<Win> & Pick<Win, "id" | "label">): Win {
  return {
    id: raw.id,
    label: raw.label,
    date: typeof raw.date === "string" ? raw.date : "2026-01-01",
    kind: raw.kind === "big" ? "big" : "small",
    note: typeof raw.note === "string" && raw.note.trim() ? raw.note : undefined,
    eventId: typeof raw.eventId === "string" ? raw.eventId : undefined,
  };
}

function isEventLike(e: Partial<NowEvent> | null | undefined): e is Partial<NowEvent> & Pick<NowEvent, "id" | "title" | "date" | "time"> {
  return !!e && typeof e.id === "string" && typeof e.title === "string" && typeof e.date === "string" && typeof e.time === "string";
}

export function migrateEvent(raw: Partial<NowEvent>): NowEvent {
  const nudges = raw.nudges ?? { day: false, hour: true, ten: true, now: true };
  return {
    id: raw.id ?? "event",
    title: raw.title ?? "Untitled",
    date: raw.date ?? "2026-01-01",
    time: raw.time ?? "09:00",
    duration: typeof raw.duration === "number" && raw.duration > 0 ? Math.round(raw.duration) : undefined,
    tag: raw.tag ?? "Capture",
    color: raw.color ?? "blue",
    done: !!raw.done,
    steps: raw.steps,
    nudges: {
      day: !!nudges.day,
      hour: nudges.hour !== false,
      ten: nudges.ten !== false,
      now: nudges.now !== false,
    },
    schedule: raw.schedule === "flexible" ? "flexible" : "fixed",
    seriesId: typeof raw.seriesId === "string" ? raw.seriesId : undefined,
    occurrenceKey: typeof raw.occurrenceKey === "string" ? raw.occurrenceKey : undefined,
    exception: raw.exception === true ? true : undefined,
    sourceCardId: typeof raw.sourceCardId === "string" ? raw.sourceCardId : undefined,
  };
}

function migrateSeries(raw: unknown): RecurrenceRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const rule = item as Partial<RecurrenceRule>;
    if (typeof rule.id !== "string" || typeof rule.title !== "string" || typeof rule.start !== "string") return [];
    const freq = rule.freq === "daily" || rule.freq === "weekly" || rule.freq === "monthly" || rule.freq === "custom" ? rule.freq : "weekly";
    return [{
      id: rule.id,
      freq,
      weekdays: Array.isArray(rule.weekdays) ? rule.weekdays.filter((day) => day >= 0 && day <= 6) : [],
      monthDays: Array.isArray(rule.monthDays) ? rule.monthDays.filter((day) => day >= 1 && day <= 31) : [],
      customBy: rule.customBy === "monthDays" ? "monthDays" : "weekdays",
      start: rule.start,
      end: typeof rule.end === "string" ? rule.end : undefined,
      time: typeof rule.time === "string" ? rule.time : "09:00",
      duration: typeof rule.duration === "number" && rule.duration > 0 ? rule.duration : undefined,
      schedule: rule.schedule === "fixed" ? "fixed" : "flexible",
      title: rule.title,
      tag: typeof rule.tag === "string" ? rule.tag : "Capture",
      color: rule.color ?? "blue",
      nudges: rule.nudges ?? { day: false, hour: true, ten: true, now: true },
      skips: Array.isArray(rule.skips) ? rule.skips.filter((day) => typeof day === "string") : [],
      sourceCardId: typeof rule.sourceCardId === "string" ? rule.sourceCardId : undefined,
    } satisfies RecurrenceRule];
  });
}

/** Recompute a running countdown from its wall-clock deadline after reload or a background tab. */
export function hydrateFocus(focus: FocusState, events: NowEvent[], now = Date.now()): FocusState {
  if (focus.linkedToBlock && focus.eventId) {
    const ev = events.find((e) => e.id === focus.eventId);
    if (ev && focus.running) {
      const endsAt = eventEndMs(ev);
      const remainingSec = Math.max(0, Math.ceil((endsAt - now) / 1000));
      if (remainingSec === 0) {
        return {
          ...focus,
          endsAt,
          remainingSec: 0,
          running: false,
          finished: false,
          alarmedAt: endsAt,
          endPromptFor: endsAt,
        };
      }
      return {
        ...focus,
        endsAt,
        remainingSec,
        totalSec: Math.max(focus.totalSec, remainingSec),
      };
    }
  }
  if (focus.running && focus.endsAt && !focus.linkedToBlock) {
    const remainingSec = Math.max(0, Math.ceil((focus.endsAt - now) / 1000));
    if (remainingSec === 0) {
      return { ...focus, remainingSec: 0, running: false, finished: true, endsAt: null };
    }
    return { ...focus, remainingSec };
  }
  return focus;
}

/**
 * Keep a saved nowmode-v1 blob. Old events with no schedule become fixed.
 * Never invents seed events.
 */
export function migrateAppState(raw: unknown, now = Date.now()): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<AppState>;
  if (parsed.version !== 1) return null;
  const events = Array.isArray(parsed.events) ? parsed.events.filter(isEventLike).map((e) => migrateEvent(e)) : [];
  const focusIn = (parsed.focus ?? {}) as Partial<FocusState>;
  const focus = hydrateFocus(
    defaultFocus({
      ...focusIn,
      alarmedAt: focusIn.alarmedAt ?? null,
      linkedToBlock: focusIn.linkedToBlock ?? false,
      endPromptFor: focusIn.endPromptFor ?? null,
    }),
    events,
    now,
  );
  return {
    version: 1,
    events,
    cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    links: [],
    prefs: { ...defaultPrefs, ...parsed.prefs },
    energy: parsed.energy ?? null,
    wins: Array.isArray(parsed.wins) ? parsed.wins.filter(isWinLike).map(migrateWin) : [],
    focus,
    firedNudges: Array.isArray(parsed.firedNudges) ? parsed.firedNudges : [],
    series: migrateSeries(parsed.series),
  };
}
