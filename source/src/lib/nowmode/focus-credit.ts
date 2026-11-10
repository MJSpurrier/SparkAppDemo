import { resolvedLocale, translate } from "@/lib/i18n/context";
import { toDateKey, uid } from "./logic";
import { focusWinLabel } from "./profile";
import type { AppState } from "./types";

/** One named free session leaves one small win. A second call, including after reload, does not add another. */
export function creditFocusSession(state: AppState, now = new Date()): AppState {
  const focus = state.focus;
  if (focus.linkedToBlock || !focus.finished || focus.credited) return state;
  const locale = resolvedLocale(state.prefs.locale, undefined);
  const label = focusWinLabel(focus, (key) => translate(locale, key));
  const already =
    !!focus.eventId &&
    state.wins.some((win) => (win.kind ?? "small") === "small" && win.eventId === focus.eventId);
  return {
    ...state,
    events: focus.eventId
      ? state.events.map((event) => (event.id === focus.eventId ? { ...event, done: true } : event))
      : state.events,
    wins: already
      ? state.wins
      : [...state.wins, { id: uid(), date: toDateKey(now), label, kind: "small", eventId: focus.eventId ?? undefined }],
    focus: {
      ...focus,
      finished: false,
      remainingSec: focus.totalSec,
      running: false,
      twoMinNotified: false,
      credited: true,
    },
  };
}
