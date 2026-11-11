import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, Check, ChevronDown, Clock3, Moon, Scissors, Sparkles, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { localizedTag, useLocale, useT } from "@/lib/i18n/context";
import { formatLocaleDate, formatLocaleTime } from "@/lib/i18n/format";
import { barColor } from "@/components/nowmode/colors";
import { Loading } from "@/components/nowmode/Loading";
import { Ring } from "@/components/nowmode/Ring";
import { ScreenHeader } from "@/components/nowmode/ScreenHeader";
import { TypeBadge } from "@/components/nowmode/ScheduleTypeField";
import { useUI } from "@/components/nowmode/ui-context";
import { Button } from "@/components/ui/button";
import { unlockAlarm } from "@/lib/nowmode/alarm";
import { syncNativeReminders } from "@/lib/nowmode/native-sync";
import { currentNotifyPermission, requestNotifyPermission } from "@/lib/nowmode/notify-permission";
import { openAppSettings } from "@/lib/nowmode/native-device";
import { PermitCard } from "@/components/nowmode/PermitCard";
import {
  NUDGE_TIERS,
  eventsOn,
  formatMMSS,
  nextUp,
  toDateKey,
} from "@/lib/nowmode/logic";
import { greetingName } from "@/lib/nowmode/profile";
import { eventEndClock, focusSwitchGate, formatRange, hasDuration, planBlockTimer, scheduleOf } from "@/lib/nowmode/schedule";
import { useNow, useNowMode } from "@/lib/nowmode/store";
import type { Energy, FocusState, NowEvent } from "@/lib/nowmode/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today · Now Mode" },
      { name: "description", content: "See the one thing to do now, with gentle nudges and permission to rest." },
      { property: "og:title", content: "Today · Now Mode" },
      { property: "og:description", content: "See the one thing to do now, with gentle nudges and permission to rest." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Today,
});

function Today() {
  const t = useT();
  const locale = useLocale();
  const { ready, state, setEnergy } = useNowMode();
  const now = useNow(1000);
  const [completedOpen, setCompletedOpen] = useState(false);
  if (!ready) return <Loading />;

  const todayKey = toDateKey(now);
  const today = eventsOn(state.events, todayKey);
  const up = nextUp(state.events, todayKey);
  const doneCount = today.filter((e) => e.done).length;
  const rest = today.filter((e) => !e.done && e.id !== up?.id);
  const completed = today.filter((e) => e.done);
  const hello = greetingName(state.prefs);
  const left = today.filter((e) => !e.done && e.id !== up?.id).length;
  const wins = state.wins.filter((w) => w.date === todayKey).length;
  const allClear = !up;
  const kicker = formatLocaleDate(now, locale, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="pb-8">
      <ScreenHeader
        kicker={
          <>
            {hello && <span className="block truncate font-semibold text-foreground">{t("today.hello", { name: hello })}</span>}
            <span className="block truncate">{kicker}</span>
          </>
        }
        title={allClear ? t("today.allClear") : t("today.oneThing")}
        right={
          <span className="inline-flex items-center gap-1 rounded-full border border-border2 bg-card px-3 py-1.5 text-xs font-semibold text-green">
            <Zap className="size-3.5" /> {state.energy ? t(state.energy === "low" ? "today.energyLow" : state.energy === "okay" ? "today.energyOkay" : "today.energyHigh") : t("today.checkIn")}
          </span>
        }
      />

      <div className="space-y-5 px-5">
        <section data-tour="today-energy" aria-label={t("today.energyQ")} className="space-y-2">
          <p className="text-sm font-semibold">{t("today.energyQ")}</p>
          <div className="flex items-center gap-2">
            {(["low", "okay", "high"] as Energy[]).map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={state.energy === e}
                onClick={() => setEnergy(e)}
                className={cn(
                  "flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                  state.energy === e
                    ? "border-blue/60 bg-blue/15 text-blue"
                    : "border-border2 bg-card text-muted-foreground hover:bg-card2",
                )}
              >
                {t(e === "low" ? "today.energyLow" : e === "okay" ? "today.energyOkay" : "today.energyHigh")}
              </button>
            ))}
          </div>
        </section>

        <section data-tour="today-done" aria-label={t("a11y.day")} className="space-y-2">
          <button type="button" aria-expanded={completedOpen} onClick={() => setCompletedOpen((v) => !v)} className="w-full space-y-2 text-left">
            <div className="h-1.5 overflow-hidden rounded-full bg-card2">
              <div
                className="h-full rounded-full bg-teal transition-[width] duration-500"
                style={{ width: `${today.length ? (doneCount / today.length) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ChevronDown className={cn("size-3.5 transition-transform", completedOpen && "rotate-180")} aria-hidden />
                {t("today.handled", { done: doneCount, total: today.length })}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-green">
                <Sparkles className="size-3.5" /> {t(wins === 1 ? "today.win" : "today.wins", { n: wins })}
              </span>
            </div>
          </button>
          {completedOpen && (
            <div className="space-y-2">
              <h2 className="px-1 text-sm font-semibold">{t("today.completed")}</h2>
              {completed.length === 0 && <p className="rounded-2xl border border-border bg-bg2 px-4 py-3 text-sm text-dim">{t("today.completedEmpty")}</p>}
              {completed.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </section>

        {up ? <UpNext ev={up} now={now} /> : <AllClearCard />}

        {/* Rest of today */}
        <section aria-label={t("today.rest")} className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("today.rest")}</h2>
            <span className="text-sm text-dim">{t("today.left", { n: left })}</span>
          </div>
          {rest.length === 0 && (
            <p className="rounded-2xl border border-border bg-bg2 px-4 py-3 text-sm text-dim">{t("today.nothingElse")}</p>
          )}
          {rest.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-center",
              allClear ? "border-green/50 bg-rest" : "border-green/25 bg-rest/50",
            )}
          >
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-green">
              <Moon className="size-4" /> {t("today.restOk")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{allClear ? t("today.restDone") : t("today.restWait")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: NowEvent }) {
  const t = useT();
  const locale = useLocale();
  const { state, toggleDone } = useNowMode();
  const { openSchedule, openSteps } = useUI();
  const openTimer = useActivityTimer();
  const flexible = scheduleOf(ev) === "flexible";
  const timerOpen = state.focus.linkedToBlock && state.focus.eventId === ev.id && (state.focus.running || !!state.focus.endPromptFor);
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <div className="flex items-center gap-3">
        <span className={cn("h-8 w-1 shrink-0 rounded-full", barColor[ev.color], ev.done && "opacity-40")} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className={cn("truncate text-sm font-semibold", ev.done && "text-dim line-through")}>{ev.title}</span>
            <TypeBadge schedule={ev.schedule} />
          </p>
          <p className="text-xs text-dim">
            {formatLocaleTime(ev.time, locale)}
            {hasDuration(ev) ? ` · ${ev.duration} min` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label={ev.done ? t("today.markNotAria", { title: ev.title }) : t("today.markDoneAria", { title: ev.title })}
          onClick={() => toggleDone(ev.id)}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
            ev.done ? "border-green/50 bg-green/15 text-green" : "border-border2 text-dim hover:text-foreground",
          )}
        >
          <Check className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-2 pl-4">
        {flexible && hasDuration(ev) && !ev.done && (
          <RowAction onClick={() => openTimer(ev)}>
            {timerOpen ? t("today.openTimer") : planBlockTimer(ev, new Date()).ended ? t("today.addTime") : t("today.startTimer")}
          </RowAction>
        )}
        <RowAction onClick={() => openSteps(ev.id)}>{t("today.split")}</RowAction>
        {flexible && <RowAction onClick={() => openSchedule(ev.id)}>{t("today.editTime")}</RowAction>}
        {!flexible && <RowAction onClick={() => openSchedule(ev.id)}>{t("today.reschedule")}</RowAction>}
      </div>
    </div>
  );
}

function RowAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border2 bg-background/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}

function focusBusy(f: FocusState) {
  return f.running || (!f.finished && !f.endPromptFor && f.remainingSec > 0 && f.remainingSec < f.totalSec);
}

function useActivityTimer() {
  const { state, startLinkedTimer, resumeFocus } = useNowMode();
  const { askTimer } = useUI();
  const navigate = useNavigate();
  return (ev: NowEvent) => {
    unlockAlarm();
    const f = state.focus;
    const gate = focusSwitchGate(f, ev.id);
    if (gate === "confirm") {
      askTimer({ kind: "block", eventId: ev.id });
      return;
    }
    if (f.endPromptFor && f.eventId === ev.id) {
      navigate({ to: "/focus" });
      return;
    }
    if (gate === "same" && f.running) {
      navigate({ to: "/focus" });
      return;
    }
    if (gate === "same" && f.linkedToBlock && !f.running && f.remainingSec > 0 && f.remainingSec < f.totalSec) {
      resumeFocus();
    } else {
      startLinkedTimer(ev.id);
    }
    navigate({ to: "/focus" });
  };
}

function AllClearCard() {
  const t = useT();
  const { openSheet } = useUI();
  return (
    <section className="rounded-[20px] border border-border2 bg-hero p-5 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-green">{t("today.allClear")}</p>
      <h2 className="mt-1 text-xl font-bold">{t("today.clearTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("today.clearBody")}</p>
      <Button variant="secondary" className="mt-4 h-11 w-full rounded-xl" onClick={() => openSheet("all")}>
        {t("today.capture")}
      </Button>
    </section>
  );
}

function UpNext({ ev, now }: { ev: NowEvent; now: Date }) {
  const t = useT();
  const locale = useLocale();
  const { state, startFocus, toggleDone, toggleStep, toggleNudge, previewNudges } = useNowMode();
  const { openSchedule, openSteps, askTimer } = useUI();
  const navigate = useNavigate();
  const openTimer = useActivityTimer();
  const [showNudges, setShowNudges] = useState(false);
  const native = import.meta.env.VITE_NATIVE === "1";
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [askNotify, setAskNotify] = useState<null | "explain" | "denied">(null);
  useEffect(() => {
    void currentNotifyPermission().then(setPerm);
  }, []);

  const f = state.focus;
  const flexible = scheduleOf(ev) === "flexible";
  const linked = flexible && f.linkedToBlock && f.eventId === ev.id;
  const personalActive = !flexible && f.eventId === ev.id && !f.linkedToBlock && (f.running || (f.remainingSec < f.totalSec && !f.finished));
  const timed = hasDuration(ev);
  const block = timed ? planBlockTimer(ev, now) : { remainingSec: 0, endsAt: 0, ended: false };
  const energyCopy = state.energy ? t(state.energy === "low" ? "energy.low" : state.energy === "okay" ? "energy.okay" : "energy.high") : t("energy.none");

  const goSprint = (minutes: number) => {
    unlockAlarm();
    if (focusBusy(f) && (f.eventId !== ev.id || f.linkedToBlock)) {
      askTimer({ kind: "free", eventId: ev.id, minutes });
      return;
    }
    startFocus({ minutes, eventId: ev.id, label: ev.title, presetId: "event", linkedToBlock: false });
    navigate({ to: "/focus" });
  };

  const goPersonal = () => {
    unlockAlarm();
    if (personalActive) {
      navigate({ to: "/focus" });
      return;
    }
    if (focusBusy(f) && f.eventId !== ev.id) {
      askTimer({ kind: "free", eventId: ev.id, minutes: ev.duration });
      return;
    }
    startFocus({ minutes: ev.duration, eventId: ev.id, label: ev.title, presetId: "event", linkedToBlock: false });
    navigate({ to: "/focus" });
  };

  const showCountdown = flexible && (linked && (f.running || f.remainingSec < f.totalSec || !!f.endPromptFor) || block.ended);
  const shownRemaining = linked ? f.remainingSec : 0;
  const ringValue = showCountdown
    ? linked && f.totalSec
      ? f.remainingSec / f.totalSec
      : 0
    : personalActive && f.totalSec
      ? f.remainingSec / f.totalSec
      : 1;

  return (
    <section data-tour="today-next" aria-label={t("today.upNext")} className="rounded-[20px] border border-border2 bg-hero p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue">{t("today.upNext")}</p>
        <TypeBadge schedule={ev.schedule} />
      </div>
      <h2 className="mt-1 text-[22px] font-bold leading-tight">{ev.title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {localizedTag(locale, ev.tag)} · {formatLocaleTime(ev.time, locale)}
        {timed ? ` – ${formatLocaleTime(eventEndClock(ev), locale)}` : ""}
      </p>

      <div className="mt-4 flex items-center gap-4">
        <Ring
          size={72}
          stroke={9}
          value={ringValue}
          label={timed ? (flexible ? t("focus.remaining") : t("focus.total", { total: ev.duration ?? 0 })) : t("capture.pickTime")}
        >
          <span className="text-sm font-bold">
            {timed
              ? showCountdown
                ? t("unit.short", { n: Math.max(0, Math.ceil(shownRemaining / 60)) })
                : t("unit.short", { n: ev.duration ?? 0 })
              : "—"}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[32px] font-bold tabular-nums leading-none tracking-tight">
            {showCountdown ? formatMMSS(shownRemaining) : formatLocaleTime(ev.time, locale)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {!timed
              ? t("duration.none")
              : flexible
                ? block.ended
                  ? t("today.ended", { time: formatLocaleTime(eventEndClock(ev), locale), clock: formatLocaleTime(`${now.getHours()}:${now.getMinutes()}`, locale) })
                  : t("today.until", { time: formatLocaleTime(eventEndClock(ev), locale), clock: formatLocaleTime(`${now.getHours()}:${now.getMinutes()}`, locale) })
                : t("today.ofMin", { n: ev.duration ?? 0, clock: formatLocaleTime(`${now.getHours()}:${now.getMinutes()}`, locale) })}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground/85">{energyCopy}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {timed &&
          (flexible ? (
            <Button size="lg" className="h-11 rounded-xl text-[15px] font-semibold" onClick={() => openTimer(ev)}>
              {linked && (f.running || f.endPromptFor) ? t("today.openTimer") : block.ended ? t("today.addTime") : t("today.startTimer")}
            </Button>
          ) : (
            <Button size="lg" className="h-11 rounded-xl text-[15px] font-semibold" onClick={goPersonal}>
              {personalActive ? t("today.backFocus") : t("today.startFocus")}
            </Button>
          ))}
        <Button
          variant="secondary"
          size="lg"
          className="h-11 rounded-xl text-[15px] font-semibold"
          onClick={() => openSteps(ev.id)}
        >
          <Scissors /> {t("today.split")}
        </Button>
      </div>
      {!flexible && (
        <Button variant="secondary" className="mt-2 h-10 w-full rounded-xl" onClick={() => openSchedule(ev.id)}>
          {t("today.reschedule")}
        </Button>
      )}
      {flexible && (
        <button
          type="button"
          onClick={() => openSchedule(ev.id)}
          className="mt-2 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("today.editTime")}
        </button>
      )}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <GhostBtn onClick={() => goSprint(2)} icon={<Clock3 className="size-3.5" />}>
          {t("today.just2")}
        </GhostBtn>
        <GhostBtn onClick={() => toggleDone(ev.id)} icon={<Check className="size-3.5" />}>
          {t("today.markDone")}
        </GhostBtn>
        <GhostBtn
          onClick={() => setShowNudges((v) => !v)}
          icon={<Bell className="size-3.5" />}
          active={showNudges}
        >
          {t("today.nudges")}
        </GhostBtn>
      </div>

      {ev.steps && ev.steps.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label={t("steps.title")}>
          {ev.steps.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggleStep(ev.id, s.id)}
                aria-pressed={s.done}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-left"
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                    s.done ? "border-green bg-green text-ink" : "border-border2 text-dim",
                  )}
                >
                  {s.done ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn("text-sm", s.done && "text-dim line-through")}>{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNudges && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background/40 p-3">
          <p className="text-xs text-muted-foreground">{t("today.nudgeHint")}</p>
          <div className="grid grid-cols-4 gap-2">
            {NUDGE_TIERS.map((tier) => (
              <button
                key={tier.key}
                type="button"
                aria-pressed={ev.nudges[tier.key]}
                onClick={() => toggleNudge(ev.id, tier.key)}
                className={cn(
                  "rounded-xl border px-1 py-2 text-center transition-colors",
                  ev.nudges[tier.key]
                    ? "border-blue/60 bg-blue/15 text-blue"
                    : "border-border2 bg-card text-dim",
                )}
              >
                <span className="block text-xs font-semibold">{t(tier.key === "day" ? "nudge.layer.day" : tier.key === "hour" ? "nudge.layer.hour" : tier.key === "ten" ? "nudge.layer.ten" : "nudge.layer.now")}</span>
                <span className="block text-[10px] opacity-80">{t(tier.key === "day" ? "nudge.word.day" : tier.key === "hour" ? "nudge.word.hour" : tier.key === "ten" ? "nudge.word.ten" : "nudge.word.now")}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 rounded-lg" onClick={() => previewNudges(ev.id)}>
              <BellRing /> {t("today.preview")}
            </Button>
            {perm === "default" && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 rounded-lg text-muted-foreground"
                onClick={() => {
                  if (native) {
                    setAskNotify("explain");
                    return;
                  }
                  void (async () => {
                    const p = await requestNotifyPermission();
                    setPerm(p);
                    toast(p === "granted" ? t("today.browserOn") : t("today.browserOff"), {
                      description: p === "granted" ? t("today.browserOnBody") : t("today.browserOffBody"),
                    });
                  })();
                }}
              >
                {t("today.allow")}
              </Button>
            )}
          </div>
          {askNotify === "explain" && (
            <PermitCard
              title="permit.notifyTitle"
              body="permit.notifyWhy"
              onAllow={() => {
                void (async () => {
                  const p = await requestNotifyPermission();
                  setPerm(p);
                  setAskNotify(p === "granted" ? null : "denied");
                  if (p === "granted") void syncNativeReminders(state);
                })();
              }}
              onLater={() => setAskNotify(null)}
              onSettings={() => void openAppSettings()}
            />
          )}
          {askNotify === "denied" && (
            <PermitCard title="permit.notifyTitle" body="permit.notifyDenied" denied onAllow={() => {}} onLater={() => setAskNotify(null)} onSettings={() => void openAppSettings()} />
          )}
        </div>
      )}
    </section>
  );
}

function GhostBtn({
  children,
  onClick,
  icon,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
        active ? "border-blue/50 bg-blue/10 text-blue" : "border-border bg-background/30 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}