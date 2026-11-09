import { createContext, useContext, type ReactNode } from "react";

import { messages, type MessageKey } from "./messages";
import { detectLocale, type LocaleId } from "./locale";

const LocaleCtx = createContext<LocaleId>("en");

export function LocaleProvider({ locale, children }: { locale: LocaleId; children: ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): LocaleId {
  return useContext(LocaleCtx);
}

export function translate(locale: LocaleId, key: MessageKey, vars?: Record<string, string | number>): string {
  const table = messages[locale] ?? messages.en;
  const template = table[key] ?? messages.en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function useT() {
  const locale = useLocale();
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

export function explainScheduleError(
  locale: LocaleId,
  err: { message: string; code?: string; maxMin?: number },
): string {
  if (err.code === "upTo" && typeof err.maxMin === "number") return translate(locale, "validate.upTo", { n: err.maxMin });
  const map = {
    date: "validate.date",
    time: "validate.time",
    minutes: "validate.minutes",
    midnight: "validate.midnight",
    format: "focus.badFormat",
    range: "validate.minutes",
    late: "validate.late",
    long: "validate.long",
  } as const;
  if (err.code && err.code in map) return translate(locale, map[err.code as keyof typeof map]);
  return err.message;
}

export function resolvedLocale(saved: string | undefined, browserLanguage: string | undefined): LocaleId {
  if (saved === "en" || saved === "es-419" || saved === "es-ES") return saved;
  return detectLocale(browserLanguage);
}

/** Locale for chrome that renders outside the provider, such as the error screen. */
export function activeLocale(): LocaleId {
  let saved: string | undefined;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("nowmode-v1");
      const value = raw ? JSON.parse(raw)?.prefs?.locale : undefined;
      if (typeof value === "string") saved = value;
    }
  } catch {
    saved = undefined;
  }
  const language = typeof navigator === "undefined" ? undefined : navigator.language;
  return resolvedLocale(saved, language);
}

/** System tag stays in storage. Only the default word is shown in the active language. */
export function localizedTag(locale: LocaleId, tag: string): string {
  return tag === "Capture" ? translate(locale, "capture.tag") : tag;
}
