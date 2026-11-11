import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import {
  audioExtension,
  clearCustomSoundMeta,
  readCustomSound,
  speechEngine,
  speechLanguage,
  writeCustomSound,
} from "@/lib/nowmode/device-access";

describe("device access", () => {
  it("maps the app language onto a recognizer Android actually ships", () => {
    expect(speechLanguage("en")).toBe("en-US");
    expect(speechLanguage("es-419")).toBe("es-MX");
    expect(speechLanguage("es-ES")).toBe("es-ES");
  });

  it("keeps web speech on the website and the native engine in the installed app", () => {
    expect(speechEngine(false, true)).toBe("web");
    expect(speechEngine(false, false)).toBe("none");
    expect(speechEngine(true, true)).toBe("native");
    expect(speechEngine(true, false)).toBe("native");
  });

  it("keeps audio extensions the alarm file can play", () => {
    expect(audioExtension("tone.mp3")).toBe("mp3");
    expect(audioExtension("Voice Memo.M4A")).toBe("m4a");
    expect(audioExtension("clip.oga")).toBe("ogg");
    expect(audioExtension("download", "audio/wav")).toBe("wav");
    expect(audioExtension("notes.txt", "text/plain")).toBeNull();
  });

  it("round-trips the imported alarm file name", () => {
    clearCustomSoundMeta();
    expect(readCustomSound()).toBeNull();
    writeCustomSound({ file: "custom.mp3", rev: 2 });
    expect(readCustomSound()).toEqual({ file: "custom.mp3", rev: 2 });
    clearCustomSoundMeta();
    expect(readCustomSound()).toBeNull();
  });

  it("explains each permission in both Spanish variants", () => {
    for (const key of ["permit.micWhy", "permit.cameraWhy", "permit.photosWhy", "permit.filesWhy", "permit.notifyWhy"] as const) {
      expect(messages["es-419"][key]).not.toBe(messages["es-ES"][key]);
      expect(messages["es-419"][key]).not.toMatch(/vistazo|jalón|tirón/i);
      expect(messages["es-ES"][key]).not.toMatch(/vistazo|jalón|tirón/i);
    }
  });
});
