import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import { focusWinLabel, greetingName } from "@/lib/nowmode/profile";
import {
  applySeriesTiming,
  dateKey,
  isLeapYear,
  materializeSeries,
  occurrenceDates,
  ruleFromDraft,
} from "@/lib/nowmode/recurrence";
import { migrateAppState } from "@/lib/nowmode/schedule";
import { effectiveBoardReviewTime, reviewTimeBefore } from "@/lib/nowmode/settings";
import { winInSpan } from "@/lib/nowmode/wins";
import type { NowEvent, RecurrenceRule } from "@/lib/nowmode/types";

const nudges = { day: false, hour: true, ten: true, now: true };

function rule(partial: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return ruleFromDraft({
    id: "rent",
    freq: "monthly",
    weekdays: [],
    monthDays: [31],
    customBy: "monthDays",
    start: "2026-01-01",
    time: "09:00",
    duration: 15,
    schedule: "fixed",
    title: "Rent reminder",
    tag: "Capture",
    color: "coral",
    nudges,
    ...partial,
  });
}

describe("board review time", () => {
  it("sits 90 minutes before quiet hours and wraps midnight", () => {
    expect(reviewTimeBefore("22:00")).toBe("20:30");
    expect(reviewTimeBefore("00:30")).toBe("23:00");
    expect(reviewTimeBefore("01:00")).toBe("23:30");
  });
  it("keeps a manual time when quiet hours move", () => {
    expect(effectiveBoardReviewTime({ quietStart: "22:00", boardReviewManual: true, boardReviewTime: "18:15" })).toBe("18:15");
    expect(effectiveBoardReviewTime({ quietStart: "21:00" })).toBe("19:30");
  });
});

describe("recurrence", () => {
  it("skips short months and non-leap February 29 instead of shifting the date", () => {
    const dates = occurrenceDates(rule(), new Date(2026, 0, 1), new Date(2026, 3, 1));
    expect(dates).toEqual(["2026-01-31", "2026-03-31"]);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2027)).toBe(false);
    const leap = occurrenceDates(rule({ monthDays: [29], start: "2027-01-01" }), new Date(2027, 1, 1), new Date(2028, 2, 1));
    expect(leap).toContain("2028-02-29");
    expect(leap).not.toContain("2027-02-29");
    expect(leap).not.toContain("2027-03-01");
  });

  it("keeps the clock time and does not double a reloaded series", () => {
    const series = rule({ freq: "daily", monthDays: [], start: "2026-11-01" });
    const today = new Date(2026, 10, 10);
    const once = materializeSeries([], [series], today);
    const twice = materializeSeries(once, [series], today);
    expect(twice).toHaveLength(once.length);
    expect(new Set(twice.map((event) => event.id)).size).toBe(once.length);
    expect(twice.every((event) => event.time === "09:00")).toBe(true);
    expect(once.length).toBeLessThan(200);
  });

  it("does not overwrite a finished occurrence or a one-off edit", () => {
    const series = rule({ freq: "weekly", weekdays: [1], monthDays: [], customBy: "weekdays", start: "2026-11-02", time: "10:00" });
    const today = new Date(2026, 10, 10);
    const events = materializeSeries([], [series], today);
    const done = { ...events[0]!, done: true };
    const moved = { ...events[1]!, date: "2026-12-01", exception: true, time: "11:00" };
    const edited = applySeriesTiming([done, moved, ...events.slice(2)], { ...series, time: "15:00" }, dateKey(today));
    expect(edited.find((event) => event.id === done.id)?.time).toBe("10:00");
    expect(edited.find((event) => event.id === moved.id)?.time).toBe("11:00");
    expect(edited.find((event) => event.id === events[2]?.id)?.time).toBe("15:00");
  });

  it("gives each occurrence its own completion", () => {
    const series = rule({ freq: "daily", monthDays: [], start: "2026-11-01" });
    const events = materializeSeries([], [series], new Date(2026, 10, 10));
    const [first, second] = events as [NowEvent, NowEvent];
    expect(first.id).not.toBe(second.id);
    expect(first.occurrenceKey).not.toBe(second.occurrenceKey);
  });
});

describe("saved data and names", () => {
  it("keeps existing events and wins and does not reseed", () => {
    const saved = migrateAppState({
      version: 1,
      events: [{ id: "e1", title: "Keep me", date: "2026-11-10", time: "09:00", duration: 20, schedule: "flexible" }],
      wins: [{ id: "w1", label: "Keep me", date: "2026-11-09", kind: "small", eventId: "e1" }],
      prefs: { username: "ada", quietStart: "23:00" },
      focus: { presetId: "custom", label: "Sketch", nameEdited: true, running: false },
    });
    expect(saved?.events.map((event) => event.title)).toEqual(["Keep me"]);
    expect(saved?.wins[0]?.label).toBe("Keep me");
    expect(saved?.prefs.username).toBe("ada");
    expect(saved?.series).toEqual([]);
    expect(saved?.focus.label).toBe("Sketch");
  });

  it("uses the typed focus name and a translated fallback when the name is blank", () => {
    const custom = (key: string) => (key === "focus.preset.custom" ? "A medida" : "Sesión");
    expect(focusWinLabel({ presetId: "custom", label: "Custom", nameEdited: false }, custom)).toBe("A medida");
    expect(focusWinLabel({ presetId: "custom", label: "Guitar", nameEdited: true }, custom)).toBe("Guitar");
    expect(focusWinLabel({ presetId: "custom", label: "   ", nameEdited: true }, custom)).toBe("Sesión");
  });

  it("greets with the chosen name and falls back when that field is empty", () => {
    expect(greetingName({ greetAs: "username", username: "ada", realName: "Ada Lovelace" })).toBe("ada");
    expect(greetingName({ greetAs: "realName", username: "ada", realName: "" })).toBe("ada");
    expect(greetingName({})).toBe("");
  });
});

describe("wins period filter", () => {
  it("filters the list without changing which wins exist", () => {
    const now = new Date(2026, 10, 10);
    expect(winInSpan("2026-11-10", "week", now, 0)).toBe(true);
    expect(winInSpan("2026-11-01", "week", now, 0)).toBe(false);
    expect(winInSpan("2026-11-01", "month", now, 1)).toBe(true);
    expect(winInSpan("2025-11-10", "year", now, 1)).toBe(false);
    expect(winInSpan("2020-01-01", "all", now, 1)).toBe(true);
  });
});

describe("dictionary still covers both Spanish variants", () => {
  it("has the new chrome keys", () => {
    for (const key of ["today.energyQ", "board.disconnect", "recur.monthNote", "profile.greet", "wins.total"] as const) {
      expect(messages["es-419"][key]).toBeTruthy();
      expect(messages["es-ES"][key]).toBeTruthy();
      expect(messages.en[key]).toBeTruthy();
    }
    expect(messages["es-419"]["board.disconnect"]).toBe("Desconectar");
    expect(messages["es-ES"]["board.disconnect"]).toBe("Desenlazar");
  });
});
