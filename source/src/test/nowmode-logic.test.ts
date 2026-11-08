import { describe, expect, it } from "vitest";

import { countByDate, nextUp, parseCapture, parseTime, splitIntoSteps, toggleStep } from "@/lib/nowmode/logic";
import type { NowEvent } from "@/lib/nowmode/types";

const base: NowEvent = {
  id: "a",
  title: "Draft brief",
  date: "2026-11-08",
  time: "14:00",
  duration: 25,
  tag: "Work",
  color: "blue",
  done: false,
  nudges: { day: false, hour: true, ten: true, now: true },
};

describe("parseTime", () => {
  it("turns 3pm into 15:00", () => {
    expect(parseTime("Call mom 3pm")).toBe("15:00");
  });
  it("handles minutes and am", () => {
    expect(parseTime("standup at 9:30am")).toBe("09:30");
  });
  it("handles 12am as midnight", () => {
    expect(parseTime("sleep 12am")).toBe("00:00");
  });
  it("returns null when there is no time", () => {
    expect(parseTime("buy oat milk")).toBeNull();
  });
});

describe("parseCapture", () => {
  it("strips the time and tomorrow from the title", () => {
    expect(parseCapture("pay rent tomorrow at 10am")).toEqual({ title: "Pay rent", time: "10:00", dayOffset: 1 });
  });
});

describe("split task", () => {
  it("creates exactly 3 micro-steps", () => {
    expect(splitIntoSteps("Draft brief")).toHaveLength(3);
  });
  it("marks the parent done once all steps are done", () => {
    let ev: NowEvent = { ...base, steps: splitIntoSteps(base.title) };
    ev = toggleStep(ev, ev.steps![0]!.id);
    ev = toggleStep(ev, ev.steps![1]!.id);
    expect(ev.done).toBe(false);
    ev = toggleStep(ev, ev.steps![2]!.id);
    expect(ev.done).toBe(true);
  });
});

describe("today + calendar", () => {
  const events: NowEvent[] = [
    { ...base, id: "1", time: "08:30", done: true },
    { ...base, id: "2", time: "14:30" },
    { ...base, id: "3", time: "11:00" },
    { ...base, id: "4", date: "2026-11-09" },
  ];
  it("Up Next is the earliest unfinished event today", () => {
    expect(nextUp(events, "2026-11-08")?.id).toBe("3");
  });
  it("counts events per day for calendar badges", () => {
    expect(countByDate(events)).toEqual({ "2026-11-08": 3, "2026-11-09": 1 });
  });
});