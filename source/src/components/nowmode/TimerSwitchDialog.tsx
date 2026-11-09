import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { unlockAlarm } from "@/lib/nowmode/alarm";
import { useNowMode } from "@/lib/nowmode/store";

import { useUI } from "./ui-context";

export function TimerSwitchDialog() {
  const { timerRequest, closeTimerRequest } = useUI();
  const { state, startLinkedTimer, startFocus } = useNowMode();
  const navigate = useNavigate();

  useEffect(() => {
    if (!timerRequest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTimerRequest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timerRequest, closeTimerRequest]);

  if (!timerRequest) return null;
  const next = state.events.find((e) => e.id === timerRequest.eventId);
  if (!next) return null;
  const current = state.focus.label || "A focus session";

  const keep = () => closeTimerRequest();
  const switchNow = () => {
    unlockAlarm();
    if (timerRequest.kind === "block") startLinkedTimer(next.id);
    else {
      startFocus({
        minutes: timerRequest.minutes,
        eventId: next.id,
        label: next.title,
        presetId: "event",
        linkedToBlock: false,
      });
    }
    closeTimerRequest();
    navigate({ to: "/focus" });
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center px-5" role="dialog" aria-modal="true" aria-labelledby="switch-title">
      <button type="button" aria-label="Keep the current timer" onClick={keep} className="absolute inset-0 bg-ink/70" />
      <div className="relative w-full rounded-[20px] border border-border2 bg-card2 p-5 shadow-shell">
        <h2 id="switch-title" className="text-lg font-bold">
          A timer is already going
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {current} is still on the timer. Switch to {next.title}? The other countdown stops. Nothing is deleted.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" className="h-11 rounded-xl" onClick={keep}>
            Keep current
          </Button>
          <Button size="lg" className="h-11 rounded-xl" onClick={switchNow}>
            Switch
          </Button>
        </div>
      </div>
    </div>
  );
}
