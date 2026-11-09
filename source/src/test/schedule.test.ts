import { describe, expect, it } from "vitest";

import {
  applyReschedule,
  clearFiredFor,
  conflictMessage,
  defaultFocus,
  fixedConflict,
  focusSwitchGate,
  migrateAppState,
  parseMinutesInput,
  planBlockTimer,
  planExtension,
  rangesOverlap,
  validateSlot,
} from "@/lib/nowmode/schedule";
import type { NowEvent } from "@/lib/nowmode/types";

const nudges = { day: false, hour: true, ten: true, now: true };

function ev(partial: Partial<NowEvent> & Pick<NowEvent, "id" | "time">): NowEvent {
  return {
    title: "Block",
    date: "2026-11-08",
    duration: 60,
    tag: "Play",
    color: "teal",
    done: false,
    nudges,
    schedule: "flexible",
    ...partial,
  };
}

describe("planBlockTimer", () => {
  it("counts down to the block end instead of starting another full hour midway", () => {
    const block = ev({ id: "g", title: "Guitar practice", time: "14:00", duration: 60 });
    const plan = planBlockTimer(block, new Date(2026, 10, 8, 14, 20, 0));
    expect(plan.ended).toBe(false);
    expect(plan.remainingSec).toBe(40 * 60);
    expect(plan.remainingSec).not.toBe(60 * 60);
    expect(new Date(plan.endsAt).getHours()).toBe(15);
    expect(new Date(plan.endsAt).getMinutes()).toBe(0);
  });
});

describe("planExtension", () => {
  const guitar = ev({ id: "g", title: "Guitar practice", time: "14:00", duration: 60 });

  it("adds onto the scheduled end while the block is still running", () => {
    const result = planExtension(guitar, 15, new Date(2026, 10, 8, 14, 20, 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const end = new Date(result.plan.endMs);
    expect(end.getHours()).toBe(15);
    expect(end.getMinutes()).toBe(15);
    expect(result.plan.duration).toBe(75);
  });

  it("starts extra time from now when the block has already ended", () => {
    const result = planExtension(guitar, 15, new Date(2026, 10, 8, 15, 10, 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const end = new Date(result.plan.endMs);
    expect(end.getHours()).toBe(15);
    expect(end.getMinutes()).toBe(25);
    expect(result.plan.duration).toBe(85);
  });

  it("rejects zero, fractions, and runs past midnight", () => {
    expect(parseMinutesInput("0").ok).toBe(false);
    expect(parseMinutesInput("10.5").ok).toBe(false);
    expect(parseMinutesInput("-5").ok).toBe(false);
    expect(parseMinutesInput("10")).toEqual({ ok: true, minutes: 10 });
    const late = ev({ id: "late", time: "23:30", duration: 20 });
    const past = planExtension(late, 30, new Date(2026, 10, 8, 23, 40, 0));
    expect(past.ok).toBe(false);
    if (past.ok) return;
    expect(past.message).toMatch(/midnight/i);
  });
});

describe("fixed conflict boundaries", () => {
  const meeting = ev({
    id: "m",
    title: "Dentist",
    time: "15:30",
    duration: 45,
    schedule: "fixed",
    tag: "Errand",
    color: "coral",
  });
  const now = new Date(2026, 10, 8, 14, 0, 0).getTime();

  function range(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const a = new Date(2026, 10, 8, sh, sm, 0).getTime();
    const b = new Date(2026, 10, 8, eh, em, 0).getTime();
    return fixedConflict([meeting], "g", a, b, now);
  }

  it("treats an exact touch as free and one overlapping minute as a conflict", () => {
    expect(rangesOverlap(0, 10, 10, 20)).toBe(false);
    expect(rangesOverlap(0, 11, 10, 20)).toBe(true);
    expect(range("14:00", "15:30")).toBeNull();
    expect(range("15:30", "16:00")).not.toBeNull();
    expect(range("14:00", "15:31")?.id).toBe("m");
    expect(range("16:15", "17:00")).toBeNull();
  });

  it("ignores done fixed events and other flexible blocks", () => {
    const done = { ...meeting, done: true };
    const flex = { ...meeting, id: "f2", schedule: "flexible" as const };
    const start = new Date(2026, 10, 8, 15, 0, 0).getTime();
    const end = new Date(2026, 10, 8, 16, 0, 0).getTime();
    expect(fixedConflict([done], "g", start, end, now)).toBeNull();
    expect(fixedConflict([flex], "g", start, end, now)).toBeNull();
    expect(conflictMessage(meeting)).toMatch(/Dentist/);
    expect(conflictMessage(meeting)).toMatch(/3:30 PM/);
  });
});

describe("reschedule", () => {
  it("moves the same event to another day and keeps identity, type, and completion", () => {
    const original = ev({
      id: "keep",
      title: "Dentist (bring card)",
      time: "10:00",
      duration: 45,
      schedule: "fixed",
      done: true,
      tag: "Errand",
      color: "coral",
      steps: [{ id: "s", title: "Bring card", done: false }],
    });
    const next = applyReschedule(original, { date: "2026-11-10", time: "09:30", duration: 45, schedule: "fixed" });
    expect(next.id).toBe("keep");
    expect(next.title).toBe("Dentist (bring card)");
    expect(next.done).toBe(true);
    expect(next.schedule).toBe("fixed");
    expect(next.tag).toBe("Errand");
    expect(next.steps).toEqual(original.steps);
    expect(next.date).toBe("2026-11-10");
    expect(next.time).toBe("09:30");
    expect(clearFiredFor(["keep:now", "keep:hour", "other:now"], "keep")).toEqual(["other:now"]);
  });

  it("rejects a slot that crosses midnight", () => {
    expect(validateSlot({ date: "2026-11-08", time: "23:30", duration: 60 }).ok).toBe(false);
    expect(validateSlot({ date: "2026-02-31", time: "09:00", duration: 30 }).ok).toBe(false);
    expect(validateSlot({ date: "2026-11-10", time: "09:30", duration: 45 }).ok).toBe(true);
  });
});

describe("migration", () => {
  it("keeps saved events and notes and defaults missing schedule to fixed", () => {
    const saved = {
      version: 1 as const,
      events: [
        {
          id: "u1",
          title: "Therapy notes",
          date: "2026-11-01",
          time: "09:00",
          duration: 50,
          tag: "Health",
          color: "green" as const,
          done: true,
          nudges,
        },
        {
          id: "u2",
          title: "Guitar",
          date: "2026-11-01",
          time: "14:00",
          duration: 60,
          tag: "Play",
          color: "teal" as const,
          done: false,
          nudges,
          schedule: "flexible" as const,
        },
      ],
      cards: [{ id: "c", kind: "text" as const, text: "keep me", x: 1, y: 2 }],
      links: [{ id: "l", from: "c", to: "c" }],
      wins: [{ id: "w", date: "2026-11-01", label: "Therapy notes" }],
      prefs: { layeredNudges: false, focusReminders: true, quietHours: true },
      energy: "low" as const,
      focus: defaultFocus({ label: "Therapy notes", remainingSec: 40, totalSec: 100, running: true, endsAt: Date.now() + 40_000 }),
      firedNudges: ["u1:hour"],
    };
    const next = migrateAppState(saved);
    expect(next).not.toBeNull();
    if (!next) return;
    expect(next.events.map((e) => e.id)).toEqual(["u1", "u2"]);
    expect(next.events[0]?.schedule).toBe("fixed");
    expect(next.events[1]?.schedule).toBe("flexible");
    expect(next.events.some((e) => e.title === "Draft product brief")).toBe(false);
    expect(next.cards[0]?.text).toBe("keep me");
    expect(next.links).toHaveLength(1);
    expect(next.wins[0]?.label).toBe("Therapy notes");
    expect(next.prefs.quietHours).toBe(true);
    expect(next.prefs.layeredNudges).toBe(false);
    expect(next.energy).toBe("low");
    expect(next.firedNudges).toEqual(["u1:hour"]);
    expect(next.focus.label).toBe("Therapy notes");
    expect(next.focus.running).toBe(true);
  });

  it("does not chime again for a linked block that already ended while the app was closed", () => {
    const saved = {
      version: 1 as const,
      events: [ev({ id: "g", title: "Guitar practice", time: "14:00", duration: 60 })],
      cards: [],
      focus: defaultFocus({
        eventId: "g",
        linkedToBlock: true,
        running: true,
        label: "Guitar practice",
        endsAt: new Date(2026, 10, 8, 15, 0, 0).getTime(),
        totalSec: 3600,
        remainingSec: 10,
      }),
    };
    const now = new Date(2026, 10, 8, 15, 10, 0).getTime();
    const next = migrateAppState(saved, now);
    expect(next?.focus.running).toBe(false);
    expect(next?.focus.finished).toBe(false);
    expect(next?.focus.alarmedAt).toBe(new Date(2026, 10, 8, 15, 0, 0).getTime());
    expect(next?.focus.endPromptFor).toBe(next?.focus.alarmedAt);
    expect(next?.events[0]?.done).toBe(false);
  });

  it("returns null for anything that is not a nowmode-v1 save", () => {
    expect(migrateAppState(null)).toBeNull();
    expect(migrateAppState({ version: 2 })).toBeNull();
  });
});

describe("focus switch", () => {
  it("asks before replacing a different running session", () => {
    const running = defaultFocus({ running: true, eventId: "other", label: "Study", linkedToBlock: false });
    expect(focusSwitchGate(running, "g")).toBe("confirm");
    expect(focusSwitchGate(running, "other")).toBe("same");
    expect(focusSwitchGate(defaultFocus({ eventId: "g" }), "g")).toBe("start");
  });
});
