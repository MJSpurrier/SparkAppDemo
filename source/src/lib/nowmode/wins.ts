import type { LocaleId } from "@/lib/i18n/locale";

export type WinSpan = "all" | "week" | "month" | "year";

export function weekStartsOn(locale: LocaleId): 0 | 1 {
  return locale === "en" ? 0 : 1;
}

/** Calendar week, month, or year. The all-time total is counted separately. */
export function winInSpan(date: string, span: WinSpan, now: Date, weekStart: 0 | 1): boolean {
  if (span === "all") return true;
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const when = new Date(year, month - 1, day);
  if (span === "month") return when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth();
  if (span === "year") return when.getFullYear() === now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const delta = (today.getDay() - weekStart + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - delta);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return when >= start && when <= end;
}
