import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Minus, Pause, Play, Plus, RotateCcw, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Loading } from "@/components/nowmode/Loading";
import { Ring } from "@/components/nowmode/Ring";
import { MenuButton } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLocale, useT } from "@/lib/i18n/context";
import { formatLocaleTime } from "@/lib/i18n/format";
import { alarmCanPlay, playBlockChime, unlockAlarm } from "@/lib/nowmode/alarm";
import { focusWinLabel } from "@/lib/nowmode/profile";
import { parseCustomDuration, splitCustomMinutes } from "@/lib/nowmode/settings";
import { formatMMSS } from "@/lib/nowmode/logic";
import { eventEndClock, parseMinutesInput, scheduleOf } from "@/lib/nowmode/schedule";
import { FOCUS_PRESETS, useNow, useNowMode, type ExtendResult } from "@/lib/nowmode/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus · Now Mode" },
      { name: "description", content: "A gentle focus timer with a quiet body-double and a no-score check-in." },
      { property: "og:title", content: "Focus · Now Mode" },
      { property: "og:description", content: "A gentle focus timer with a quiet body-double and a no-score check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FocusScreen,
});

const QUICK = [5, 10, 15, 30];
const PRESET_KEYS = {
  meditate: "focus.preset.meditate",
  study: "focus.preset.study",
  clean: "focus.preset.clean",
  custom: "focus.preset.custom",
} as const;

function SessionTitle({
  linked,
  label,
  edited,
  onName,
}: {
  linked: boolean;
  label: string;
  edited: boolean;
  onName: (value: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    if (!edited) setDraft(label);
  }, [edited, label]);
  return (
    <div className="mt-5 text-center">
      <p className="text-sm text-muted-foreground">{t("focus.amplifying")}</p>
      {linked ? (
        <h1 className="mt-1 px-6 text-[22px] font-bold leading-tight">{label || t("focus.fallback")}</h1>
      ) : (
        <label className="mt-1 block px-6">
          <span className="sr-only">{t("focus.name")}</span>
          <input
            value={edited ? label : draft}
            placeholder={t("focus.namePh")}
            aria-label={t("focus.name")}
            onChange={(e) => {
              setDraft(e.target.value);
              onName(e.target.value);
            }}
            className="w-full bg-transparent text-center text-[22px] font-bold leading-tight text-foreground outline-none placeholder:text-dim"
          />
        </label>
      )}
    </div>
  );
}

function FocusScreen() {
  const {
    ready,
    state,
    selectPreset,
    setCustomMin,
    setCustomParts,
    startFocus,
    setFocusLabel,
    pauseFocus,
    resumeFocus,
    resetFocus,
    setBodyDouble,
    checkIn,
    extendLinked,
    finishLinked,
    dismissEndPrompt,
    endLinked,
    releaseLinked,
  } = useNowMode();
  const t = useT();
  const locale = useLocale();
  const now = useNow(1000);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  if (!ready) return <Loading />;

  const f = state.focus;
  const linkedEvent = f.linkedToBlock ? state.events.find((e) => e.id === f.eventId) ?? null : null;
  const linked = !!linkedEvent && scheduleOf(linkedEvent) === "flexible";
  const paused = !f.running && f.remainingSec < f.totalSec && !f.finished && !f.endPromptFor;
  const endsAt = f.running && f.endsAt ? new Date(f.endsAt) : new Date(now.getTime() + f.remainingSec * 1000);
  const endLabel = linked && linkedEvent
    ? formatLocaleTime(eventEndClock(linkedEvent), locale)
    : formatLocaleTime(`${endsAt.getHours()}:${endsAt.getMinutes()}`, locale);

  const begin = () => {
    unlockAlarm();
    if (f.running) pauseFocus();
    else if (paused) resumeFocus();
    else startFocus();
  };

  return (
    <div className="relative flex min-h-full flex-col bg-focus">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 pb-3 pt-5">
        <MenuButton />
        <span className="mx-auto rounded-full border border-blue/40 bg-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue">
          {linked ? t("focus.linked") : t("focus.free")}
        </span>
        <span className="size-9" aria-hidden />
      </header>

      {!linked && (
        <div className="flex flex-wrap justify-center gap-2 px-5" role="radiogroup" aria-label={t("focus.presets")}>
          {FOCUS_PRESETS.map((p) => {
            const active = f.presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={f.running}
                onClick={() => selectPreset(p.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  active ? "border-blue/60 bg-blue/15 text-blue" : "border-border2 bg-card text-muted-foreground",
                )}
              >
                {t(PRESET_KEYS[p.id])} {p.id === "custom" ? f.customMin : p.minutes}
              </button>
            );
          })}
        </div>
      )}

      {linked && linkedEvent && (
        <div className="px-5 text-center">
          <p className="text-xs text-muted-foreground">
            {formatLocaleTime(linkedEvent.time, locale)} – {formatLocaleTime(eventEndClock(linkedEvent), locale)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-dim">
            {t("focus.blockNote")}
          </p>
        </div>
      )}

      {!linked && f.presetId === "custom" && !f.running && (
        <CustomDuration
          hours={f.customHours ?? Math.floor(f.customMin / 60)}
          minutes={f.customMinutes ?? f.customMin % 60}
          error={customError}
          onChange={(hours, minutes) => {
            const parsed = parseCustomDuration(String(hours), String(minutes));
            if (!parsed.ok) {
              setCustomError(parsed.reason === "format" ? t("focus.badFormat") : t("focus.badRange"));
              return;
            }
            setCustomError(null);
            setCustomParts(parsed.hours, parsed.minutes);
          }}
          onStep={(delta) => {
            const total = (f.customHours ?? Math.floor(f.customMin / 60)) * 60 + (f.customMinutes ?? f.customMin % 60) + delta;
            const next = splitCustomMinutes(Math.max(1, total));
            setCustomError(null);
            setCustomParts(next.hours, next.minutes);
            setCustomMin(next.hours * 60 + next.minutes);
          }}
        />
      )}

      <SessionTitle linked={linked} label={linked ? linkedEvent?.title || f.label : focusWinLabel(f, t)} edited={!!f.nameEdited} onName={setFocusLabel} />

      <div className="relative mx-auto mt-6 grid place-items-center">
        {f.bodyDouble && (
          <span className="animate-breathe pointer-events-none absolute size-[250px] rounded-full bg-teal/15 blur-2xl" aria-hidden />
        )}
        <Ring size={linked ? 180 : 200} stroke={18} value={f.totalSec ? f.remainingSec / f.totalSec : 0} label={t("focus.remaining")}>
          <div className="text-center">
            <p className="text-[46px] font-bold tabular-nums leading-none tracking-tight">{formatMMSS(f.remainingSec)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {linked ? t("focus.ends", { time: endLabel }) : t("focus.then", { time: endLabel })}
            </p>
          </div>
        </Ring>
      </div>

      {linked && f.endPromptFor == null && <ExtendPanel extendLinked={extendLinked} />}

      <label className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            f.bodyDouble ? "bg-teal/20 text-teal" : "bg-card2 text-dim",
          )}
        >
          <UsersRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("focus.body")}</span>
          <span className="block text-xs text-muted-foreground">
            {f.bodyDouble ? t("focus.bodyOn") : t("focus.bodyOff")}
          </span>
        </span>
        <Switch checked={f.bodyDouble} onCheckedChange={setBodyDouble} aria-label={t("focus.body")} />
      </label>

      {linked && (
        <div className="px-5 pt-3 text-center">
          <button type="button" className="text-xs font-semibold text-dim underline-offset-2 hover:underline" onClick={() => setConfirmRelease(true)}>
            {t("focus.separate")}
          </button>
        </div>
      )}

      <div className="flex-1" />

      <div className="grid grid-cols-3 gap-2.5 px-5 pb-4 pt-6">
        <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={linked ? endLinked : resetFocus}>
          <RotateCcw /> {linked ? t("focus.end") : t("focus.reset")}
        </Button>
        <Button size="lg" className="h-12 rounded-xl text-[15px] font-semibold" onClick={begin}>
          {f.running ? <Pause /> : <Play />} {f.running ? t("focus.pause") : paused ? t("focus.resume") : t("focus.start")}
        </Button>
        {linked ? (
          <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={resetFocus}>
            <RotateCcw /> {t("focus.reset")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-xl"
            onClick={() => {
              unlockAlarm();
              startFocus({ minutes: 2 });
            }}
          >
            <Clock3 /> {t("focus.just2")}
          </Button>
        )}
      </div>

      {linked && (
        <p className="px-6 pb-4 text-center text-[11px] leading-relaxed text-dim">
          {t("focus.chime")}
        </p>
      )}

      {f.finished && !linked && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/75 px-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("focus.checkin")}>
          <div className="animate-fade-soft w-full max-w-sm rounded-[20px] border border-border2 bg-card2 p-6 text-center shadow-shell">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">{t("focus.checkin")}</p>
            <h2 className="mt-2 text-xl font-bold">{t("focus.showed")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("focus.noScore")}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button size="lg" className="h-12 rounded-xl text-[15px] font-semibold" onClick={() => checkIn("good")}>
                {t("focus.good")}
              </Button>
              <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={() => checkIn("more")}>
                {t("focus.plus5")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {linked && f.endPromptFor != null && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-ink/75 px-4 pb-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="block-end-title">
          <div className="animate-fade-soft max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[20px] border border-border2 bg-card2 p-5 shadow-shell">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">
              {f.remainingSec <= 0 ? t("focus.timesUp") : t("focus.stopQ")}
            </p>
            <h2 id="block-end-title" className="mt-2 text-xl font-bold">
              {f.remainingSec <= 0 ? t("focus.reached", { title: f.label, time: endLabel }) : t("focus.stopName", { title: f.label })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("focus.prompt")}</p>
            {!alarmCanPlay() && f.remainingSec <= 0 && (
              <p className="mt-2 text-xs leading-relaxed text-dim">{t("focus.noChime")}</p>
            )}
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-0 text-xs text-muted-foreground"
                onClick={() => {
                  unlockAlarm();
                  playBlockChime(`manual-${Date.now()}`, true);
                }}
              >
                {t("focus.play")}
              </Button>
            </div>
            <ExtendPanel extendLinked={extendLinked} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button size="lg" className="h-12 rounded-xl text-[15px] font-semibold" onClick={finishLinked}>
                {t("focus.finish")}
              </Button>
              <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={dismissEndPrompt}>
                {t("focus.notYet")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmRelease && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/75 px-6" role="dialog" aria-modal="true" aria-labelledby="release-title">
          <div className="w-full max-w-sm rounded-[20px] border border-border2 bg-card2 p-5 shadow-shell">
            <h2 id="release-title" className="text-lg font-bold">
              {t("focus.leaveTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("focus.leaveBody", { title: f.label })}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setConfirmRelease(false)}>
              {t("focus.keepIt")}
            </Button>
              <Button
                className="h-11 rounded-xl"
                onClick={() => {
                  releaseLinked();
                  setConfirmRelease(false);
                }}
              >
                {t("focus.separate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomDuration({
  hours,
  minutes,
  error,
  onChange,
  onStep,
}: {
  hours: number;
  minutes: number;
  error: string | null;
  onChange: (hours: number, minutes: number) => void;
  onStep: (delta: number) => void;
}) {
  const t = useT();
  const total = `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return (
    <div className="mx-5 mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold">
          {t("focus.hours")}
          <input
            inputMode="numeric"
            value={String(hours)}
            aria-label={t("focus.hours")}
            onChange={(e) => onChange(Number(e.target.value || "0"), minutes)}
            className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
          />
        </label>
        <label className="block text-xs font-semibold">
          {t("focus.minutes")}
          <input
            inputMode="numeric"
            value={String(minutes)}
            aria-label={t("focus.minutes")}
            onChange={(e) => onChange(hours, Number(e.target.value || "0"))}
            className="mt-1 h-11 w-full rounded-xl border border-border2 bg-card px-3 text-sm focus:border-blue focus:outline-none"
          />
        </label>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("focus.total", { total })}</p>
      {error && (
        <p role="alert" className="text-center text-xs text-coral">
          {error}
        </p>
      )}
      <div className="flex items-center justify-center gap-3 text-sm">
        <button type="button" aria-label={t("focus.less")} onClick={() => onStep(-1)} className="grid size-11 place-items-center rounded-full border border-border2 bg-card">
          <Minus className="size-4" />
        </button>
        <button type="button" aria-label={t("focus.more")} onClick={() => onStep(1)} className="grid size-11 place-items-center rounded-full border border-border2 bg-card">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ExtendPanel({ extendLinked }: { extendLinked: (minutes: number, force?: boolean) => ExtendResult }) {
  const t = useT();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ minutes: number; message: string } | null>(null);

  const go = (minutes: number, force = false) => {
    const result = extendLinked(minutes, force);
    if (!result.ok && result.reason === "conflict") {
      setError(null);
      setPending({ minutes, message: result.message });
      return;
    }
    if (!result.ok) {
      setPending(null);
      setError(result.message);
      return;
    }
    setError(null);
    setPending(null);
    setCustom("");
  };

  return (
    <div className="mx-5 mt-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{t("focus.add")}</p>
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => go(n)}
            className="rounded-xl border border-border2 bg-card py-2 text-sm font-semibold text-foreground hover:bg-card2"
          >
            +{n}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseMinutesInput(custom);
          if (!parsed.ok) {
            setPending(null);
            setError(parsed.message);
            return;
          }
          go(parsed.minutes);
        }}
      >
        <label className="sr-only" htmlFor="custom-minutes">
          Custom minutes
        </label>
        <input
          id="custom-minutes"
          inputMode="numeric"
          value={custom}
          placeholder={t("focus.customPh")}
          onChange={(e) => {
            setCustom(e.target.value);
            setError(null);
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-border2 bg-card px-3 text-sm placeholder:text-dim focus:border-blue focus:outline-none"
        />
        <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">
          {t("focus.customBtn")}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs leading-relaxed text-coral">
          {error}
        </p>
      )}
      {pending && (
        <div role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2">
          <p className="text-xs leading-relaxed">{pending.message}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-8 rounded-lg" onClick={() => go(pending.minutes, true)}>
              {t("conflict.extend")}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setPending(null)}>
              {t("conflict.keep")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
