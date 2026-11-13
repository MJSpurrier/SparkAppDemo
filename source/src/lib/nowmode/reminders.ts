import { translate } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import type { LocaleId } from "@/lib/i18n/locale";
import { SOUND_IDS } from "./alarm";
import { NUDGE_TIERS, eventDate, toDateKey, type NudgeKey } from "./logic";
import { eventEndMs } from "./schedule";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START, effectiveBoardReviewTime, isQuietAt, nudgeTierAllowed } from "./settings";
import { checkInClock, checkInMoment, goalReminderAt } from "./goals";
import { presenceCopy, nextScheduledAfter } from "./today-flow";
import type { FocusState, Goal, NowEvent, Prefs } from "./types";

/** How far ahead a closed app can be given reminders. The list is rebuilt on every edit. */
export const REMINDER_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
/** Leave headroom under the iOS pending-notification cap. Soonest times win. */
export const REMINDER_LIMIT = 48;

export type ReminderKind = "nudge" | "review" | "alarm" | "checkin" | "goal";

export interface PlannedNotification {
  id: number;
  key: string;
  at: number;
  title: string;
  body: string;
  /** Built-in sound id. Null uses an imported file when one is stored. */
  sound: string | null;
  channelId: string;
  kind: ReminderKind;
}

export function catalogSound(alarmSound: string | undefined): string | null {
  return SOUND_IDS.includes(alarmSound as (typeof SOUND_IDS)[number]) ? alarmSound! : null;
}

/** Both platforms take the file name. Android 8+ also needs that file on the notification channel. */
export function nativeSoundFile(_platform: "android" | "ios", sound: string | null): string | undefined {
  if (!sound) return undefined;
  return `${sound}.wav`;
}

export function hashNotificationId(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const id = (hash >>> 0) % 1_000_000_000;
  return id === 0 ? 1 : id;
}

function assignIds(items: Omit<PlannedNotification, "id">[]): PlannedNotification[] {
  const used = new Set<number>();
  return items.map((item) => {
    let id = hashNotificationId(item.key);
    while (used.has(id)) id = id >= 999_999_999 ? 1 : id + 1;
    used.add(id);
    return { ...item, id };
  });
}

function quietAt(prefs: Prefs, when: Date): boolean {
  if (!prefs.quietHours) return false;
  return isQuietAt(when, prefs.quietStart ?? DEFAULT_QUIET_START, prefs.quietEnd ?? DEFAULT_QUIET_END);
}

function draft(
  key: string,
  at: number,
  title: string,
  body: string,
  sound: string | null,
  kind: ReminderKind,
): Omit<PlannedNotification, "id"> {
  return { key, at, title, body, sound, channelId: `nowmode-${sound ?? "default"}`, kind };
}

export interface ReminderInput {
  events: NowEvent[];
  prefs: Prefs;
  focus?: Pick<FocusState, "running" | "endsAt" | "label"> | null;
  goals?: Goal[];
  now: Date;
  locale: LocaleId;
  horizonMs?: number;
  limit?: number;
}

/**
 * The notifications a closed app should still deliver.
 * This does not read or write storage. Edits show up as a new plan, and anything
 * missing from the new plan is cancelled.
 */
export function planReminders(input: ReminderInput): PlannedNotification[] {
  const now = input.now.getTime();
  const horizon = now + (input.horizonMs ?? REMINDER_HORIZON_MS);
  const limit = input.limit ?? REMINDER_LIMIT;
  const sound = catalogSound(input.prefs.alarmSound);
  const title = translate(input.locale, "app.name");
  const drafts: Omit<PlannedNotification, "id">[] = [];

  const push = (item: Omit<PlannedNotification, "id"> | null) => {
    if (!item) return;
    if (item.at <= now || item.at > horizon) return;
    drafts.push(item);
  };

  if (input.prefs.layeredNudges) {
    for (const ev of input.events) {
      if (ev.done) continue;
      const start = eventDate(ev).getTime();
      if (Number.isNaN(start)) continue;
      for (const tier of NUDGE_TIERS) {
        if (!nudgeTierAllowed(input.prefs, !!ev.nudges?.[tier.key], tier.key as NudgeKey)) continue;
        const at = start - tier.offsetMin * 60_000;
        const when = new Date(at);
        if (quietAt(input.prefs, when)) continue;
        const nudgeBody = translate(input.locale, `nudge.${tier.key}`, {
          title: ev.title,
          time: formatLocaleTime(ev.time, input.locale),
        });
        const body = tier.key === "now"
          ? presenceCopy(input.locale, `${ev.id}:${ev.date}`, nextScheduledAfter(input.events, ev))
          : nudgeBody;
        push(
          draft(
            `nudge:${ev.id}:${tier.key}:${at}`,
            at,
            title,
            body,
            sound,
            "nudge",
          ),
        );
      }
    }
  }

  if (input.prefs.boardReviewOn) {
    const time = effectiveBoardReviewTime(input.prefs);
    const [hour = 0, minute = 0] = time.split(":").map(Number);
    for (let day = 0; day <= 14; day += 1) {
      const when = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + day, hour, minute, 0, 0);
      if (quietAt(input.prefs, when)) continue;
      push(
        draft(
          `review:${when.getFullYear()}-${when.getMonth()}-${when.getDate()}:${time}`,
          when.getTime(),
          title,
          translate(input.locale, "board.reviewNow"),
          sound,
          "review",
        ),
      );
    }
  }

  const focus = input.focus;
  if (focus?.running && focus.endsAt && !quietAt(input.prefs, new Date(focus.endsAt))) {
    const at = focus.endsAt;
    push(
      draft(
        `alarm:focus:${at}`,
        at,
        translate(input.locale, "alarm.done"),
        translate(input.locale, "alarm.doneBody", { title: focus.label || title }),
        sound,
        "alarm",
      ),
    );
  }

  // A timed block that is not the running timer still gets an end chime, so a closed app
  // can mark the end of something already on the calendar. Quiet hours skip it.
  for (const ev of input.events) {
    if (ev.done || ev.duration == null) continue;
    const at = eventEndMs(ev);
    if (Number.isNaN(at) || at === eventDate(ev).getTime()) continue;
    if (quietAt(input.prefs, new Date(at))) continue;
    push(
      draft(
        `alarm:event:${ev.id}:${at}`,
        at,
        translate(input.locale, "alarm.done"),
        translate(input.locale, "alarm.doneBody", { title: ev.title }),
        sound,
        "alarm",
      ),
    );
  }

  for (let day = 0; day <= 14; day += 1) {
    const date = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + day);
    const when = checkInMoment(input.prefs, date);
    if (!when) continue;
    if (quietAt(input.prefs, when)) continue;
    push(
      draft(
        `checkin:${toDateKey(date)}:${checkInClock(input.prefs)}`,
        when.getTime(),
        title,
        translate(input.locale, "checkin.body"),
        sound,
        "checkin",
      ),
    );
  }

  for (const goal of input.goals ?? []) {
    if (goal.done || !goal.due) continue;
    const when = goalReminderAt(goal.due);
    if (!when || quietAt(input.prefs, when)) continue;
    push(
      draft(
        `goal:${goal.id}:${goal.due}`,
        when.getTime(),
        title,
        translate(input.locale, "goal.remind", { title: goal.title }),
        sound,
        "goal",
      ),
    );
  }

  drafts.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  return assignIds(drafts.slice(0, Math.max(0, limit)));
}

export function sameReminder(a: PlannedNotification, b: PlannedNotification): boolean {
  return a.at === b.at && a.title === b.title && a.body === b.body && a.sound === b.sound && a.channelId === b.channelId;
}

/** Cancel anything removed or edited. Schedule only what is new or changed. */
export function reconcileReminders(previous: PlannedNotification[], next: PlannedNotification[]) {
  const nextById = new Map(next.map((item) => [item.id, item]));
  const prevById = new Map(previous.map((item) => [item.id, item]));
  return {
    cancel: previous.filter((item) => {
      const found = nextById.get(item.id);
      return !found || !sameReminder(found, item);
    }),
    schedule: next.filter((item) => {
      const found = prevById.get(item.id);
      return !found || !sameReminder(found, item);
    }),
  };
}
