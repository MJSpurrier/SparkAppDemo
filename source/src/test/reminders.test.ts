import { describe, expect, it } from "vitest";

import { makeOccurrence } from "@/lib/nowmode/recurrence";
import {
  catalogSound,
  nativeSoundFile,
  planReminders,
  reconcileReminders,
  type PlannedNotification,
} from "@/lib/nowmode/reminders";
import type { NowEvent, Prefs, RecurrenceRule } from "@/lib/nowmode/types";
import { isNewerVersion, remoteVersion } from "@/lib/nowmode/updates";
import { pushShouldStart } from "@/lib/nowmode/push-gate";
import { APP_VERSION } from "@/lib/nowmode/version";

const prefs: Prefs = {
  layeredNudges: true,
  focusReminders: true,
  quietHours: false,
  nudgeDefaults: { day: false, hour: true, ten: true, now: true },
};

function event(partial: Partial<NowEvent> & Pick<NowEvent, "id" | "time">): NowEvent {
  return {
    title: "Guitar",
    date: "2026-11-12",
    tag: "play",
    color: "teal",
    done: false,
    nudges: { day: false, hour: true, ten: true, now: true },
    schedule: "flexible",
    ...partial,
  };
}

function keys(plan: PlannedNotification[], kind?: PlannedNotification["kind"]) {
  return plan.filter((item) => !kind || item.kind === kind).map((item) => item.key);
}

describe("native reminder plan", () => {
  const now = new Date(2026, 10, 12, 9, 0, 0);

  it("schedules the allowed layers and skips past ones", () => {
    const plan = planReminders({
      now,
      locale: "en",
      prefs,
      events: [event({ id: "g", time: "15:00", duration: 60 })],
    });
    const nudges = plan.filter((item) => item.kind === "nudge");
    expect(nudges.map((item) => item.key.split(":")[2])).toEqual(["hour", "ten", "now"]);
    expect(nudges.every((item) => item.at > now.getTime())).toBe(true);
    expect(nudges[0].body).toContain("Guitar");
    expect(plan.some((item) => item.kind === "alarm" && item.key.startsWith("alarm:event:g:"))).toBe(true);
  });

  it("does not change the saved events", () => {
    const events = [event({ id: "g", time: "15:00" })];
    const before = JSON.stringify(events);
    planReminders({ now, locale: "en", prefs, events });
    expect(JSON.stringify(events)).toBe(before);
  });

  it("drops finished events, quiet times, and a deleted event on the next plan", () => {
    const quiet: Prefs = { ...prefs, quietHours: true, quietStart: "14:45", quietEnd: "16:00" };
    const live = event({ id: "g", time: "15:00", duration: 30 });
    const during = planReminders({ now, locale: "es-419", prefs: quiet, events: [live, { ...live, id: "done", done: true }] });
    expect(during.some((item) => item.key.includes(":now:"))).toBe(false);
    expect(during.some((item) => item.key.includes("done"))).toBe(false);
    expect(during.some((item) => item.key.startsWith("alarm:event:g:"))).toBe(false);
    const hour = during.find((item) => item.key.includes(":hour:"));
    expect(hour).toBeTruthy();
    expect(hour?.body).toContain("Guitar");

    const removed = planReminders({ now, locale: "en", prefs, events: [] });
    const diff = reconcileReminders(during, removed);
    expect(diff.cancel.map((item) => item.id)).toEqual(during.map((item) => item.id));
    expect(diff.schedule.every((item) => item.kind === "checkin")).toBe(true);
  });

  it("cancels the old time and schedules the new one when an event moves", () => {
    const first = planReminders({ now, locale: "en", prefs, events: [event({ id: "g", time: "15:00" })] });
    const moved = planReminders({ now, locale: "en", prefs, events: [event({ id: "g", time: "18:00" })] });
    const diff = reconcileReminders(first, moved);
    expect(diff.cancel.length).toBeGreaterThan(0);
    expect(diff.schedule.every((item) => item.key.includes(":18")) || diff.schedule.length > 0).toBe(true);
    expect(moved.some((item) => item.at === new Date(2026, 10, 12, 18, 0, 0).getTime())).toBe(true);
    expect(first.some((item) => item.at === moved.find((next) => next.kind === "nudge" && next.key.includes(":now:"))?.at)).toBe(false);
  });

  it("includes a recurring occurrence and the daily review, unless review is inside quiet hours", () => {
    const rule: RecurrenceRule = {
      id: "series",
      freq: "daily",
      weekdays: [],
      monthDays: [],
      customBy: "weekdays",
      start: "2026-11-12",
      time: "11:00",
      schedule: "fixed",
      title: "Meds",
      tag: "health",
      color: "green",
      nudges: { day: false, hour: true, ten: false, now: true },
      skips: [],
    };
    const occurrence = makeOccurrence(rule, "2026-11-12");
    const plan = planReminders({
      now,
      locale: "es-ES",
      prefs: { ...prefs, boardReviewOn: true, boardReviewManual: true, boardReviewTime: "20:30" },
      events: [occurrence],
    });
    expect(plan.some((item) => item.key.startsWith("nudge:occ-series-2026-11-12:now:"))).toBe(true);
    expect(plan.some((item) => item.kind === "review")).toBe(true);

    const silenced = planReminders({
      now,
      locale: "en",
      prefs: {
        ...prefs,
        boardReviewOn: true,
        boardReviewManual: true,
        boardReviewTime: "23:00",
        quietHours: true,
        quietStart: "22:00",
        quietEnd: "07:00",
      },
      events: [],
    });
    expect(silenced.some((item) => item.kind === "review")).toBe(false);
  });

  it("uses a catalog sound, and the phone default for an imported file", () => {
    expect(catalogSound("bell")).toBe("bell");
    expect(catalogSound("custom")).toBeNull();
    expect(catalogSound(undefined)).toBeNull();
    expect(nativeSoundFile("android", "bell")).toBe("bell.wav");
    expect(nativeSoundFile("ios", "bell")).toBe("bell.wav");
    expect(nativeSoundFile("android", null)).toBeUndefined();
    const custom = planReminders({
      now,
      locale: "en",
      prefs: { ...prefs, alarmSound: "custom" },
      focus: { running: true, endsAt: now.getTime() + 25 * 60_000, label: "Essay" },
      events: [],
    });
    const alarms = custom.filter((item) => item.kind === "alarm");
    expect(alarms).toHaveLength(1);
    expect(alarms[0].sound).toBeNull();
    expect(alarms[0].body).toContain("Essay");

    const quietFocus = planReminders({
      now: new Date(2026, 10, 12, 23, 0, 0),
      locale: "en",
      prefs: { ...prefs, quietHours: true, quietStart: "22:00", quietEnd: "07:00", alarmSound: "bowl" },
      focus: { running: true, endsAt: new Date(2026, 10, 12, 23, 20, 0).getTime(), label: "Essay" },
      events: [],
    });
    expect(quietFocus.some((item) => item.kind === "alarm")).toBe(false);
  });

  it("keeps only the soonest reminders when the list is full", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      event({ id: `e${i}`, time: `${String(10 + i).padStart(2, "0")}:00`, date: "2026-11-12" }),
    );
    const plan = planReminders({ now, locale: "en", prefs, events, limit: 3 });
    expect(plan).toHaveLength(3);
    expect(plan.map((item) => item.at)).toEqual([...plan].sort((a, b) => a.at - b.at).map((item) => item.at));
  });
});

describe("update check and push gate", () => {
  it("notices a newer published version and ignores the same or older one", () => {
    expect(APP_VERSION).toBe("1.0.0");
    expect(isNewerVersion("1.0.1", "1.0.0")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.0.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("0.9.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("nope", "1.0.0")).toBe(false);
    expect(remoteVersion({ version: "1.2.0", android: "1.3.0" }, "android")).toBe("1.3.0");
    expect(remoteVersion({ version: "1.2.0" }, "ios")).toBe("1.2.0");
    expect(remoteVersion(null, "web")).toBeNull();
  });

  it("leaves push inert until a native config exists", () => {
    expect(pushShouldStart(false, false)).toBe(false);
    expect(pushShouldStart(true, false)).toBe(false);
    expect(pushShouldStart(false, true)).toBe(false);
    expect(pushShouldStart(true, true)).toBe(true);
  });
});
