import { pushShouldStart } from "./push-gate";

/**
 * Remote announcements stay off until google-services.json or GoogleService-Info.plist
 * is present and the native app is rebuilt. Nothing here reads plans or notes.
 */
export async function initPushIfConfigured(): Promise<void> {
  const enabled = pushShouldStart(import.meta.env.VITE_NATIVE === "1", import.meta.env.VITE_PUSH_ENABLED === "1");
  if (!enabled) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
}
