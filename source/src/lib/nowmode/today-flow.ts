import { translate } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import type { LocaleId } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/messages";
import { addDays, eventsOn, toDateKey } from "./logic";
import { eventEndMs, eventStartMs } from "./schedule";
import { DEFAULT_QUIET_START, minutesOfDay } from "./settings";
import type { NowEvent, Prefs } from "./types";

const PRESENCE = ["presence.1", "presence.2", "presence.3"] as const;
const LET_GO = ["miss.1", "miss.2", "miss.3"] as const;

export function rotateIndex(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % Math.max(1, count);
  return hash;
}

export function hasClockTime(ev: Pick<NowEvent, "time">): boolean {
  return minutesOfDay(ev.time) != null;
}

/** End of the timeframe: start plus duration, or the start time when there is no duration. */
export function timeframeEndMs(ev: Pick<NowEvent, "date" | "time" | "duration">): number {
  return eventEndMs(ev);
}

export type AskState = "upcoming" | "ask" | "no" | "done" | "open";

/** Unscheduled items (no clock time) stay as they are. */
export function taskAskState(ev: NowEvent, now: Date): AskState {
  if (ev.done) return "done";
  if (!hasClockTime(ev)) return "open";
  if (ev.missed === "no") return "no";
  if (now.getTime() > timeframeEndMs(ev)) return "ask";
  return "upcoming";
}

/** Quiet-hours start on this calendar day, or the next midnight when quiet hours are off. */
export function dayRestAt(now: Date, prefs: Pick<Prefs, "quietHours" | "quietStart">): Date {
  if (prefs.quietHours) {
    const mins = minutesOfDay(prefs.quietStart ?? DEFAULT_QUIET_START) ?? 22 * 60;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

export function dayIsResting(now: Date, prefs: Pick<Prefs, "quietHours" | "quietStart">): boolean {
  return now.getTime() >= dayRestAt(now, prefs).getTime();
}

export function dayProgress(events: NowEvent[], now: Date, prefs: Pick<Prefs, "quietHours" | "quietStart">): { done: number; total: number; fill: number } {
  const total = events.length;
  const done = events.filter((ev) => ev.done).length;
  if (dayIsResting(now, prefs)) return { done, total, fill: 1 };
  return { done, total, fill: total ? done / total : 0 };
}

export function nextScheduledAfter(events: NowEvent[], current: Pick<NowEvent, "id" | "date" | "time">): NowEvent | null {
  const stamp = `${current.date}${current.time}`;
  return eventsOn(events, current.date).find((ev) => ev.id !== current.id && !ev.done && hasClockTime(ev) && `${ev.date}${ev.time}` > stamp) ?? null;
}

export function nextAfterClock(events: NowEvent[], todayKey: string, now: Date): NowEvent | null {
  return eventsOn(events, todayKey).find((ev) => !ev.done && hasClockTime(ev) && eventStartMs(ev) > now.getTime()) ?? null;
}

export function presenceCopy(locale: LocaleId, seed: string, next: Pick<NowEvent, "title" | "time"> | null): string {
  const line = translate(locale, PRESENCE[rotateIndex(seed, PRESENCE.length)] as MessageKey);
  if (!next) return line;
  return `${line}\n${translate(locale, "presence.next", { title: next.title, time: formatLocaleTime(next.time, locale) })}`;
}

export function letGoCopy(locale: LocaleId, seed: string): string {
  return translate(locale, LET_GO[rotateIndex(seed, LET_GO.length)] as MessageKey);
}

/** Same clock time on a later day. The missed occurrence stays where it is. */
export function followUpWhen(from: Date, choice: "tomorrow" | "week", time: string): { date: string; time: string } {
  return { date: toDateKey(addDays(from, choice === "tomorrow" ? 1 : 7)), time };
}

/** A new one-off. A recurring source keeps its other days; this copy is only the new time. */
export function freshOccurrence(ev: NowEvent, slot: { date: string; time: string; duration?: number }, id: string): NowEvent {
  return {
    ...ev,
    id,
    date: slot.date,
    time: slot.time,
    duration: slot.duration ?? ev.duration,
    done: false,
    missed: undefined,
    seriesId: undefined,
    occurrenceKey: undefined,
    exception: undefined,
    steps: ev.steps?.map((step) => ({ ...step, id: `${id}:${step.id}`, done: false })),
  };
}
