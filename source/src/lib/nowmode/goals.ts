import { addDays, toDateKey } from "./logic";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START, effectiveBoardReviewTime, isQuietAt, minutesOfDay, reviewTimeBefore } from "./settings";
import type { Goal, Prefs } from "./types";

export const CHECK_IN_LEAD_MIN = 30;
export const GOAL_REMINDER_HOUR = 9;

export function checkInClock(prefs: Pick<Prefs, "quietStart">): string {
  const anchor = prefs.quietStart && minutesOfDay(prefs.quietStart) != null ? prefs.quietStart : DEFAULT_QUIET_START;
  return reviewTimeBefore(anchor, CHECK_IN_LEAD_MIN);
}

export function isCheckInDay(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 2 || weekday === 6;
}

/** A Board review notification is already on the plan for this calendar day. */
export function boardReviewPlannedOn(prefs: Prefs, day: Date): boolean {
  if (!prefs.boardReviewOn) return false;
  const time = effectiveBoardReviewTime(prefs);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
  if (!prefs.quietHours) return true;
  return !isQuietAt(when, prefs.quietStart ?? DEFAULT_QUIET_START, prefs.quietEnd ?? DEFAULT_QUIET_END);
}

export function checkInMoment(prefs: Prefs, day: Date): Date | null {
  if (!isCheckInDay(day) || boardReviewPlannedOn(prefs, day)) return null;
  const time = checkInClock(prefs);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

export function checkInFire(
  now: Date,
  prefs: Prefs,
  fired: string[],
): { key: string; record: boolean; notify: boolean } {
  const when = checkInMoment(prefs, now);
  const key = when ? `checkin:${toDateKey(now)}:${checkInClock(prefs)}` : "";
  if (!when || fired.includes(key)) return { key, record: false, notify: false };
  const diff = now.getTime() - when.getTime();
  if (diff < 0 || diff >= 5 * 60_000) return { key, record: false, notify: false };
  const quiet =
    !!prefs.quietHours &&
    isQuietAt(now, prefs.quietStart ?? DEFAULT_QUIET_START, prefs.quietEnd ?? DEFAULT_QUIET_END);
  return { key, record: true, notify: !quiet };
}

/** 09:00 on the calendar day before the due date. */
export function goalReminderAt(due: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const [year = 0, month = 1, day = 1] = due.split("-").map(Number);
  return new Date(year, month - 1, day - 1, GOAL_REMINDER_HOUR, 0, 0, 0);
}

export function goalReminderFire(now: Date, goal: Goal, fired: string[]): { key: string; record: boolean; notify: boolean } {
  if (goal.done || !goal.due) return { key: "", record: false, notify: false };
  const when = goalReminderAt(goal.due);
  const key = `goal:${goal.id}:${goal.due}`;
  if (!when || fired.includes(key)) return { key, record: false, notify: false };
  const diff = now.getTime() - when.getTime();
  if (diff < 0 || diff >= 5 * 60_000) return { key, record: false, notify: false };
  return { key, record: true, notify: true };
}

export function calendarDaysBetween(from: string, to: string): number {
  const [fy = 0, fm = 1, fd = 1] = from.split("-").map(Number);
  const [ty = 0, tm = 1, td = 1] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86_400_000);
}

export function goalCountdown(due: string | undefined, today: string): { key: "goal.whenever" | "goal.today" | "goal.day" | "goal.days" | "goal.pastOne" | "goal.past"; n?: number } {
  if (!due) return { key: "goal.whenever" };
  const days = calendarDaysBetween(today, due);
  if (days === 0) return { key: "goal.today" };
  if (days === 1) return { key: "goal.day" };
  if (days > 1) return { key: "goal.days", n: days };
  if (days === -1) return { key: "goal.pastOne" };
  return { key: "goal.past", n: Math.abs(days) };
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Visible month, plus overdue or undated goals that are still open. */
export function goalsInView(goals: Goal[], year: number, monthIndex: number, today: string): Goal[] {
  const month = monthKey(year, monthIndex);
  return goals
    .filter((goal) => {
      if (!goal.due) return !goal.done || (goal.doneOn ?? "").startsWith(month);
      const dueMonth = goal.due.startsWith(month);
      const overdue = !goal.done && goal.due < today;
      return dueMonth || overdue;
    })
    .slice()
    .sort((a, b) => rank(a, today) - rank(b, today) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.title.localeCompare(b.title));
}

function rank(goal: Goal, today: string): number {
  if (!goal.done && goal.due && goal.due < today) return 0;
  if (!goal.done && goal.due === today) return 1;
  if (!goal.done && goal.due) return 2;
  if (!goal.done) return 3;
  return 4;
}

export function overdueGoals(goals: Goal[], today: string): Goal[] {
  return goals.filter((goal) => !goal.done && !!goal.due && goal.due <= today);
}

export function extendGoalDue(today: Date, choice: "tomorrow" | "week"): string {
  return toDateKey(addDays(today, choice === "tomorrow" ? 1 : 7));
}

export function cheerIndex(goalId: string, due: string, count: number): number {
  let hash = 0;
  const key = `${goalId}:${due}`;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) % Math.max(1, count);
  return hash;
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const when = new Date(year, month - 1, day);
  return when.getFullYear() === year && when.getMonth() === month - 1 && when.getDate() === day;
}
