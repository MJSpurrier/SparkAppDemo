import { describe, expect, it } from "vitest";

import { deleteSeriesKeepingHistory, materializeSeries, removeOccurrence, ruleFromDraft } from "@/lib/nowmode/recurrence";
import { hasDuration, migrateAppState, parseMinutesInput, validateSlot } from "@/lib/nowmode/schedule";

const nudges = { day: false, hour: true, ten: true, now: true };

describe("optional duration and dropped links", () => {
  it("keeps a saved length, drops strings, and leaves a missing length empty", () => {
    const next = migrateAppState({
      version: 1,
      events: [
        { id: "a", title: "Call", date: "2026-11-10", time: "09:00", duration: 30, schedule: "fixed" },
        { id: "b", title: "Think", date: "2026-11-10", time: "11:00" },
      ],
      links: [{ id: "l", from: "a", to: "b" }],
      wins: [{ id: "w", label: "Call", date: "2026-11-09", kind: "small", eventId: "a" }],
      prefs: { alarmSound: "bell", alarmVolume: 40, quietHours: true, quietStart: "22:00" },
    });
    expect(next?.links).toEqual([]);
    expect(next?.events.find((event) => event.id === "a")?.duration).toBe(30);
    expect(next?.events.find((event) => event.id === "b")?.duration).toBeUndefined();
    expect(hasDuration(next!.events[1]!)).toBe(false);
    expect(next?.wins).toHaveLength(1);
    expect(next?.prefs.alarmSound).toBe("bell");
    expect(next?.prefs.alarmVolume).toBe(40);
    expect(validateSlot({ date: "2026-11-10", time: "11:00" }).ok).toBe(true);
    const parsed = parseMinutesInput("");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.minutes).toBeUndefined();
  });
});

describe("calendar delete", () => {
  const today = new Date(2026, 10, 10);
  const series = ruleFromDraft({
    id: "rent",
    freq: "daily",
    weekdays: [],
    monthDays: [],
    customBy: "weekdays",
    start: "2026-11-01",
    time: "09:00",
    duration: 15,
    schedule: "fixed",
    title: "Rent reminder",
    tag: "Capture",
    color: "coral",
    nudges,
  });

  it("removes one occurrence and leaves the rest and a saved win", () => {
    const events = materializeSeries([], [series], today);
    const target = events.find((event) => event.date === "2026-11-12")!;
    const done = { ...events[0]!, done: true };
    const removed = removeOccurrence(
      events.map((event) => (event.id === done.id ? done : event)),
      [series],
      target.id,
      today,
    );
    expect(removed.events.some((event) => event.occurrenceKey === target.occurrenceKey)).toBe(false);
    expect(removed.events.find((event) => event.id === done.id)?.done).toBe(true);
    expect(removed.series[0]?.skips).toContain("2026-11-12");
    const again = materializeSeries(removed.events, removed.series, new Date(2026, 11, 1));
    expect(again.some((event) => event.occurrenceKey === "2026-11-12")).toBe(false);
  });

  it("deletes the future series and keeps a completed occurrence", () => {
    const events = materializeSeries([], [series], today);
    const done = { ...events[0]!, done: true };
    const removed = deleteSeriesKeepingHistory(
      events.map((event) => (event.id === done.id ? done : event)),
      [series],
      series.id,
      "2026-11-10",
    );
    expect(removed.series).toEqual([]);
    expect(removed.events.filter((event) => event.done)).toHaveLength(1);
    expect(removed.events.some((event) => !event.done && event.date >= "2026-11-10")).toBe(false);
  });
});
