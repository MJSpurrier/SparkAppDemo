import { intlTag, type LocaleId } from "./locale";

export function formatLocaleDate(date: Date, locale: LocaleId, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlTag(locale), options).format(date);
}

export function formatLocaleTime(hhmm: string, locale: LocaleId): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const sample = new Date(2026, 0, 1, h, m);
  return new Intl.DateTimeFormat(intlTag(locale), { hour: "numeric", minute: "2-digit" }).format(sample);
}

export function weekdayNarrows(locale: LocaleId): string[] {
  const fmt = new Intl.DateTimeFormat(intlTag(locale), { weekday: "narrow" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 10, 1 + i)));
}
