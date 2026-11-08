export type EventColor = "blue" | "teal" | "green" | "coral";
export type Energy = "low" | "okay" | "high";
export type CardKind = "text" | "voice" | "photo";

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