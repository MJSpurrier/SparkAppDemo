import { describe, expect, it } from "vitest";

import { detectLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/context";
import { en, messages, type MessageKey } from "@/lib/i18n/messages";
import { migrateAppState, migrateWin } from "@/lib/nowmode/schedule";
import {
  isQuietAt,
  nudgeTierAllowed,
  parseCustomDuration,
  quietRangeError,
  shouldLeadWarn,
} from "@/lib/nowmode/settings";
import { toggleStep } from "@/lib/nowmode/logic";
import type { NowEvent } from "@/lib/nowmode/types";

describe("dictionary coverage", () => {
  const keys = Object.keys(en) as MessageKey[];
  it("has every English key in both Spanish variants, with no empty strings", () => {
    for (const locale of ["es-419", "es-ES"] as const) {
      for (const key of keys) {
        expect(messages[locale][key], `${locale} ${key}`).toBeTruthy();
      }
      expect(Object.keys(messages[locale]).sort()).toEqual([...keys].sort());
    }
  });
  it("keeps staged-reminder copy plain and regionally distinct", () => {
    expect(messages["es-419"]["account.nudges"]).toBe("Recordatorios por etapas");
    expect(messages["es-419"]["account.nudgesHint"]).toBe("Elige cuándo recibir avisos");
    expect(messages["es-ES"]["account.nudgesHint"]).toBe("Elige cuándo recibir los recordatorios");
    expect(messages["es-419"]["board.zoom"]).toBe("Ampliar");
    expect(messages["es-ES"]["board.connect"]).toBe("Enlazar");
    expect(messages["es-419"]["board.connect"]).toBe("Conectar");
    for (const locale of ["es-419", "es-ES"] as const) {
      const blob = Object.values(messages[locale]).join("\n");
      expect(blob).not.toMatch(/vistazo|jalón|tirón/i);
    }
    expect(messages["es-419"]["today.addTime"]).not.toBe(messages["es-ES"]["today.addTime"]);
    expect(messages["es-419"]["nav.focus"]).not.toBe(messages["es-ES"]["nav.focus"]);
  });
});

describe("locale fallback", () => {
  it("keeps Spain and Latin America apart and falls back to English", () => {
    expect(detectLocale("es-ES")).toBe("es-ES");
    expect(detectLocale("es-MX")).toBe("es-419");
    expect(detectLocale("es")).toBe("es-419");
    expect(detectLocale("fr-FR")).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
    expect(translate("es-ES", "today.addTime")).not.toBe(translate("es-419", "today.addTime"));
  });
});

describe("quiet hours", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
  it("covers a range that crosses midnight and a same-day range", () => {
    expect(isQuietAt(at(23, 30), "22:00", "07:00")).toBe(true);
    expect(isQuietAt(at(6, 59), "22:00", "07:00")).toBe(true);
    expect(isQuietAt(at(7, 0), "22:00", "07:00")).toBe(false);
    expect(isQuietAt(at(12), "22:00", "07:00")).toBe(false);
    expect(isQuietAt(at(13), "12:00", "14:00")).toBe(true);
    expect(isQuietAt(at(14), "12:00", "14:00")).toBe(false);
  });
  it("rejects an equal start and end", () => {
    expect(quietRangeError("22:00", "22:00")).toBe("equal");
    expect(isQuietAt(at(22), "22:00", "22:00")).toBe(false);
  });
});

describe("focus lead and custom timer", () => {
  it("does not warn when the lead is longer than the session", () => {
    expect(shouldLeadWarn(5 * 60, 5 * 60, 10, false)).toBe(false);
    expect(shouldLeadWarn(25 * 60, 10 * 60, 10, false)).toBe(true);
    expect(shouldLeadWarn(25 * 60, 10 * 60, 10, true)).toBe(false);
  });
  it("parses 1 hour and 5 minutes and rejects junk", () => {
    expect(parseCustomDuration("1", "05")).toEqual({ ok: true, hours: 1, minutes: 5, total: 65 });
    expect(parseCustomDuration("0", "0").ok).toBe(false);
    expect(parseCustomDuration("1.5", "0").ok).toBe(false);
  });
});

describe("steps and wins persistence", () => {
  const event = {
    id: "e",
    title: "Keep me",
    date: "2026-11-09",
    time: "10:00",
    duration: 30,
    tag: "Work",
    color: "blue",
    done: false,
    schedule: "fixed",
    nudges: { day: false, hour: true, ten: true, now: true },
    steps: [{ id: "s1", title: "Wrote this", done: true }],
  } satisfies NowEvent;

  it("keeps written steps and does not finish the parent", () => {
    const next = toggleStep(event, "s1");
    expect(next.steps?.[0]?.done).toBe(false);
    expect(next.done).toBe(false);
    expect(next.title).toBe("Keep me");
  });

  it("keeps old wins and notes when the save has no kind", () => {
    const saved = migrateAppState({
      version: 1,
      events: [event],
      cards: [{ id: "c", kind: "text", text: "Board note stays", x: 1, y: 2 }],
      wins: [{ id: "w", date: "2026-11-01", label: "Kept win" }],
      prefs: { layeredNudges: true, focusReminders: true, quietHours: true },
      focus: { presetId: "study", label: "Study", totalSec: 100, remainingSec: 100, running: false, endsAt: null, eventId: null, bodyDouble: false, twoMinNotified: false, finished: false, customMin: 10 },
    });
    expect(saved?.wins[0]).toMatchObject({ id: "w", label: "Kept win", kind: "small" });
    expect(saved?.events[0]?.steps?.[0]?.title).toBe("Wrote this");
    expect(saved?.cards[0]?.text).toBe("Board note stays");
    expect(saved?.events).toHaveLength(1);
    expect(migrateWin({ id: "b", label: "Certificate", date: "2026-11-02", kind: "big", note: "First aid" }).note).toBe("First aid");
  });
});

describe("nudge master switch", () => {
  it("requires both the global layer and the event layer", () => {
    const prefs = { layeredNudges: true, focusReminders: true, quietHours: false, nudgeDefaults: { day: false, hour: true, ten: true, now: true } };
    expect(nudgeTierAllowed(prefs, true, "day")).toBe(false);
    expect(nudgeTierAllowed(prefs, true, "hour")).toBe(true);
    expect(nudgeTierAllowed(prefs, false, "hour")).toBe(false);
    expect(nudgeTierAllowed({ ...prefs, layeredNudges: false }, true, "hour")).toBe(false);
  });
});
