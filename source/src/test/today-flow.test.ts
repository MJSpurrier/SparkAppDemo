import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import { planReminders } from "@/lib/nowmode/reminders";
import { freshOccurrence, followUpWhen, dayIsResting, dayProgress, presenceCopy, taskAskState } from "@/lib/nowmode/today-flow";
import type { NowEvent, Prefs } from "@/lib/nowmode/types";

const prefs: Prefs = { layeredNudges: true, focusReminders: true, quietHours: false, quietStart: "22:00", quietEnd: "07:00" };

function event(partial: Partial<NowEvent> & Pick<NowEvent, "id" | "time">): NowEvent {
  return {
    title: "Groceries",
    date: "2026-11-13",
    tag: "home",
    color: "teal",
    done: false,
    nudges: { day: false, hour: true, ten: true, now: true },
    schedule: "fixed",
    ...partial,
  };
}

describe("be here now", () => {
  it("puts the reassurance on the start reminder and names the next item", () => {
    const now = new Date(2026, 10, 13, 9, 0, 0);
    const plan = planReminders({
      now,
      locale: "en",
      prefs,
      events: [event({ id: "now", time: "15:00" }), event({ id: "later", title: "Groceries", time: "17:00" })],
    });
    const start = plan.find((item) => item.key.startsWith("nudge:now:now:"));
    expect(start?.body).toMatch(/Just this one thing|Stay with this|whole job/);
    expect(start?.body).toContain("Next up: Groceries at");
    expect(plan.find((item) => item.key.startsWith("nudge:now:hour:"))?.body).not.toContain("Next up");
    const quiet = planReminders({
      now: new Date(2026, 10, 13, 22, 30, 0),
      locale: "en",
      prefs: { ...prefs, quietHours: true },
      events: [event({ id: "late", time: "23:00" })],
    });
    expect(quiet.some((item) => item.key.startsWith("nudge:late:now:"))).toBe(false);
  });

  it("rotates warm lines", () => {
    const first = presenceCopy("en", "a", null);
    const second = presenceCopy("en", "b", null);
    expect(first.length).toBeGreaterThan(10);
    expect([first, second].some((line) => line.includes("one thing") || line.includes("Stay with this") || line.includes("whole job"))).toBe(true);
  });
});

describe("missed tasks", () => {
  const now = new Date(2026, 10, 13, 16, 0, 0);

  it("asks after the timeframe and leaves unscheduled items alone", () => {
    const timed = event({ id: "a", time: "15:00", duration: 30 });
    const open = event({ id: "b", time: "18:00" });
    const bare = event({ id: "c", time: "" });
    expect(taskAskState(timed, now)).toBe("ask");
    expect(taskAskState(open, now)).toBe("upcoming");
    expect(taskAskState({ ...timed, done: true }, now)).toBe("done");
    expect(taskAskState({ ...timed, missed: "no" }, now)).toBe("no");
    expect(taskAskState(bare, now)).toBe("open");
  });

  it("fills the bar at quiet-hours start while keeping the real count", () => {
    const today = [event({ id: "a", time: "09:00", done: true }), event({ id: "b", time: "10:00" }), event({ id: "c", time: "11:00", missed: "no" })];
    const during = dayProgress(today, new Date(2026, 10, 13, 15, 0, 0), prefs);
    expect(during).toEqual({ done: 1, total: 3, fill: 1 / 3 });
    const resting = dayProgress(today, new Date(2026, 10, 13, 22, 0, 0), { ...prefs, quietHours: true });
    expect(resting.done).toBe(1);
    expect(resting.total).toBe(3);
    expect(resting.fill).toBe(1);
    expect(dayIsResting(new Date(2026, 10, 13, 21, 0, 0), { ...prefs, quietHours: true })).toBe(false);
    expect(dayIsResting(new Date(2026, 10, 13, 23, 30, 0), prefs)).toBe(false);
  });

  it("keeps a fixed miss unfinished and adds one new time, even from a series", () => {
    const missed = event({ id: "fixed", time: "14:00", seriesId: "series", occurrenceKey: "2026-11-13", duration: 30 });
    const slot = followUpWhen(new Date(2026, 10, 13, 16, 0, 0), "tomorrow", missed.time);
    expect(slot).toEqual({ date: "2026-11-14", time: "14:00" });
    const copy = freshOccurrence(missed, { ...followUpWhen(new Date(2026, 10, 13), "week", "14:00"), duration: 30 }, "new");
    expect(copy.date).toBe("2026-11-20");
    expect(copy.seriesId).toBeUndefined();
    expect(copy.done).toBe(false);
    expect(copy.missed).toBeUndefined();
    expect(missed.seriesId).toBe("series");
    const still = taskAskState({ ...missed, missed: "no" }, now);
    expect(still).toBe("no");
    const progress = dayProgress([{ ...missed, missed: "no" }, copy], now, prefs);
    expect(progress.done).toBe(0);
    expect(progress.total).toBe(2);
  });
});

describe("new today copy", () => {
  it("is distinct in both Spanish variants", () => {
    for (const key of ["today.progress", "today.ask", "presence.1", "miss.1", "today.pickWhen", "today.rescheduleAsk"] as const) {
      expect(messages["es-419"][key]).toBeTruthy();
      expect(messages["es-ES"][key]).toBeTruthy();
      expect(messages["es-419"][key]).not.toBe(messages["es-ES"][key]);
      expect(`${messages["es-419"][key]}\n${messages["es-ES"][key]}`).not.toMatch(/vistazo|jalón|tirón/i);
    }
  });
});
