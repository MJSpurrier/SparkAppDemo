import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { explainScheduleError, useLocale, useT } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import {
  eventEndClock,
  eventStartMs,
  fixedConflict,
  scheduleOf,
  validateSlot,
} from "@/lib/nowmode/schedule";
import { useNowMode } from "@/lib/nowmode/store";
import type { ScheduleType } from "@/lib/nowmode/types";

import { ScheduleTypeField } from "./ScheduleTypeField";
import { useUI } from "./ui-context";

export function ScheduleDialog() {
  const { scheduleEventId, closeSchedule } = useUI();
  const { state, commitSchedule } = useNowMode();
  const ev = state.events.find((e) => e.id === scheduleEventId) ?? null;

  if (!scheduleEventId || !ev) return null;

  return <ScheduleForm key={ev.id + ev.date + ev.time + ev.duration + ev.schedule} eventId={ev.id} onClose={closeSchedule} />;
}

function ScheduleForm({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { state, commitSchedule, skipOccurrence, deleteSeries } = useNowMode();
  const ev = state.events.find((e) => e.id === eventId);
  const [date, setDate] = useState(ev?.date ?? "");
  const [time, setTime] = useState(ev?.time ?? "");
  const [duration, setDuration] = useState(String(ev?.duration ?? 30));
  const [schedule, setSchedule] = useState<ScheduleType>(ev ? scheduleOf(ev) : "fixed");
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"one" | "series">("one");
  const [confirm, setConfirm] = useState<null | "one" | "series">(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsedDuration = /^\d+$/.test(duration.trim()) ? Number(duration.trim()) : Number.NaN;
  const slot = { date, time, duration: parsedDuration };
  const valid = validateSlot(slot);

  const conflict = useMemo(() => {
    if (!ev || !valid.ok) return null;
    const start = eventStartMs({ date, time });
    const end = start + parsedDuration * 60_000;
    return fixedConflict(state.events, ev.id, start, end, Date.now());
  }, [ev, valid.ok, date, time, parsedDuration, state.events]);

  if (!ev) return null;

  const fixed = schedule === "fixed";
  const title = fixed ? t("schedule.move") : t("schedule.edit");
  const endLabel = valid.ok ? formatLocaleTime(eventEndClock({ date, time, duration: parsedDuration }), locale) : null;

  const save = () => {
    if (!valid.ok) {
      setError(explainScheduleError(locale, valid));
      return;
    }
    const result = commitSchedule(ev.id, { date, time, duration: parsedDuration, schedule, scope: ev.seriesId ? scope : "one" });
    if (!result.ok) {
      setError(explainScheduleError(locale, result));
      return;
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
      <button type="button" aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]" />
      <div className="animate-sheet-up absolute inset-x-0 bottom-0 max-h-[92%] overflow-y-auto rounded-t-3xl border-x border-t border-border2 bg-bg2 px-5 pb-6 pt-3 shadow-shell">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border2" />
        <h2 id="schedule-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{ev.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-dim">
          {t("schedule.local")}
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ScheduleTypeField value={schedule} onChange={setSchedule} name={`schedule-${ev.id}`} />
          {ev.seriesId && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("recur.scopeSeries")}>
                {(["one", "series"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={scope === item}
                    onClick={() => setScope(item)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold ${scope === item ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 text-muted-foreground"}`}
                  >
                    {t(item === "one" ? "recur.scopeOne" : "recur.scopeSeries")}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-dim">{t("recur.seriesNote")}</p>
              <p className="text-[11px] leading-relaxed text-dim">{t("recur.monthNote")}</p>
            </div>
          )}

          <label className="block text-xs font-semibold">
            {t("schedule.date")}
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
              className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium text-foreground focus:border-blue focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold">
              {t("schedule.starts")}
              <input
                type="time"
                required
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError(null);
                }}
                className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold">
              {t("schedule.minutes")}
              <input
                inputMode="numeric"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setError(null);
                }}
                aria-describedby="duration-hint"
                className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm font-medium focus:border-blue focus:outline-none"
              />
            </label>
          </div>
          <p id="duration-hint" className="text-xs text-muted-foreground">
            {endLabel ? t("schedule.ends", { time: endLabel }) : t("schedule.sameDay")}
          </p>

          {conflict && (
            <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              {t("conflict.overlap", { title: conflict.title, time: formatLocaleTime(conflict.time, locale) })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-coral">
              {error}
            </p>
          )}

          {ev.seriesId && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => setConfirm("one")}>
                {t("recur.deleteOne")}
              </Button>
              <Button type="button" variant="secondary" className="h-10 rounded-xl" onClick={() => setConfirm("series")}>
                {t("recur.deleteSeries")}
              </Button>
            </div>
          )}
          {confirm && (
            <div role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2">
              <p className="text-xs leading-relaxed">{confirm === "series" ? t("recur.deleteConfirm") : t("recur.deleteOneConfirm")}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg"
                  onClick={() => {
                    if (confirm === "series" && ev.seriesId) deleteSeries(ev.seriesId);
                    else skipOccurrence(ev.id);
                    onClose();
                  }}
                >
                  {t("recur.confirm")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setConfirm(null)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button type="button" variant="secondary" size="lg" className="h-12 rounded-xl" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="lg" className="h-12 rounded-xl text-[15px] font-semibold">
              {conflict ? t("schedule.anyway") : t("common.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
