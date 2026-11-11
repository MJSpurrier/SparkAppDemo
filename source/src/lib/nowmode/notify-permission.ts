/** Web keeps the browser permission. The installed app asks the phone, including exact alarms on schedule. */
export async function currentNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (import.meta.env.VITE_NATIVE === "1") {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const result = await LocalNotifications.checkPermissions();
      if (result.display === "granted") return "granted";
      if (result.display === "denied") return "denied";
      return "default";
    }
  }
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (import.meta.env.VITE_NATIVE === "1") {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted" ? "granted" : "denied";
    }
  }
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}
