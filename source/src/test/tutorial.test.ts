import { describe, expect, it } from "vitest";

import { messages, type MessageKey } from "@/lib/i18n/messages";
import {
  TUTORIAL_STEPS,
  isLastStep,
  nextStep,
  placeTourCard,
  previousStep,
  shouldAutoStart,
  tutorialCount,
} from "@/lib/nowmode/tutorial";

describe("tutorial steps", () => {
  it("moves forward, back, and knows the last card", () => {
    expect(tutorialCount()).toBeGreaterThan(10);
    expect(nextStep(0)).toBe(1);
    expect(previousStep(0)).toBe(0);
    expect(nextStep(tutorialCount())).toBe(tutorialCount() - 1);
    expect(isLastStep(tutorialCount() - 1)).toBe(true);
    expect(isLastStep(0)).toBe(false);
  });

  it("offers the tour only on a first visit", () => {
    expect(shouldAutoStart(false, undefined)).toBe(true);
    expect(shouldAutoStart(false, false)).toBe(true);
    expect(shouldAutoStart(true, undefined)).toBe(false);
    expect(shouldAutoStart(false, true)).toBe(false);
  });

  it("keeps the card inside the frame", () => {
    const low = placeTourCard({ width: 390, height: 700 }, { top: 640, height: 40 }, 220);
    expect(low.top).toBeGreaterThanOrEqual(12);
    expect(low.top + 220).toBeLessThanOrEqual(700);
    const centered = placeTourCard({ width: 390, height: 700 }, null, 220);
    expect(centered.top).toBeGreaterThan(12);
  });

  it("has every step string in English and both Spanish variants", () => {
    const keys = [
      "nav.tutorial",
      "drawer.tutorialHint",
      "tour.back",
      "tour.next",
      "tour.skip",
      "tour.finish",
      "tour.progress",
      ...TUTORIAL_STEPS.flatMap((step) => [`tour.${step.id}.title`, `tour.${step.id}.body`]),
    ] as MessageKey[];
    for (const key of keys) {
      expect(messages.en[key], key).toBeTruthy();
      expect(messages["es-419"][key], key).toBeTruthy();
      expect(messages["es-ES"][key], key).toBeTruthy();
    }
    expect(messages["es-419"]["nav.tutorial"]).not.toBe(messages["es-ES"]["nav.tutorial"]);
  });
});
