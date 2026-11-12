import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import {
  boardReviewPlannedOn,
  checkInClock,
  checkInFire,
  checkInMoment,
  cheerIndex,
  extendGoalDue,
  goalCountdown,
  goalReminderAt,
  goalsInView,
  overdueGoals,
} from "@/lib/nowmode/goals";
import { planReminders } from "@/lib/nowmode/reminders";
import { migrateAppState } from "@/lib/nowmode/schedule";
import type { Goal, Prefs } from "@/lib/nowmode/types";

const prefs: Prefs = { layeredNudges: true, focusReminders: true, quietHours: false, quietStart: "22:00", quietEnd: "07:00" };

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "title">): Goal {
  return { done: false, ...partial };
}

describe("Tuesday and Saturday check-in", () => {
  it("lands 30 minutes before quiet hours and skips a day that already has a Board review", () => {
    const tuesday = new Date(2026, 10, 10, 12, 0, 0);
    expect(tuesday.getDay()).toBe(2);
    expect(checkInClock(prefs)).toBe("21:30");
    expect(checkInMoment(prefs, tuesday)?.getHours()).toBe(21);
    expect(checkInMoment(prefs, new Date(2026, 10, 12))).toBeNull();

    const withReview: Prefs = { ...prefs, boardReviewOn: true };
    expect(boardReviewPlannedOn(withReview, tuesday)).toBe(true);
    expect(checkInMoment(withReview, tuesday)).toBeNull();

    const quietReview: Prefs = {
      ...prefs,
      boardReviewOn: true,
      boardReviewManual: true,
      boardReviewTime: "07:00",
      quietHours: true,
      quietStart: "06:00",
      quietEnd: "10:00",
    };
    expect(boardReviewPlannedOn(quietReview, tuesday)).toBe(false);
    expect(checkInMoment(quietReview, tuesday)?.getHours()).toBe(5);
  });

  it("is in the closed-app plan on Tuesday and Saturday, and leaves when the Board review is on", () => {
    const now = new Date(2026, 10, 12, 9, 0, 0);
    const open = planReminders({ now, locale: "en", prefs, events: [] });
    const days = open.filter((item) => item.kind === "checkin").map((item) => new Date(item.at).getDate());
    expect(days).toEqual([14, 17, 21, 24]);
    expect(open.find((item) => item.kind === "checkin")?.body).toBe(messages.en["checkin.body"]);

    const blocked = planReminders({ now, locale: "en", prefs: { ...prefs, boardReviewOn: true }, events: [] });
    expect(blocked.some((item) => item.kind === "checkin")).toBe(false);
    expect(blocked.some((item) => item.kind === "review")).toBe(true);
  });

  it("fires on the web only inside the five-minute window", () => {
    const at = new Date(2026, 10, 14, 21, 32, 0);
    expect(checkInFire(at, prefs, []).notify).toBe(true);
    expect(checkInFire(new Date(2026, 10, 14, 21, 40, 0), prefs, []).record).toBe(false);
    expect(checkInFire(at, prefs, [`checkin:2026-11-14:21:30`]).record).toBe(false);
  });
});

describe("goals", () => {
  const today = "2026-11-12";

  it("counts gently and keeps overdue plus undated goals with the visible month", () => {
    expect(goalCountdown("2026-11-17", today)).toEqual({ key: "goal.days", n: 5 });
    expect(goalCountdown(today, today)).toEqual({ key: "goal.today" });
    expect(goalCountdown("2026-11-10", today)).toEqual({ key: "goal.past", n: 2 });
    expect(goalCountdown(undefined, today)).toEqual({ key: "goal.whenever" });

    const listed = goalsInView(
      [
        goal({ id: "soon", title: "Form", due: "2026-11-20" }),
        goal({ id: "late", title: "Call", due: "2026-11-01" }),
        goal({ id: "open", title: "Someday" }),
        goal({ id: "next", title: "December", due: "2026-12-02" }),
        goal({ id: "done", title: "Sent", due: "2026-11-03", done: true, doneOn: "2026-11-03" }),
      ],
      2026,
      10,
      today,
    );
    expect(listed.map((item) => item.id)).toEqual(["late", "soon", "open", "done"]);
  });

  it("reminds the day before, then offers done or a later date", () => {
    const when = goalReminderAt("2026-11-20");
    expect(when?.getDate()).toBe(19);
    expect(when?.getHours()).toBe(9);
    const now = new Date(2026, 10, 12, 9, 0, 0);
    const plan = planReminders({
      now,
      locale: "es-ES",
      prefs,
      events: [],
      goals: [goal({ id: "g", title: "Enviar", due: "2026-11-20" }), goal({ id: "done", title: "Hecho", due: "2026-11-18", done: true })],
    });
    expect(plan.filter((item) => item.kind === "goal").map((item) => item.key)).toEqual(["goal:g:2026-11-20"]);
    expect(plan.find((item) => item.kind === "goal")?.body).toContain("Enviar");

    const late = overdueGoals([goal({ id: "g", title: "Form", due: "2026-11-12" })], today);
    expect(late).toHaveLength(1);
    const moved = extendGoalDue(new Date(2026, 10, 12), "week");
    expect(moved).toBe("2026-11-19");
    expect(extendGoalDue(new Date(2026, 10, 12), "tomorrow")).toBe("2026-11-13");
    expect(cheerIndex("g", moved, 3)).toBeGreaterThanOrEqual(0);
    expect(cheerIndex("g", moved, 3)).toBeLessThan(3);
  });

  it("keeps an older save and adds an empty goal list", () => {
    const saved = migrateAppState({
      version: 1,
      events: [{ id: "keep", title: "Mine", date: "2026-11-10", time: "09:00" }],
      wins: [{ id: "w", label: "Certificate", date: "2026-11-02", kind: "big" }],
      prefs: { layeredNudges: true, focusReminders: true, quietHours: true, username: "ada" },
    });
    expect(saved?.events[0]?.title).toBe("Mine");
    expect(saved?.wins[0]?.kind).toBe("big");
    expect(saved?.prefs.username).toBe("ada");
    expect(saved?.goals).toEqual([]);
  });
});

describe("goal copy", () => {
  it("is present in both Spanish variants", () => {
    for (const key of ["checkin.body", "goal.days", "goal.promptBody", "goal.cheer1", "capture.goal"] as const) {
      expect(messages["es-419"][key]).toBeTruthy();
      expect(messages["es-ES"][key]).toBeTruthy();
      expect(messages["es-419"][key]).not.toBe(messages["es-ES"][key]);
      expect(`${messages["es-419"][key]}\n${messages["es-ES"][key]}`).not.toMatch(/vistazo|jalón|tirón/i);
    }
  });
});
