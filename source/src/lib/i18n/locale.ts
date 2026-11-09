export type LocaleId = "en" | "es-419" | "es-ES";

export const LOCALES: { id: LocaleId; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es-419", label: "Español (Latinoamérica)" },
  { id: "es-ES", label: "Español (España)" },
];

/** Browser language → a supported locale. Anything else, including partial tags we don't ship, is English. */
export function detectLocale(language: string | undefined | null): LocaleId {
  const tag = (language ?? "").toLowerCase().replace(/_/g, "-");
  if (tag === "es-es" || tag.startsWith("es-es-")) return "es-ES";
  if (tag === "es" || tag.startsWith("es-")) return "es-419";
  return "en";
}

export function intlTag(locale: LocaleId): string {
  return locale === "en" ? "en" : locale;
}
