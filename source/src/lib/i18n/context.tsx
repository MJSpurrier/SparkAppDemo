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

export function resolvedLocale(saved: string | undefined, browserLanguage: string | undefined): LocaleId {
  if (saved === "en" || saved === "es-419" || saved === "es-ES") return saved;
  return detectLocale(browserLanguage);
}
