import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

import type { PaletteId, ThemeMode } from "./settings";

const BAR: Record<ThemeMode, Record<PaletteId, string>> = {
  dark: { ocean: "#0F1419", lavender: "#16141C", forest: "#101612" },
  light: { ocean: "#F4F7FB", lavender: "#F7F4FB", forest: "#F3F7F4" },
};

/** Match the status bar to the theme. Safe-area padding is applied by the native shell. */
export async function syncChrome(mode: ThemeMode, palette: PaletteId): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: BAR[mode][palette] });
    await StatusBar.setStyle({ style: mode === "dark" ? Style.Dark : Style.Light });
  } catch {
    /* Android 15 ignores the background color. The inset padding still applies. */
  }
}
