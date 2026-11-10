export const TUTORIAL_STEPS = [
  { id: "welcome", route: "/", target: null },
  { id: "energy", route: "/", target: "today-energy" },
  { id: "next", route: "/", target: "today-next" },
  { id: "done", route: "/", target: "today-done" },
  { id: "capture", route: "/", target: "capture" },
  { id: "focus", route: "/focus", target: "focus" },
  { id: "wins", route: "/wins", target: "wins" },
  { id: "calendar", route: "/calendar", target: "calendar" },
  { id: "board", route: "/board", target: "board" },
  { id: "account", route: "/account", target: "account" },
  { id: "settings", route: "/account", target: "settings" },
  { id: "mission", route: "/mission", target: null },
  { id: "close", route: "/", target: null },
] as const;

export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
export type TutorialRoute = TutorialStep["route"];

export function tutorialCount(): number {
  return TUTORIAL_STEPS.length;
}

export function nextStep(index: number): number {
  return Math.min(TUTORIAL_STEPS.length - 1, index + 1);
}

export function previousStep(index: number): number {
  return Math.max(0, index - 1);
}

export function isLastStep(index: number): boolean {
  return index >= TUTORIAL_STEPS.length - 1;
}

/**
 * First visit, and only after the account screen.
 * Anyone who already has saved data is left alone until they tap Tutorial.
 */
export function shouldAutoStart(
  hadSavedData: boolean,
  tutorialDone: boolean | undefined,
  accountReady: boolean,
): boolean {
  return accountReady && !hadSavedData && tutorialDone !== true;
}

/** Keep the card inside the phone frame, preferring the room under the highlight. */
export function placeTourCard(
  frame: { width: number; height: number },
  hole: { top: number; height: number } | null,
  cardHeight: number,
): { top: number; left: number; width: number } {
  const pad = 12;
  const width = Math.max(160, frame.width - pad * 2);
  const maxTop = Math.max(pad, frame.height - cardHeight - pad);
  if (!hole) return { top: Math.min(maxTop, Math.max(pad, (frame.height - cardHeight) / 2)), left: pad, width };
  const below = hole.top + hole.height + 12;
  const above = hole.top - cardHeight - 12;
  const top = below + cardHeight <= frame.height - pad ? below : Math.max(pad, above);
  return { top: Math.min(maxTop, Math.max(pad, top)), left: pad, width };
}
