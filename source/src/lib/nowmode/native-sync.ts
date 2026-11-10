import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import { detectLocale } from "@/lib/i18n/locale";
import { SOUND_IDS } from "./alarm";
import { nativeSoundFile, planReminders, reconcileReminders, type PlannedNotification } from "./reminders";
import type { AppState } from "./types";

let lastPlan: PlannedNotification[] = [];
let channelsReady = false;

async function ensureChannels() {
  if (channelsReady || Capacitor.getPlatform() !== "android") return;
  await LocalNotifications.createChannel({
    id: "nowmode-default",
    name: "Now Mode",
    description: "Reminders",
    importance: 4,
    vibration: true,
  });
  for (const id of SOUND_IDS) {
    await LocalNotifications.createChannel({
      id: `nowmode-${id}`,
      name: `Now Mode ${id}`,
      sound: `${id}.wav`,
      importance: 4,
      vibration: true,
    });
  }
  channelsReady = true;
}

function payload(item: PlannedNotification, platform: "android" | "ios") {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    channelId: item.channelId,
    sound: nativeSoundFile(platform, item.sound),
    schedule: { at: new Date(item.at), allowWhileIdle: true },
    extra: { key: item.key, nowmode: true },
    isExactNotification: true,
  };
}

/**
 * Replace the device schedule with the current plan.
 * The website never calls the plugin. A missing permission leaves the plan untouched
 * until the person allows reminders.
 */
export async function syncNativeReminders(state: AppState): Promise<void> {
  if (import.meta.env.VITE_NATIVE !== "1" || !Capacitor.isNativePlatform()) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;
  await ensureChannels();
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  const locale = state.prefs.locale ?? detectLocale(typeof navigator === "undefined" ? "en" : navigator.language);
  const next = planReminders({
    events: state.events,
    prefs: state.prefs,
    focus: state.focus,
    now: new Date(),
    locale,
  });
  if (lastPlan.length === 0) {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((item) => ({ id: item.id })) });
    }
    if (next.length) {
      await LocalNotifications.schedule({ notifications: next.map((item) => payload(item, platform)) });
    }
  } else {
    const diff = reconcileReminders(lastPlan, next);
    if (diff.cancel.length) {
      await LocalNotifications.cancel({ notifications: diff.cancel.map((item) => ({ id: item.id })) });
    }
    if (diff.schedule.length) {
      await LocalNotifications.schedule({ notifications: diff.schedule.map((item) => payload(item, platform)) });
    }
  }
  lastPlan = next;
}
