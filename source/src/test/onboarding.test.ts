import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/messages";
import { createDeviceAuth, validateAccount } from "@/lib/nowmode/auth";
import { greetingName } from "@/lib/nowmode/profile";
import { migrateAppState } from "@/lib/nowmode/schedule";
import { createEmpty, createSeed, stateForVisit } from "@/lib/nowmode/seed";
import { shouldAutoStart } from "@/lib/nowmode/tutorial";

const keys = [
  "onboard.title",
  "onboard.lead",
  "onboard.email",
  "onboard.name",
  "onboard.username",
  "onboard.submit",
  "onboard.emailRequired",
  "onboard.emailInvalid",
  "onboard.nameRequired",
  "onboard.usernameRequired",
  "onboard.usernameInvalid",
  "onboard.note",
  "onboard.failed",
] as const;

describe("native first install", () => {
  it("starts empty and leaves a saved plan untouched", () => {
    const fresh = createEmpty();
    expect(fresh.events).toEqual([]);
    expect(fresh.cards).toEqual([]);
    expect(fresh.wins).toEqual([]);
    expect(fresh.firedNudges).toEqual([]);
    expect(fresh.series).toEqual([]);
    expect(fresh.links).toEqual([]);
    expect(fresh.energy).toBeNull();

    const saved = migrateAppState({
      version: 1,
      events: [{ id: "keep", title: "Mine", date: "2026-11-10", time: "09:00" }],
      cards: [{ id: "c", kind: "text", text: "note", x: 1, y: 1 }],
      wins: [{ id: "w", label: "Done", date: "2026-11-10" }],
      prefs: { layeredNudges: true, focusReminders: true, quietHours: true, username: "ada" },
    });
    const next = stateForVisit(saved, true);
    expect(next.events.map((event) => event.title)).toEqual(["Mine"]);
    expect(next.cards).toHaveLength(1);
    expect(next.wins).toHaveLength(1);
    expect(next.prefs.username).toBe("ada");
    expect(next.prefs.quietHours).toBe(true);
    expect(stateForVisit(null, true).events).toEqual([]);
    expect(stateForVisit(null, false).events).toEqual([]);
    expect(createSeed().events.length).toBeGreaterThan(0);
  });
});

describe("account screen", () => {
  it("checks email, name, and username, then stores the profile on the device", async () => {
    expect(validateAccount({ email: "", realName: "", username: "" }).ok).toBe(false);
    const badEmail = validateAccount({ email: "not-an-email", realName: "Ada", username: "ada" });
    expect(badEmail.ok).toBe(false);
    if (!badEmail.ok) expect(badEmail.errors.email).toBe("email");
    const badUser = validateAccount({ email: "ada@example.com", realName: "Ada Lovelace", username: ".ada" });
    expect(badUser.ok).toBe(false);
    if (!badUser.ok) expect(badUser.errors.username).toBe("username");
    const good = validateAccount({ email: " Ada@Example.com ", realName: "Ada Lovelace", username: "ada_l" });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.value.email).toBe("ada@example.com");
    const auth = createDeviceAuth();
    const created = await auth.createAccount(good.value);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const greeting = greetingName({
      realName: created.profile.realName,
      username: created.profile.username,
      greetAs: "realName",
    });
    expect(greeting).toBe("Ada Lovelace");
    expect(shouldAutoStart(false, undefined, false)).toBe(false);
    expect(shouldAutoStart(false, undefined, true)).toBe(true);
    expect(shouldAutoStart(true, undefined, true)).toBe(false);
  });

  it("has the account strings in English and both Spanish variants", () => {
    for (const key of keys) {
      expect(messages.en[key], key).toBeTruthy();
      expect(messages["es-419"][key], key).toBeTruthy();
      expect(messages["es-ES"][key], key).toBeTruthy();
    }
    expect(messages["es-419"]["onboard.emailRequired"]).not.toBe(messages["es-ES"]["onboard.emailRequired"]);
  });
});
