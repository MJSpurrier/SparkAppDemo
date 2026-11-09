import type { ScheduleType } from "@/lib/nowmode/types";
import { cn } from "@/lib/utils";

export function TypeBadge({ schedule }: { schedule?: ScheduleType | null }) {
  const flexible = schedule === "flexible";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        flexible ? "border-teal/40 text-teal" : "border-border2 text-dim",
      )}
    >
      {flexible ? "Flexible" : "Fixed"}
    </span>
  );
}

export function ScheduleTypeField({
  value,
  onChange,
  name = "schedule-type",
}: {
  value: ScheduleType;
  onChange: (value: ScheduleType) => void;
  name?: string;
}) {
  const helpId = `${name}-help`;
  return (
    <fieldset aria-describedby={helpId}>
      <legend className="text-xs font-semibold text-foreground">What kind of plan is this?</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ["flexible", "Flexible"],
            ["fixed", "Fixed"],
          ] as const
        ).map(([option, label]) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-colors",
                selected ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 bg-card text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {label}
            </label>
          );
        })}
      </div>
      <p id={helpId} className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Flexible can run long with the timer, like guitar practice from 2:00 to 3:00. Fixed is an appointment or
        meeting. It stays put unless you reschedule it.
      </p>
    </fieldset>
  );
}
