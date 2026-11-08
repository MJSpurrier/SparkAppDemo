import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Minus, Pause, Play, Plus, RotateCcw, UsersRound } from "lucide-react";

import { Loading } from "@/components/nowmode/Loading";
import { Ring } from "@/components/nowmode/Ring";
import { MenuButton } from "@/components/nowmode/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatClock, formatMMSS } from "@/lib/nowmode/logic";
import { FOCUS_PRESETS, useNow, useNowMode } from "@/lib/nowmode/store";
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

function FocusScreen() {
  const {
    ready,
    state,
    selectPreset,
    setCustomMin,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    setBodyDouble,
    checkIn,
  } = useNowMode();
  const now = useNow(1000);
  if (!ready) return <Loading />;

  const f = state.focus;
  const paused = !f.running && f.remainingSec < f.totalSec && !f.finished;
  const endsAt = f.running && f.endsAt ? new Date(f.endsAt) : new Date(now.getTime() + f.remainingSec * 1000);

  return (
    <div className="relative flex min-h-full flex-col bg-focus">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 pb-3 pt-5">
        <MenuButton />
        <span className="mx-auto rounded-full border border-blue/40 bg-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue">
          Focus · one thing
        </span>
        <span className="size-9" aria-hidden />
      </header>

      <div className="flex flex-wrap justify-center gap-2 px-5" role="radiogroup" aria-label="Presets">
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
              {p.label} {p.id === "custom" ? f.customMin : p.minutes}
            </button>
          );
        })}
      </div>

      {f.presetId === "custom" && !f.running && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            aria-label="Less time"
            onClick={() => setCustomMin(f.customMin - 1)}
            className="grid size-8 place-items-center rounded-full border border-border2 bg-card"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-16 text-center font-semibold tabular-nums">{f.customMin} min</span>
          <button
            type="button"
            aria-label="More time"
            onClick={() => setCustomMin(f.customMin + 1)}
            className="grid size-8 place-items-center rounded-full border border-border2 bg-card"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}

      <div className="mt-5 text-center">
        <p className="text-sm text-muted-foreground">You're amplifying</p>
        <h1 className="mt-1 px-6 text-[22px] font-bold leading-tight">{f.label || "One thing"}</h1>
      </div>

      <div className="relative mx-auto mt-6 grid place-items-center">
        {f.bodyDouble && (
          <span className="animate-breathe pointer-events-none absolute size-[250px] rounded-full bg-teal/15 blur-2xl" aria-hidden />
        )}
        <Ring size={200} stroke={18} value={f.totalSec ? f.remainingSec / f.totalSec : 0} label="Time remaining">
          <div className="text-center">
            <p className="text-[46px] font-bold tabular-nums leading-none tracking-tight">{formatMMSS(f.remainingSec)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Ends {formatClock(endsAt)} · then breathe
            </p>
          </div>
        </Ring>
      </div>

      <label className="mx-5 mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            f.bodyDouble ? "bg-teal/20 text-teal" : "bg-card2 text-dim",
          )}
        >
          <UsersRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Quiet body-double</span>
          <span className="block text-xs text-muted-foreground">
            {f.bodyDouble ? "Someone's quietly working alongside you." : "A soft presence, no talking."}
          </span>
        </span>
        <Switch checked={f.bodyDouble} onCheckedChange={setBodyDouble} aria-label="Quiet body-double" />
      </label>

      <div className="flex-1" />

      <div className="grid grid-cols-3 gap-2.5 px-5 pb-4 pt-6">
        <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={resetFocus}>
          <RotateCcw /> Reset
        </Button>
        <Button
          size="lg"
          className="h-12 rounded-xl text-[15px] font-semibold"
          onClick={() => (f.running ? pauseFocus() : paused ? resumeFocus() : startFocus())}
        >
          {f.running ? <Pause /> : <Play />} {f.running ? "Pause" : paused ? "Resume" : "Start"}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-12 rounded-xl"
          onClick={() => startFocus({ minutes: 2 })}
        >
          <Clock3 /> Just 2
        </Button>
      </div>

      {f.finished && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-ink/75 px-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Check-in">
          <div className="animate-fade-soft w-full rounded-[20px] border border-border2 bg-card2 p-6 text-center shadow-shell">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">Check-in</p>
            <h2 className="mt-2 text-xl font-bold">You showed up for it.</h2>
            <p className="mt-1 text-sm text-muted-foreground">No score. How does it feel?</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button size="lg" className="h-12 rounded-xl text-[15px] font-semibold" onClick={() => checkIn("good")}>
                Good enough ✓
              </Button>
              <Button variant="secondary" size="lg" className="h-12 rounded-xl" onClick={() => checkIn("more")}>
                +5 min
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}