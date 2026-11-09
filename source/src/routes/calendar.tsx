import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { barColor } from "@/components/nowmode/colors";
import { Loading } from "@/components/nowmode/Loading";
import { IconButton, MenuButton } from "@/components/nowmode/ScreenHeader";
import { TypeBadge } from "@/components/nowmode/ScheduleTypeField";
import { useUI } from "@/components/nowmode/ui-context";
import { unlockAlarm } from "@/lib/nowmode/alarm";
import { countByDate, eventsOn, formatTime, toDateKey } from "@/lib/nowmode/logic";
import { focusSwitchGate, planBlockTimer, scheduleOf } from "@/lib/nowmode/schedule";
import { useNowMode } from "@/lib/nowmode/store";
import type { NowEvent } from "@/lib/nowmode/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar · Now Mode" },
      { name: "description", content: "A calm month view with event counts — tap a day to see it in order." },
      { property: "og:title", content: "Calendar · Now Mode" },
      { property: "og:description", content: "A calm month view with event counts — tap a day to see it in order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarScreen,
});

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarScreen() {
  const { ready, state } = useNowMode();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  if (!ready) return <Loading />;

  if (selected) return <DayList dateKey={selected} onBack={() => setSelected(null)} />;

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  const counts = countByDate(state.events);
  const todayKey = toDateKey(now);
  const title = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="pb-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pb-4 pt-5">
        <MenuButton />
        <h1 className="truncate text-[22px] font-bold tracking-tight">{title}</h1>
        <div className="flex gap-2">
          <IconButton label="Previous month" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton label="Next month" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </header>

      <div className="px-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-dim">
          {WEEK.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`l${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = toDateKey(new Date(first.getFullYear(), first.getMonth(), day));
            const count = counts[key] ?? 0;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={`${day}, ${count} ${count === 1 ? "event" : "events"}`}
                className={cn(
                  "flex h-[58px] flex-col items-center rounded-xl border pt-1.5 transition-colors hover:bg-card2",
                  isToday ? "border-blue bg-card text-blue" : "border-border2 bg-card text-foreground",
                  count === 0 && !isToday && "bg-bg2",
                )}
              >
                <span className="text-sm font-bold leading-none">{day}</span>
                {count > 0 && (
                  <>
                    <span className="mt-1 grid size-[18px] place-items-center rounded-full bg-blue text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                    <span className="mt-1 flex gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }).map((_, d) => (
                        <span key={d} className="size-1 rounded-full bg-teal" />
                      ))}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-center text-xs text-dim">
          Tap a day · badges show <span className="font-semibold text-muted-foreground">how many events</span>
        </p>
      </div>
    </div>
  );
}

function DayList({ dateKey, onBack }: { dateKey: string; onBack: () => void }) {
  const { state, toggleDone, startLinkedTimer, resumeFocus } = useNowMode();
  const { openSchedule, askTimer } = useUI();
  const navigate = useNavigate();
  const [y = 2026, m = 1, d = 1] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const list = eventsOn(state.events, dateKey);

  const openTimer = (ev: NowEvent) => {
    unlockAlarm();
    const f = state.focus;
    const gate = focusSwitchGate(f, ev.id);
    if (gate === "confirm") {
      askTimer({ kind: "block", eventId: ev.id });
      return;
    }
    if (!(f.endPromptFor && f.eventId === ev.id)) {
      if (gate === "same" && f.running) {
        /* keep the countdown */
      } else if (gate === "same" && f.linkedToBlock && !f.running && f.remainingSec > 0 && f.remainingSec < f.totalSec) {
        resumeFocus();
      } else if (!(gate === "same" && f.running)) {
        startLinkedTimer(ev.id);
      }
    }
    navigate({ to: "/focus" });
  };

  return (
    <div className="pb-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pb-4 pt-5">
        <IconButton label="Back to month" onClick={onBack}>
          <ChevronLeft className="size-5" />
        </IconButton>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">
            {list.length} {list.length === 1 ? "event" : "events"}
          </p>
          <h1 className="truncate text-[22px] font-bold tracking-tight">
            {date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </h1>
        </div>
      </header>
      <ol className="space-y-2.5 px-5">
        {list.length === 0 && (
          <li className="rounded-2xl border border-border bg-bg2 px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing planned. Open space is allowed.
          </li>
        )}
        {list.map((ev) => {
          const flexible = scheduleOf(ev) === "flexible";
          const timerOpen = state.focus.linkedToBlock && state.focus.eventId === ev.id && (state.focus.running || !!state.focus.endPromptFor);
          return (
            <li key={ev.id} className="rounded-2xl border border-border bg-card px-3 py-3">
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatTime(ev.time)}
                </span>
                <span className={cn("h-8 w-1 shrink-0 rounded-full", barColor[ev.color], ev.done && "opacity-40")} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className={cn("truncate text-sm font-semibold", ev.done && "text-dim line-through")}>{ev.title}</span>
                    <TypeBadge schedule={ev.schedule} />
                  </p>
                  <p className="text-xs text-dim">
                    {ev.tag} · {ev.duration} min
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={ev.done ? `Mark ${ev.title} not done` : `Mark ${ev.title} done`}
                  onClick={() => toggleDone(ev.id)}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border",
                    ev.done ? "border-green/50 bg-green/15 text-green" : "border-border2 text-dim",
                  )}
                >
                  <Check className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex gap-2 pl-[4.75rem]">
                {flexible && !ev.done && (
                  <button
                    type="button"
                    onClick={() => openTimer(ev)}
                    className="rounded-lg border border-border2 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  >
                      {timerOpen ? "Open timer" : planBlockTimer(ev, new Date()).ended ? "Add time" : "Timer"}
                  </button>
                )}
                {flexible && (
                  <button
                    type="button"
                    onClick={() => openSchedule(ev.id)}
                    className="rounded-lg border border-border2 px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    Edit time
                  </button>
                )}
                {!flexible && (
                  <button
                    type="button"
                    onClick={() => openSchedule(ev.id)}
                    className="rounded-lg border border-border2 px-2.5 py-1 text-xs font-semibold text-foreground"
                  >
                    Reschedule
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}