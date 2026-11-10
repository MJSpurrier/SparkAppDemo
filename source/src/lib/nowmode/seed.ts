import { addDays, toDateKey, uid } from "./logic";
import { defaultFocus } from "./schedule";
import type { AppState, EventColor, NowEvent, ScheduleType } from "./types";

const nudgesOn = { day: false, hour: true, ten: true, now: true };

function ev(
  date: Date,
  time: string,
  title: string,
  tag: string,
  color: EventColor,
  duration: number,
  schedule: ScheduleType,
  extra: Partial<NowEvent> = {},
): NowEvent {
  return {
    id: uid(),
    title,
    date: toDateKey(date),
    time,
    duration,
    tag,
    color,
    done: false,
    nudges: { ...nudgesOn },
    schedule,
    ...extra,
  };
}

/** A brand-new native install. No sample tasks, notes, wins, or history. */
export function createEmpty(now = new Date()): AppState {
  void now;
  return {
    version: 1,
    events: [],
    cards: [],
    links: [],
    prefs: { layeredNudges: true, focusReminders: true, quietHours: false },
    energy: null,
    wins: [],
    focus: defaultFocus(),
    firedNudges: [],
    series: [],
  };
}

/**
 * A saved blob always wins, on the phone and on the website.
 * Only a visit with nothing stored yet gets a fresh state: empty on native, demo on the Pages tester.
 */
export function stateForVisit(saved: AppState | null, native: boolean, now = new Date()): AppState {
  if (saved) return saved;
  return native ? createEmpty(now) : createSeed(now);
}

export function createSeed(now = new Date()): AppState {
  const today = now;
  const d = (n: number) => addDays(today, n);

  const events: NowEvent[] = [
    ev(today, "08:30", "Morning meds", "Health", "green", 5, "fixed", { done: true }),
    ev(today, "14:00", "Draft product brief", "Work", "blue", 25, "flexible", {
      steps: [
        { id: uid(), title: "Open the doc & paste last week's notes", done: false },
        { id: uid(), title: "Write the problem in 3 sentences", done: false },
        { id: uid(), title: "List 3 must-haves, then stop", done: false },
      ],
    }),
    ev(today, "14:30", "Walk + voice dump", "Move", "teal", 20, "flexible"),
    ev(today, "17:00", "Meds + water reset", "Health", "coral", 5, "fixed"),
    ev(d(1), "10:00", "Dentist (bring card)", "Errand", "coral", 45, "fixed"),
    ev(d(1), "16:00", "Reply to Sam's email", "Work", "blue", 15, "flexible"),
    ev(d(2), "09:00", "Grocery run — list on board", "Home", "teal", 30, "flexible"),
    ev(d(4), "19:00", "Game night at Jo's", "Joy", "green", 120, "fixed"),
    ev(d(6), "11:00", "Sketch v2 onboarding", "Work", "blue", 25, "flexible"),
    ev(d(6), "15:00", "Laundry: just wash", "Home", "teal", 10, "flexible"),
    ev(d(-2), "13:00", "Therapy", "Health", "green", 50, "fixed", { done: true }),
    ev(d(-4), "10:30", "Kickoff call", "Work", "blue", 30, "fixed", { done: true }),
  ];

  const c1 = uid();
  const c2 = uid();
  const c3 = uid();
  const c4 = uid();
  const c5 = uid();

  return {
    version: 1,
    events,
    cards: [
      { id: c1, kind: "text", text: "App idea: ADHD as superpower", x: 22, y: 28 },
      { id: c2, kind: "voice", text: "0:42 brain dump", x: 196, y: 68 },
      { id: c3, kind: "photo", text: "Sticky notes from desk", x: 24, y: 160 },
      { id: c4, kind: "text", text: "Competitors: Tiimo, Goblin…", x: 196, y: 214 },
      { id: c5, kind: "text", text: "MVP: capture → today → focus", x: 104, y: 320 },
    ],
    links: [
      { id: uid(), from: c1, to: c2 },
      { id: uid(), from: c1, to: c3 },
      { id: uid(), from: c3, to: c4 },
      { id: uid(), from: c2, to: c4 },
      { id: uid(), from: c4, to: c5 },
    ],
    prefs: { layeredNudges: true, focusReminders: true, quietHours: false },
    energy: "high",
    wins: [{ id: uid(), date: toDateKey(today), label: "Morning meds" }],
    focus: {
      presetId: "study",
      label: "Draft product brief",
      totalSec: 25 * 60,
      remainingSec: 25 * 60,
      running: false,
      endsAt: null,
      eventId: events[1]?.id ?? null,
      bodyDouble: false,
      twoMinNotified: false,
      finished: false,
      customMin: 10,
      alarmedAt: null,
      linkedToBlock: false,
      endPromptFor: null,
    },
    firedNudges: [],
  };
}