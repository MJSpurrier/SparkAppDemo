import { useT } from "@/lib/i18n/context";
import { weekdayNarrows } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/context";
import type { RecurrenceFreq } from "@/lib/nowmode/types";
import { cn } from "@/lib/utils";

export interface RecurrenceDraft {
  freq: RecurrenceFreq;
  weekdays: number[];
  monthDays: number[];
  customBy: "weekdays" | "monthDays";
  end: string;
}

export function RecurrenceEditor({
  value,
  onChange,
  startLabel,
}: {
  value: RecurrenceDraft;
  onChange: (next: RecurrenceDraft) => void;
  startLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const days = weekdayNarrows(locale);
  const freqs: RecurrenceFreq[] = ["daily", "weekly", "monthly", "custom"];
  const showWeek = value.freq === "weekly" || (value.freq === "custom" && value.customBy === "weekdays");
  const showMonth = value.freq === "monthly" || (value.freq === "custom" && value.customBy === "monthDays");

  const toggle = (list: number[], day: number) => (list.includes(day) ? list.filter((item) => item !== day) : [...list, day]);

  return (
    <fieldset className="space-y-2 rounded-2xl border border-border2 bg-card px-3 py-3">
      <legend className="px-1 text-xs font-semibold">{t("recur.button")}</legend>
      <p className="text-[11px] leading-relaxed text-dim">{t("recur.habit")}</p>
      <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={t("recur.button")}>
        {freqs.map((freq) => (
          <button
            key={freq}
            type="button"
            role="radio"
            aria-checked={value.freq === freq}
            onClick={() => onChange({ ...value, freq })}
            className={cn(
              "rounded-lg border px-1 py-2 text-[11px] font-semibold",
              value.freq === freq ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground",
            )}
          >
            {t(freq === "daily" ? "recur.daily" : freq === "weekly" ? "recur.weekly" : freq === "monthly" ? "recur.monthly" : "recur.custom")}
          </button>
        ))}
      </div>
      {value.freq === "custom" && (
        <div className="grid grid-cols-2 gap-1">
          {(["weekdays", "monthDays"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={value.customBy === kind}
              onClick={() => onChange({ ...value, customBy: kind })}
              className={cn(
                "rounded-lg border px-2 py-2 text-[11px] font-semibold",
                value.customBy === kind ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground",
              )}
            >
              {t(kind === "weekdays" ? "recur.weekdays" : "recur.monthDates")}
            </button>
          ))}
        </div>
      )}
      {showWeek && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("recur.weekdays")}>
          {days.map((label, index) => (
            <button
              key={label + index}
              type="button"
              aria-pressed={value.weekdays.includes(index)}
              onClick={() => onChange({ ...value, weekdays: toggle(value.weekdays, index) })}
              className={cn(
                "grid size-9 place-items-center rounded-full border text-[11px] font-semibold",
                value.weekdays.includes(index) ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {showMonth && (
        <>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label={t("recur.monthDates")}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={value.monthDays.includes(day)}
                onClick={() => onChange({ ...value, monthDays: toggle(value.monthDays, day) })}
                className={cn(
                  "h-8 rounded-md border text-[11px] font-semibold",
                  value.monthDays.includes(day) ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground",
                )}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-dim">{t("recur.monthNote")}</p>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">{startLabel}</p>
      <label className="block text-xs font-semibold">
        {t("recur.end")}
        <input
          type="date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="mt-1 h-11 w-full rounded-xl border border-border2 bg-background px-3 text-sm focus:border-blue focus:outline-none"
        />
      </label>
      <p className="text-[11px] leading-relaxed text-dim">{t("recur.dst")}</p>
    </fieldset>
  );
}
