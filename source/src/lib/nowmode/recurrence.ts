import { uid } from "./logic";
import type { NowEvent, RecurrenceRule } from "./types";

/** How far behind and ahead a series is written into storage. Older finished events stay. */
export const SERIES_PAST_DAYS = 14;
export const SERIES_FUTURE_DAYS = 120;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(key: string): Date | null {
  const match = DATE_RE.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** A real calendar date matches the rule. Impossible dates, such as February 31, are never produced. */
export function occursOn(rule: RecurrenceRule, date: Date): boolean {
  const key = dateKey(date);
  if (key < rule.start) return false;
  if (rule.end && key > rule.end) return false;
  if (rule.skips.includes(key)) return false;
  if (rule.freq === "daily") return true;
  const byWeek = rule.freq === "weekly" || (rule.freq === "custom" && rule.customBy === "weekdays");
  if (byWeek) return rule.weekdays.includes(date.getDay());
  const byMonth = rule.freq === "monthly" || (rule.freq === "custom" && rule.customBy === "monthDays");
  if (byMonth) return rule.monthDays.includes(date.getDate());
  return false;
}

export function occurrenceDates(rule: RecurrenceRule, from: Date, to: Date): string[] {
  const dates: string[] = [];
  for (let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate()); cursor <= to; cursor = addCalendarDays(cursor, 1)) {
    if (occursOn(rule, cursor)) dates.push(dateKey(cursor));
  }
  return dates;
}

export function occurrenceId(seriesId: string, key: string): string {
  return `occ-${seriesId}-${key}`;
}

export function makeOccurrence(rule: RecurrenceRule, key: string): NowEvent {
  return {
    id: occurrenceId(rule.id, key),
    title: rule.title,
    date: key,
    time: rule.time,
    duration: rule.duration,
    tag: rule.tag,
    color: rule.color,
    done: false,
    nudges: { ...rule.nudges },
    schedule: rule.schedule,
    seriesId: rule.id,
    occurrenceKey: key,
    sourceCardId: rule.sourceCardId,
  };
}

function taken(events: NowEvent[], seriesId: string, key: string): boolean {
  return events.some((event) => event.seriesId === seriesId && (event.occurrenceKey === key || event.date === key));
}

/**
 * Fill the bounded window and drop future untouched copies that no longer belong.
 * Done events and one-off edits stay, including ones outside the window.
 */
export function materializeSeries(events: NowEvent[], series: RecurrenceRule[], today: Date): NowEvent[] {
  const from = addCalendarDays(today, -SERIES_PAST_DAYS);
  const to = addCalendarDays(today, SERIES_FUTURE_DAYS);
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  let next = events.slice();
  const ids = new Set(series.map((rule) => rule.id));

  for (const rule of series) {
    for (const key of occurrenceDates(rule, from, to)) {
      if (!taken(next, rule.id, key)) next.push(makeOccurrence(rule, key));
    }
    next = next.filter((event) => {
      if (event.seriesId !== rule.id || event.done || event.exception) return true;
      const key = event.occurrenceKey ?? event.date;
      if (key < fromKey || key > toKey) return false;
      const when = parseDateKey(key);
      return !!when && occursOn(rule, when);
    });
  }

  return next.filter((event) => !event.seriesId || ids.has(event.seriesId) || event.done || event.exception);
}

export function applySeriesTiming(events: NowEvent[], rule: RecurrenceRule, todayKey: string): NowEvent[] {
  return events.map((event) => {
    if (event.seriesId !== rule.id || event.done || event.exception) return event;
    if (event.date < todayKey) return event;
    return {
      ...event,
      title: rule.title,
      time: rule.time,
      duration: rule.duration,
      schedule: rule.schedule,
      nudges: { ...rule.nudges },
    };
  });
}

export function ruleFromDraft(draft: Omit<RecurrenceRule, "id" | "skips"> & { id?: string }): RecurrenceRule {
  return {
    ...draft,
    id: draft.id ?? uid(),
    weekdays: [...new Set(draft.weekdays)].sort(),
    monthDays: [...new Set(draft.monthDays)].filter((day) => day >= 1 && day <= 31).sort((a, b) => a - b),
    skips: [],
  };
}

/** Drop one occurrence and remember the date so a later horizon does not recreate it. A finished one stays. */
export function skipOneOccurrence(
  events: NowEvent[],
  series: RecurrenceRule[],
  id: string,
  today: Date,
): { events: NowEvent[]; series: RecurrenceRule[] } {
  const event = events.find((item) => item.id === id);
  if (!event?.seriesId || !event.occurrenceKey) return { events, series };
  const nextSeries = series.map((rule) =>
    rule.id === event.seriesId && !rule.skips.includes(event.occurrenceKey!)
      ? { ...rule, skips: [...rule.skips, event.occurrenceKey!] }
      : rule,
  );
  const kept = event.done ? events : events.filter((item) => item.id !== id);
  return { series: nextSeries, events: materializeSeries(kept, nextSeries, today) };
}

/** Remove future untouched copies. Finished occurrences and earlier dates stay. */
export function deleteSeriesKeepingHistory(
  events: NowEvent[],
  series: RecurrenceRule[],
  id: string,
  todayKey: string,
): { events: NowEvent[]; series: RecurrenceRule[] } {
  return {
    series: series.filter((rule) => rule.id !== id),
    events: events.filter((event) => event.seriesId !== id || event.done || event.date < todayKey),
  };
}

/** This time becomes an exception. The series changes time and length for other unfinished future copies only. */
export function editSeriesScope(
  events: NowEvent[],
  series: RecurrenceRule[],
  id: string,
  next: Pick<NowEvent, "date" | "time" | "duration" | "schedule">,
  scope: "one" | "series",
  today: Date,
): { events: NowEvent[]; series: RecurrenceRule[] } {
  const event = events.find((item) => item.id === id);
  if (!event) return { events, series };
  const useSeries = scope === "series" && !!event.seriesId;
  let nextSeries = series;
  let nextEvents = events.map((item) =>
    item.id === id
      ? {
          ...item,
          ...next,
          exception: !useSeries && event.seriesId ? true : item.exception,
          occurrenceKey: item.occurrenceKey,
          seriesId: item.seriesId,
        }
      : item,
  );
  if (useSeries && event.seriesId) {
    nextSeries = series.map((rule) =>
      rule.id === event.seriesId ? { ...rule, time: next.time, duration: next.duration, schedule: next.schedule } : rule,
    );
    if (next.date !== event.date) {
      nextEvents = nextEvents.map((item) =>
        item.id === id
          ? { ...item, ...next, exception: true, occurrenceKey: event.occurrenceKey ?? event.date, seriesId: event.seriesId }
          : item,
      );
    }
    const rule = nextSeries.find((item) => item.id === event.seriesId);
    if (rule) nextEvents = applySeriesTiming(nextEvents, rule, dateKey(today));
  }
  return { series: nextSeries, events: materializeSeries(nextEvents, nextSeries, today) };
}

export function recurrenceReady(rule: Pick<RecurrenceRule, "freq" | "weekdays" | "monthDays" | "customBy">): boolean {
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekly" || (rule.freq === "custom" && rule.customBy === "weekdays")) return rule.weekdays.length > 0;
  if (rule.freq === "monthly" || (rule.freq === "custom" && rule.customBy === "monthDays")) return rule.monthDays.length > 0;
  return false;
}
