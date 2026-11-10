export type EventColor = "blue" | "teal" | "green" | "coral";
export type Energy = "low" | "okay" | "high";
export type CardKind = "text" | "voice" | "photo";
/** Flexible blocks can run long with the timer. Fixed stays put unless you reschedule it. */
export type ScheduleType = "flexible" | "fixed";

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export interface Nudges {
  day: boolean;
  hour: boolean;
  ten: boolean;
  now: boolean;
}

export interface NowEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD (local) */
  date: string;
  /** HH:MM 24h */
  time: string;
  /** Minutes. Missing means a time-only task: no countdown and no overlap. */
  duration?: number;
  tag: string;
  color: EventColor;
  done: boolean;
  steps?: Step[];
  nudges: Nudges;
  /**
   * Flexible: a block the timer can extend (guitar 14:00–15:00).
   * Fixed: an appointment that is never auto-moved.
   * Missing on older saves is treated as fixed.
   */
  schedule: ScheduleType;
  /** Series this event was generated from. Missing means a one-off. */
  seriesId?: string;
  /** Original series date (YYYY-MM-DD). Stays put if this one time is moved. */
  occurrenceKey?: string;
  /** Edited on its own, so a series change does not overwrite it. */
  exception?: boolean;
  /** Board note this event was scheduled from. The note itself stays on the Board. */
  sourceCardId?: string;
}

export interface BoardCard {
  id: string;
  kind: CardKind;
  text: string;
  x: number;
  y: number;
  /** data URL for photo cards. TODO: OCR / AI parsing of the image later. */
  image?: string;
}

export interface BoardLink {
  id: string;
  from: string;
  to: string;
}

export interface Prefs {
  layeredNudges: boolean;
  focusReminders: boolean;
  quietHours: boolean;
  /** Saved language. Missing means follow the browser, with English as the fallback. */
  locale?: "en" | "es-419" | "es-ES";
  /** Master filter for which nudge layers may fire. Per-event switches still apply inside this. */
  nudgeDefaults?: Nudges;
  /** Minutes before a focus timer ends to show the soft landing warning. */
  focusLeadMin?: number;
  /** Local HH:MM. A later end than start is the same day; an earlier end crosses midnight. */
  quietStart?: string;
  quietEnd?: string;
  themeMode?: "light" | "dark";
  palette?: "ocean" | "lavender" | "forest";
  /** Display name chosen by the person. Never translated. */
  username?: string;
  /** Legal or everyday name, shown under the username. Never translated. */
  realName?: string;
  /** Compressed data URL, this device only. */
  avatar?: string;
  /** Which saved name the Today greeting uses. */
  greetAs?: "username" | "realName";
  /** Daily Board review. Off until the person turns it on. */
  boardReviewOn?: boolean;
  /** Set only after they pick a clock time. Otherwise the time stays 90 minutes before quiet hours start. */
  boardReviewTime?: string;
  boardReviewManual?: boolean;
  /** Built-in sound id, or "custom" for an imported file. */
  alarmSound?: string;
  /** 0–100. Missing means 60. */
  alarmVolume?: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "custom";

export interface RecurrenceRule {
  id: string;
  freq: RecurrenceFreq;
  /** 0 Sunday … 6 Saturday. */
  weekdays: number[];
  /** 1–31. A month that lacks the date is skipped, not shifted. */
  monthDays: number[];
  /** Custom series pick weekdays or dates of the month, not both. */
  customBy: "weekdays" | "monthDays";
  /** Inclusive YYYY-MM-DD. */
  start: string;
  /** Inclusive YYYY-MM-DD. Missing means no end. */
  end?: string;
  /** Wall-clock HH:MM. Not an absolute instant, so daylight saving does not move it. */
  time: string;
  duration?: number;
  schedule: ScheduleType;
  title: string;
  tag: string;
  color: EventColor;
  nudges: Nudges;
  /** Dates removed on purpose. They are not generated again. */
  skips: string[];
  sourceCardId?: string;
}

export interface Win {
  id: string;
  date: string;
  label: string;
  /** Missing on older saves means a small win from a finished task. */
  kind?: "small" | "big";
  note?: string;
  eventId?: string;
}

export interface FocusState {
  presetId: string;
  label: string;
  totalSec: number;
  remainingSec: number;
  running: boolean;
  /** epoch ms when the running session ends */
  endsAt: number | null;
  eventId: string | null;
  bodyDouble: boolean;
  twoMinNotified: boolean;
  finished: boolean;
  customMin: number;
  /** Typed custom duration. Missing values are derived from customMin. */
  customHours?: number;
  customMinutes?: number;
  /** Wall-clock deadline already announced, so the same end doesn't chime twice. */
  alarmedAt: number | null;
  /** True after the person types a session name. Otherwise the preset name is translated at display time. */
  nameEdited?: boolean;
  /** This finished session already left one small win. A reload must not add another. */
  credited?: boolean;
  /** When true, the countdown deadline is the linked event's end, not a free-floating preset. */
  linkedToBlock: boolean;
  /** Event end (epoch ms) whose Finish / Extend prompt is open. */
  endPromptFor: number | null;
}

export interface AppState {
  version: 1;
  events: NowEvent[];
  cards: BoardCard[];
  links: BoardLink[];
  prefs: Prefs;
  energy: Energy | null;
  wins: Win[];
  focus: FocusState;
  firedNudges: string[];
  /** Recurring habits and appointment reminders. Missing on older saves means none. */
  series?: RecurrenceRule[];
}