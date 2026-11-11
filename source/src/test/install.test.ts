import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import { TESTER_APK_URL, WEB_APP_URL } from "@/lib/nowmode/install";
import { createEmpty, stateForVisit } from "@/lib/nowmode/seed";

const keys = [
  "install.title",
  "install.browser",
  "install.download",
  "install.note",
  "install.home",
  "install.compare",
  "install.same",
  "install.diffReminders",
  "install.diffSound",
  "install.diffVoice",
  "install.diffFiles",
  "install.diffData",
  "drawer.installHint",
  "capture.voiceNo",
] as const;

describe("web or Android choice", () => {
  it("keeps the published tester APK address in one constant", () => {
    expect(TESTER_APK_URL).toBe(
      "https://github.com/MJSpurrier/SparkAppDemo/releases/download/tester-v1.0.2/nowmode-tester-1.0.2.apk",
    );
    expect(WEB_APP_URL).toBe("https://mjspurrier.github.io/SparkAppDemo/");
  });

  it("starts a first website visit empty, and keeps a saved plan", () => {
    expect(stateForVisit(null, false).events).toEqual([]);
    expect(stateForVisit(null, false)).toEqual(createEmpty());
    const saved = stateForVisit(
      { ...createEmpty(), events: [{ id: "keep", title: "Mine", date: "2026-11-10", time: "09:00", duration: 10, tag: "Work", color: "blue", done: false, nudges: { day: false, hour: true, ten: true, now: true }, schedule: "fixed" }] },
      false,
    );
    expect(saved.events).toHaveLength(1);
  });

  it("explains the real differences in both Spanish variants", () => {
    for (const key of keys) {
      expect(messages.en[key], key).toBeTruthy();
      expect(messages["es-419"][key], key).toBeTruthy();
      expect(messages["es-ES"][key], key).toBeTruthy();
    }
    for (const key of ["install.title", "install.download", "install.compare", "install.same", "install.diffReminders", "install.home"] as const) {
      expect(messages["es-419"][key]).not.toBe(messages["es-ES"][key]);
    }
    for (const locale of ["es-419", "es-ES"] as const) {
      const blob = keys.map((key) => messages[locale][key]).join("\n");
      expect(blob).not.toMatch(/vistazo|jalón|tirón/i);
    }
  });
});
