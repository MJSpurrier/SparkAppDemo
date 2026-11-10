import type { Prefs } from "./types";

export function greetingName(prefs: Pick<Prefs, "username" | "realName" | "greetAs">): string {
  const username = prefs.username?.trim() ?? "";
  const realName = prefs.realName?.trim() ?? "";
  if (prefs.greetAs === "username") return username || realName;
  return realName || username;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0] ?? "").join("");
  return letters.toUpperCase() || "?";
}

const PRESET_KEYS = {
  meditate: "focus.preset.meditate",
  study: "focus.preset.study",
  clean: "focus.preset.clean",
  custom: "focus.preset.custom",
} as const;

/** The small win uses the typed name. A blank or untouched preset uses the active language, never a stale English "Custom". */
export function focusWinLabel(
  focus: { presetId: string; label: string; nameEdited?: boolean },
  translate: (key: "focus.session" | (typeof PRESET_KEYS)[keyof typeof PRESET_KEYS]) => string,
): string {
  if (focus.nameEdited) return focus.label.trim() || translate("focus.session");
  const key = PRESET_KEYS[focus.presetId as keyof typeof PRESET_KEYS];
  return key ? translate(key) : focus.label.trim() || translate("focus.session");
}
