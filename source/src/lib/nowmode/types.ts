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
  /** minutes */
  duration: number;
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
}

export interface Win {
  id: string;
  date: string;
  label: string;
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
  /** Wall-clock deadline already announced, so the same end doesn't chime twice. */
  alarmedAt: number | null;
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
}